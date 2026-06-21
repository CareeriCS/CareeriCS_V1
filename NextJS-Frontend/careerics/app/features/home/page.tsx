"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useResponsive } from "@/hooks/useResponsive";

// UI Components
import ChoiceCard from "@/components/ui/home/choice-card-home";
import { JourneyProgressCard } from "@/components/ui/home/journey-progress-card";
import { PhaseCard } from "@/components/ui/home/phase-card";
import { CareerCardsContainer } from "@/components/ui/containers/career";
import { StackContainer } from "@/components/ui/containers/stack";
import { ActivityCard } from "@/components/ui/activity-card";

// Services
import {
  careerService,
  interviewService,
  jobService,
  skillAssessmentService,
  roadmapService,
} from "@/services";

// Core Utilities & Logic
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  loadCourseProgress,
  syncCourseProgressFromServer,
} from "@/lib/course-progress";
import { UNIFIED_BOOKMARKS_UPDATED_EVENT } from "@/lib/unified-bookmarks";
import { removeTrackBookmarksFromUnifiedList } from "@/lib/unified-bookmark-actions";
import {
  buildCareerQuizResultsHref,
  buildCareerQuizSelectionHref,
  startCareerQuizSession,
} from "@/lib/career-quiz";
import { buildJobDetailsHref, mapApiJobToUiModel } from "@/lib/jobs";
import {
  JOURNEY_PHASE_STATE_UPDATED_EVENT,
  JOURNEY_PHASES,
  type JourneyProgressSnapshot,
  type JourneyTrackCard,
  buildJourneyPhaseHref,
  getJourneyPhaseStateFromSnapshot,
  invalidateJourneyProgressCache,
  invalidateJourneyTrackCardsCache,
  loadJourneyProgressSnapshot,
  loadJourneyTrackCards,
  normalizeJourneyPhaseNumber,
  persistSelectedJourneyTrackId,
  readSelectedJourneyTrackId,
  syncSelectedJourneyTrackProgress,
  toProgressBucket,
} from "@/lib/journey";
import { isHiddenComputerScienceCourse, isHiddenComputerScienceOption } from "@/lib/hidden-ui-items";

// Types
import type {
  APIAssessmentSessionSummary,
  APIAssessmentSessionType,
  APISkill,
  RoadmapRead,
} from "@/types";

type RecentActivityItem = {
  key: string;
  id: string;
  date: string;
  type: "career" | "skill" | "interview" | "course" | "job" | "file";
  score?: number;
  timestamp: number;
  href?: string | null;
  downloadUrl?: string | null;
};

type SessionTitleLookup = {
  roadmapTitleById: Map<string, string>;
  sectionTitleById: Map<string, string>;
  stepTitleById: Map<string, string>;
};

// Global Static Fallbacks
const RECENT_ACTIVITY_PLACEHOLDER: RecentActivityItem[] = [
  {
    key: "placeholder",
    id: "No activity yet",
    date: "Complete a quiz, assessment, interview, course, or job application to see activity here",
    type: "file",
    timestamp: 0,
  },
];
const RECENT_ACTIVITY_LIMIT = 5;

// Pure Auxiliary Formatting Functions
function formatActivityDate(value: string, prefix: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? `Recently ${prefix.toLowerCase()}` : `${prefix} ${parsed.toLocaleDateString()}`;
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssessmentActivityTitle(sessionType?: string): string {
  const normalized = sessionType?.toLowerCase();
  if (normalized === "skills" || normalized === "skill") return "Skill Assessment";
  if (normalized === "roadmap") return "Roadmap Assessment";
  if (normalized === "section") return "Section Assessment";
  if (normalized === "step") return "Step Assessment";
  return "Assessment Session";
}

function dedupeActivities(activities: RecentActivityItem[]): RecentActivityItem[] {
  const byKey = new Map<string, RecentActivityItem>();
  const sorted = [...activities].sort((a, b) => b.timestamp - a.timestamp);
  for (const activity of sorted) {
    if (!byKey.has(activity.key)) {
      byKey.set(activity.key, activity);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function normalizeSessionType(sessionType?: string | null): APIAssessmentSessionType {
  if (sessionType === "skill") return "skills";
  if (["skills", "roadmap", "section", "step"].includes(sessionType || "")) {
    return sessionType as APIAssessmentSessionType;
  }
  return "skills";
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  // Shared Data States
  const [sessionRoadmapsById, setSessionRoadmapsById] = useState<Record<string, RoadmapRead>>({});
  const [selectedRoadmap] = useState<RoadmapRead | null>(null);
  const [skills] = useState<APISkill[]>([]);
  const [projectActivities, setProjectActivities] = useState<RecentActivityItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [journeyTracks, setJourneyTracks] = useState<JourneyTrackCard[]>([]);
  const [journeyProgressSnapshot, setJourneyProgressSnapshot] = useState<JourneyProgressSnapshot>({
    byTrackId: new Map(),
    selectedTrackId: null,
  });

  // Action Status Flags
  const [isStartingCareerQuiz, setIsStartingCareerQuiz] = useState(false);
  const [isLoadingJourneyTracks, setIsLoadingJourneyTracks] = useState(false);
  const [removingTrackIds, setRemovingTrackIds] = useState<Set<string>>(new Set());

  // Error States
  const [careerQuizError, setCareerQuizError] = useState<string | null>(null);
  const [bookmarkActionError, setBookmarkActionError] = useState<string | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  // Sync Nonce Refresh Handlers
  const [activityRefreshNonce, setActivityRefreshNonce] = useState(0);
  const [bookmarkRefreshNonce, setBookmarkRefreshNonce] = useState(0);
  const [phaseStateRefreshNonce, setPhaseStateRefreshNonce] = useState(0);

  // Layout Viewports
  const { isLarge, isMedium, isSmall } = useResponsive();

  // Primary Skills Lookup Optimizer
  const skillById = useMemo(() => {
    const map = new Map<string, APISkill>();
    for (const skill of skills) {
      map.set(skill.id, skill);
    }
    return map;
  }, [skills]);

  // Session String Processor
  const resolveSessionTitle = useCallback((
    session: APIAssessmentSessionSummary,
    skillMap: Map<string, APISkill>,
    lookup: SessionTitleLookup
  ): string => {
    const type = normalizeSessionType(session.type);
    if (type === "skills") {
      return skillMap.get(session.skill_id || "")?.skill_name || "Skill Assessment";
    }
    if (type === "roadmap") {
      return lookup.roadmapTitleById.get(session.roadmap_id || "") || "Roadmap Assessment";
    }
    if (type === "section") {
      return lookup.sectionTitleById.get(session.section_id || "") || "General Topic";
    }
    if (type === "step") {
      return lookup.stepTitleById.get(session.step_id || "") || "Specific Skill";
    }
    return "Roadmap Assessment";
  }, []);

  // System Events Registration Hook
  useEffect(() => {
    const handleJourneyPhaseStateUpdated = () => {
      invalidateJourneyProgressCache(userId);
      setPhaseStateRefreshNonce((prev) => prev + 1);
    };

    const handleBookmarksUpdated = () => {
      if (!isAuthLoading) {
        invalidateJourneyTrackCardsCache(userId);
        setBookmarkRefreshNonce((prev) => prev + 1);
      }
    };

    const handleCourseProgressUpdated = () => {
      setActivityRefreshNonce((prev) => prev + 1);
    };

    window.addEventListener(JOURNEY_PHASE_STATE_UPDATED_EVENT, handleJourneyPhaseStateUpdated as EventListener);
    window.addEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated as EventListener);
    window.addEventListener("storage", handleBookmarksUpdated);
    window.addEventListener(COURSE_PROGRESS_UPDATED_EVENT, handleCourseProgressUpdated as EventListener);

    return () => {
      window.removeEventListener(JOURNEY_PHASE_STATE_UPDATED_EVENT, handleJourneyPhaseStateUpdated as EventListener);
      window.removeEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated as EventListener);
      window.removeEventListener("storage", handleBookmarksUpdated);
      window.removeEventListener(COURSE_PROGRESS_UPDATED_EVENT, handleCourseProgressUpdated as EventListener);
    };
  }, [isAuthLoading, userId]);

  // Unified Single-Pass Activity Pipeline Effect
  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId) {
      setProjectActivities([]);
      return;
    }

    let isCancelled = false;

    const loadProjectActivities = async () => {
      try {
        await syncCourseProgressFromServer(userId);

        // Fetch core datasets concurrently
        const [
          assessmentSessionsResp,
          interviewSessionsResp,
          careerSessionsResp,
          jobApplicationsResp,
        ] = await Promise.all([
          skillAssessmentService.getUserSessions(userId),
          interviewService.getUserSessions(userId),
          careerService.getUserSessions(userId),
          jobService.getUserApplications(userId, { limit: RECENT_ACTIVITY_LIMIT, sort: "date" }),
        ]);

        if (isCancelled) return;

        const rawSessions = assessmentSessionsResp.success ? assessmentSessionsResp.data ?? [] : [];
        const submittedSessions = rawSessions.filter((session) => session.status === "submitted");

        // Scrape required missing roadmap modules instantly 
        const requiredRoadmapIds = Array.from(
          new Set(
            submittedSessions
              .filter(s => ["roadmap", "section", "step"].includes(normalizeSessionType(s.type)))
              .map(s => s.roadmap_id)
              .filter((id): id is string => typeof id === "string")
          )
        );

        const missingRoadmapIds = requiredRoadmapIds.filter(id => !sessionRoadmapsById[id]);
        const activeRoadmapsMap = { ...sessionRoadmapsById };

        if (missingRoadmapIds.length > 0) {
          const fetchedRoadmaps = await Promise.all(
            missingRoadmapIds.map(id => roadmapService.getRoadmapById(id))
          );

          let stateMutationNeeded = false;
          for (const res of fetchedRoadmaps) {
            if (res.success && res.data) {
              activeRoadmapsMap[res.data.id] = res.data;
              stateMutationNeeded = true;
            }
          }

          if (stateMutationNeeded && !isCancelled) {
            setSessionRoadmapsById(activeRoadmapsMap);
          }
        }

        // Build isolated functional lookup tables matching exact execution frames
        const localRoadmapTitleById = new Map<string, string>();
        const localSectionTitleById = new Map<string, string>();
        const localStepTitleById = new Map<string, string>();

        const trackableRoadmaps = Object.values(activeRoadmapsMap);
        if (selectedRoadmap && !trackableRoadmaps.some((r) => String(r.id) === String(selectedRoadmap.id))) {
          trackableRoadmaps.push(selectedRoadmap);
        }

        for (const roadmap of trackableRoadmaps) {
          localRoadmapTitleById.set(roadmap.id, roadmap.title || "Roadmap Assessment");
          for (const section of roadmap.sections) {
            localSectionTitleById.set(section.id, section.title);
            for (const step of section.steps) {
              localStepTitleById.set(step.id, step.title);
            }
          }
        }

        const exactLookup: SessionTitleLookup = {
          roadmapTitleById: localRoadmapTitleById,
          sectionTitleById: localSectionTitleById,
          stepTitleById: localStepTitleById,
        };

        // Standardize Career Submissions mapping
        const careerSessions = (careerSessionsResp.success ? careerSessionsResp.data ?? [] : [])
          .filter((session) => session.status?.toLowerCase() === "submitted")
          .sort((a, b) => toTimestamp(b.submitted_at ?? b.started_at) - toTimestamp(a.submitted_at ?? a.started_at));

        const recentCareerSessions = careerSessions.slice(0, RECENT_ACTIVITY_LIMIT);
        const careerResults = await Promise.all(
          recentCareerSessions.map((session) => careerService.getCareerResults(session.id))
        );

        const careerActivities = recentCareerSessions.map((session, index) => {
          const activityDate = session.submitted_at ?? session.started_at ?? "";
          const scoreData = careerResults[index];
          const topTrack = scoreData.success && scoreData.data?.track_scores?.length ? scoreData.data.track_scores[0] : null;

          return {
            id: `career:${session.id}`,
            key: topTrack ? `${topTrack.track_name}` : "Career Quiz Completed",
            date: formatActivityDate(activityDate, "Completed on"),
            type: "career" as const,
            score: typeof topTrack?.score === "number" ? Math.min(Math.max(Math.round(topTrack.score), 0), 100) : undefined,
            timestamp: toTimestamp(activityDate),
            href: buildCareerQuizResultsHref(session.id, topTrack?.track_id),
          };
        });

        // Safe Assessment parsing with validated lookup values
        const assessmentActivities = submittedSessions
          .sort((a, b) => toTimestamp(b.submitted_at ?? b.started_at) - toTimestamp(a.submitted_at ?? a.started_at))
          .slice(0, RECENT_ACTIVITY_LIMIT)
          .map((session) => {
            const activityDate = session.submitted_at ?? session.started_at;
            const activityScore = typeof session.score === "number" ? Math.min(Math.max(Math.round(session.score), 0), 100) : undefined;
            const sessionTitle = resolveSessionTitle(session, skillById, exactLookup);

            return {
              key: sessionTitle,
              id: `${getAssessmentActivityTitle(session.type)} Completed`,
              date: formatActivityDate(activityDate, "Completed on"),
              type: "skill" as const,
              score: activityScore,
              timestamp: toTimestamp(activityDate),
              href: "/features/skill",
            };
          });

        // Synchronize Conversational Interviews
        const interviewActivities = (interviewSessionsResp.success ? interviewSessionsResp.data ?? [] : [])
          .filter((session) => session.status?.toLowerCase() === "completed")
          .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
          .slice(0, RECENT_ACTIVITY_LIMIT)
          .map((session) => ({
            key: `interview:${session.id}`,
            id: `${session.name}`,
            date: formatActivityDate(session.created_at ?? "", ""),
            type: "interview" as const,
            timestamp: toTimestamp(session.created_at),
            href: `/interview-feature/last-analysis?type=${encodeURIComponent(session.type || "hr")}&sessionId=${encodeURIComponent(session.id)}&q=1`,
          }));

        // Parse Course completion progress files
        const courseActivities = loadCourseProgress(userId).completed
          .filter((course) => !isHiddenComputerScienceCourse(course))
          .map((course) => {
            const activityDate = course.completedAt ?? course.updatedAt ?? "";
            return {
              key: `${course.provider}`,
              id: `Course: ${course.title}`,
              date: formatActivityDate(activityDate, "Completed on"),
              type: "course" as const,
              timestamp: toTimestamp(activityDate),
              href: "/features/courses",
            };
          });

        // Compute Applied Jobs metrics
        const jobActivities = (jobApplicationsResp.success ? (jobApplicationsResp.data?.jobs ?? []).map(mapApiJobToUiModel) : [])
          .filter((job) => Boolean(job.appliedAt))
          .map((job) => ({
            key: `${job.company}`,
            id: `Applied to ${job.title}`,
            date: formatActivityDate(job.appliedAt ?? "", "Applied on"),
            type: "job" as const,
            timestamp: toTimestamp(job.appliedAt),
            href: buildJobDetailsHref(job.id),
          }));

        const unifiedTimeline = dedupeActivities([
          ...careerActivities,
          ...assessmentActivities,
          ...interviewActivities,
          ...courseActivities,
          ...jobActivities,
        ]).slice(0, RECENT_ACTIVITY_LIMIT);

        if (!isCancelled) {
          setProjectActivities(unifiedTimeline);
        }
      } catch {
        if (!isCancelled) setProjectActivities([]);
      }
    };

    void loadProjectActivities();
    return () => { isCancelled = true; };
  }, [activityRefreshNonce, isAuthLoading, userId, skillById, resolveSessionTitle, selectedRoadmap, sessionRoadmapsById]);

  // Track Architecture Sync Engine Effect
  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId) {
      setJourneyTracks([]);
      setJourneyProgressSnapshot({ byTrackId: new Map(), selectedTrackId: null });
      setSelectedTrackId(null);
      setJourneyError(null);
      setIsLoadingJourneyTracks(false);
      return;
    }

    let alive = true;
    const loadTracks = async () => {
      setIsLoadingJourneyTracks(true);
      setJourneyError(null);

      try {
        const [tracks, snapshot] = await Promise.all([
          loadJourneyTrackCards(userId),
          loadJourneyProgressSnapshot(userId),
        ]);

        if (!alive) return;

        setJourneyTracks(tracks);
        setJourneyProgressSnapshot(snapshot);

        const visibleBookmarkedTracks = tracks.filter(
          (track) => track.source === "bookmark" && !isHiddenComputerScienceOption(track)
        );

        const persistedTrackId = snapshot.selectedTrackId || readSelectedJourneyTrackId(userId);
        const storageMatch = persistedTrackId ? visibleBookmarkedTracks.find((track) => track.id === persistedTrackId) || null : null;
        const defaultFallback = storageMatch || visibleBookmarkedTracks[0] || null;

        setSelectedTrackId(defaultFallback?.id || null);
        persistSelectedJourneyTrackId(defaultFallback?.id || null, userId);
        if (defaultFallback) {
          const fallbackPhaseState = getJourneyPhaseStateFromSnapshot(
            snapshot,
            defaultFallback.id,
            userId,
          );
          const fallbackPhase = normalizeJourneyPhaseNumber(
            Math.max(defaultFallback.roadmapId ? 2 : 1, fallbackPhaseState.maxReached),
          );

          void syncSelectedJourneyTrackProgress({
            trackId: defaultFallback.id,
            userId,
            roadmapId: defaultFallback.roadmapId,
            maxReached: fallbackPhase,
          });
        }
      } catch {
        if (!alive) return;
        setJourneyTracks([]);
        setJourneyProgressSnapshot({ byTrackId: new Map(), selectedTrackId: null });
        setSelectedTrackId(null);
        setJourneyError("Unable to load your journey tracks right now.");
      } finally {
        if (alive) setIsLoadingJourneyTracks(false);
      }
    };

    void loadTracks();
    return () => { alive = false; };
  }, [bookmarkRefreshNonce, isAuthLoading, phaseStateRefreshNonce, userId]);

  // Derived Bookmark Filtering Cache
  const visibleBookmarkedJourneyTracks = useMemo(() => {
    return journeyTracks.filter((track) => track.source === "bookmark" && !isHiddenComputerScienceOption(track));
  }, [journeyTracks]);

  // Track Fallback Adjustments Hook
  useEffect(() => {
    if (!selectedTrackId || !journeyTracks.length) return;

    const matchedTrack = journeyTracks.find((track) => track.id === selectedTrackId && track.source === "bookmark");
    if (!matchedTrack || isHiddenComputerScienceOption(matchedTrack)) {
      const primaryVisible = visibleBookmarkedJourneyTracks[0] || null;
      setSelectedTrackId(primaryVisible?.id || null);
      persistSelectedJourneyTrackId(primaryVisible?.id || null, userId);
    }
  }, [journeyTracks, selectedTrackId, userId, visibleBookmarkedJourneyTracks]);

  // Selected Active Track Tracker Map
  const activeTrack = useMemo(() => {
    if (!visibleBookmarkedJourneyTracks.length) return null;
    return (selectedTrackId && visibleBookmarkedJourneyTracks.find((track) => track.id === selectedTrackId)) || visibleBookmarkedJourneyTracks[0];
  }, [visibleBookmarkedJourneyTracks, selectedTrackId]);

  // Active Journey Progress Aggregator
  const activePhaseState = useMemo(() => {
    if (!activeTrack?.id) {
      return { maxReached: 1 as const, hasStarted: false };
    }

    const baseState = getJourneyPhaseStateFromSnapshot(
      journeyProgressSnapshot,
      activeTrack.id,
      userId,
    );
    const minimumPhase = activeTrack.roadmapId ? 2 : 1;
    const maxReached = normalizeJourneyPhaseNumber(
      Math.max(minimumPhase, baseState.maxReached),
    );

    return {
      maxReached,
      hasStarted: baseState.hasStarted || maxReached > 1,
    };
  }, [journeyProgressSnapshot, activeTrack?.id, userId]);

  // Complete Content Dashboard Aggregator
  const dashboardData = useMemo(() => {
    const trackingEvents = projectActivities.length ? projectActivities : RECENT_ACTIVITY_PLACEHOLDER;
    if (!activeTrack) {
      return {
        activities: trackingEvents,
        progress: 0,
        currentPhase: 1,
        nextPhase: 2,
        nextPhaseDesc: JOURNEY_PHASES[1].description,
      };
    }

    const currentPhase = activePhaseState.maxReached;
    const nextPhase = currentPhase >= 5 ? 5 : currentPhase + 1;
    const progressPercentage = activePhaseState.hasStarted
      ? currentPhase <= 1 ? 10 : toProgressBucket(((currentPhase - 1) / 4) * 100)
      : 0;

    return {
      activities: trackingEvents,
      progress: progressPercentage,
      currentPhase,
      nextPhase,
      nextPhaseDesc: JOURNEY_PHASES[nextPhase - 1]?.description || "No next phase description available.",
    };
  }, [activePhaseState, activeTrack, projectActivities]);

  // Interaction Commands
  const handleSelectTrack = (trackId: string) => {
    setBookmarkActionError(null);
    setSelectedTrackId(trackId);
    persistSelectedJourneyTrackId(trackId, userId);

    const match = visibleBookmarkedJourneyTracks.find((track) => track.id === trackId);
    if (!match) return;

    void syncSelectedJourneyTrackProgress({
      trackId,
      userId,
      roadmapId: match.roadmapId,
      maxReached: normalizeJourneyPhaseNumber(
        Math.max(
          match.roadmapId ? 2 : 1,
          getJourneyPhaseStateFromSnapshot(journeyProgressSnapshot, trackId, userId).maxReached,
        ),
      ),
    });
  };

  const openTrackJourney = (track: JourneyTrackCard) => {
    setBookmarkActionError(null);
    persistSelectedJourneyTrackId(track.id, userId);
    setSelectedTrackId(track.id);
    const currentPhaseTarget = normalizeJourneyPhaseNumber(
      Math.max(
        track.roadmapId ? 2 : 1,
        getJourneyPhaseStateFromSnapshot(journeyProgressSnapshot, track.id, userId).maxReached,
      ),
    );
    void syncSelectedJourneyTrackProgress({
      trackId: track.id,
      userId,
      roadmapId: track.roadmapId,
      maxReached: currentPhaseTarget,
    });

    router.push(buildJourneyPhaseHref(currentPhaseTarget, track.id));
  };

  const handleRemoveTrack = async (track: JourneyTrackCard) => {
    if (!userId) {
      setBookmarkActionError("Please sign in first to manage your saved careers.");
      return;
    }
    if (removingTrackIds.has(track.id)) return;

    setBookmarkActionError(null);
    setRemovingTrackIds((prev) => new Set(prev).add(track.id));

    try {
      const deletion = await removeTrackBookmarksFromUnifiedList({ trackId: track.id, roadmapId: track.roadmapId, userId });
      if (!deletion.success) {
        setBookmarkActionError(deletion.message || "Unable to remove this career right now.");
        return;
      }

      invalidateJourneyTrackCardsCache(userId);
      const remainingTracks = visibleBookmarkedJourneyTracks.filter((item) => item.id !== track.id);
      const nextFallback = remainingTracks[0] || null;

      setJourneyTracks((prev) => prev.filter((item) => item.id !== track.id));

      if (selectedTrackId === track.id) {
        setSelectedTrackId(nextFallback?.id || null);
        persistSelectedJourneyTrackId(nextFallback?.id || null, userId);

        if (nextFallback) {
          void syncSelectedJourneyTrackProgress({
            trackId: nextFallback.id,
            userId,
            roadmapId: nextFallback.roadmapId,
            maxReached: normalizeJourneyPhaseNumber(
              Math.max(
                nextFallback.roadmapId ? 2 : 1,
                getJourneyPhaseStateFromSnapshot(
                  journeyProgressSnapshot,
                  nextFallback.id,
                  userId,
                ).maxReached,
              ),
            ),
          });
        }
      }
    } finally {
      setRemovingTrackIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(track.id);
        return nextSet;
      });
    }
  };

  const handleStartCareerQuiz = async () => {
    if (isStartingCareerQuiz || isAuthLoading) return;

    if (!userId) {
      setCareerQuizError("Please sign in first to start the career quiz.");
      router.push(`/auth/login?redirect=${encodeURIComponent("/features/home")}`);
      return;
    }

    setCareerQuizError(null);
    setIsStartingCareerQuiz(true);

    try {
      const quizId = await startCareerQuizSession(userId);
      router.push(
        buildCareerQuizSelectionHref(quizId, {
          origin: "home",
          returnTo: "/features/home",
        }),
      );
    } catch (err) {
      setCareerQuizError(err instanceof Error ? err.message : "Unable to start the career quiz right now. Please try again.");
      setIsStartingCareerQuiz(false);
    }
  };

  const handleDownload = (downloadUrl?: string | null) => {
    if (!downloadUrl) return;
    const anchorElement = document.createElement("a");
    anchorElement.href = downloadUrl;
    anchorElement.click();
  };

  // Memoized CSS Grid Layout Configuration Objects
  const { gridTemplateColumns, gridTemplateRows } = useMemo(() => {
    return {
      gridTemplateColumns: isLarge ? "1.3fr 1.3fr 1.3fr 0.7fr 0.9fr" : isMedium ? "repeat(2, 1fr) 1.2fr" : "1fr 1.2fr",
      gridTemplateRows: isLarge ? "1.4fr 1.4fr 0.7fr 0.9fr" : isMedium ? "1.2fr repeat(2, 1fr)" : "1.6fr repeat(2, 1fr)",
    };
  }, [isLarge, isMedium]);

  const activeRemovalsRunning = removingTrackIds.size > 0;
  const showJourneyLoadingModule = isLoadingJourneyTracks && !visibleBookmarkedJourneyTracks.length && !activeRemovalsRunning;
  const showJourneyEmptyPlaceholder = !isLoadingJourneyTracks && !visibleBookmarkedJourneyTracks.length && !activeRemovalsRunning;
  const totalJourneyComponentsLoading = isAuthLoading || isLoadingJourneyTracks;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        padding: "var(--space-xl)",
        gridRowGap: "var(--space-lg)",
        gridColumnGap: "var(--space-lg)",
        display: "grid",
        gridTemplateColumns,
        gridTemplateRows,
        overflow: "hidden",
      }}
    >
      {/* Careers Track Container Grid Segment */}
      <CareerCardsContainer
        Title="Your Careers"
        columns={isSmall ? 2 : undefined}
        style={{
          gridArea: isLarge ? "1 / 1 / 3 / 4" : isMedium ? "1 / 1 / 2 / 4" : "1 / 1 / 2 / 3",
        }}
      >
        {careerQuizError && (
          <p style={{ margin: "0 0 1rem 0", color: "#FFD3D3", fontFamily: "var(--font-jura)", fontSize: "0.95rem" }}>
            {careerQuizError}
          </p>
        )}

        {bookmarkActionError && (
          <p style={{ margin: "0 0 1rem 0", color: "#FFD3D3", fontFamily: "var(--font-jura)", fontSize: "0.9rem" }}>
            {bookmarkActionError}
          </p>
        )}

        {journeyError && (
          <p style={{ margin: "0 0 1rem 0", color: "#FFD3D3", fontFamily: "var(--font-jura)", fontSize: "0.9rem" }}>
            {journeyError}
          </p>
        )}

        {showJourneyLoadingModule && (
          <ChoiceCard key="journey-loading" title="Loading Tracks" image="/landing/Rectangle.svg" buttonLabel="Loading..." type="bookmark" disabled />
        )}

        {visibleBookmarkedJourneyTracks.map((track) => {
            const isRemovingTrack = removingTrackIds.has(track.id);

            return (
              <ChoiceCard
                key={track.id}
                isSelected={activeTrack?.id === track.id}
                title={track.title}
                image={
                  track.iconTrackId
                    ? `/tracks/${track.iconTrackId}.svg`
                    : "/tracks/career-quiz.svg"
                }
                description={track.description}
                buttonLabel={isRemovingTrack ? "Removing..." : "Continue"}
                disabled={isRemovingTrack}
                onClick={() => handleSelectTrack(track.id)}
                onAction={() => openTrackJourney(track)}
                onRemove={() => {
                  void handleRemoveTrack(track);
                }}
              />
            );
          })}

        {showJourneyEmptyPlaceholder && (
          <ChoiceCard
            key="journey-empty-state"
            title="No Journey Started Yet"
            description="Take the career quiz to get track recommendations, then continue your 5-phase journey."
            buttonLabel={isStartingCareerQuiz ? "Starting..." : "Take Quiz"}
            type="bookmark"
            disabled={isStartingCareerQuiz || isAuthLoading}
            onAction={() => { void handleStartCareerQuiz(); }}
          />
        )}
      </CareerCardsContainer>

      {/* History Activity Grid Segment */}
      <StackContainer
        Title="Recent Activity"
        style={{
          gridArea: isLarge ? "1 / 4 / 3 / 6" : isMedium ? "2 / 3 / 4 / 4" : "2 / 2 / 4 / 3",
        }}
      >
        {dashboardData.activities.map((act, index) => (
          <ActivityCard
            key={`${act.id}-${index}`}
            date={act.date}
            title={act.id}
            skill={act.key}
            score={act.score}
            provider={act.key}
            onClick={() => {
              if (act.href) {
                router.push(act.href);
              } else {
                handleDownload(act.downloadUrl);
              }
            }}
            variant={
              act.type === "skill" || act.type === "career"
                ? "progress"
                : act.type === "course" || act.type === "job"
                  ? "retake"
                  : "download"
            }
          />
        ))}
      </StackContainer>

      {/* Metrics Performance Cards Grid Segments */}
      <JourneyProgressCard
        percentage={dashboardData.progress}
        isLoading={totalJourneyComponentsLoading}
        style={{
          gridArea: isLarge ? "3 / 1 / 5 / 2" : "2 / 1 / 3 / 2",
        }}
      />

      <PhaseCard
        type="current"
        phaseNumber={isSmall ? String(dashboardData.nextPhase) : String(dashboardData.currentPhase)}
        isLoading={totalJourneyComponentsLoading}
        style={{
          gridArea: isLarge ? "3 / 2 / 5 / 3" : isMedium ? "2 / 2 / 3 / 3" : "3 / 1 / 4 / 2",
        }}
      />

      {!isSmall && (
        <PhaseCard
          type="next"
          phaseNumber={String(dashboardData.nextPhase)}
          isLoading={totalJourneyComponentsLoading}
          desc={dashboardData.nextPhaseDesc || "No next phase description available."}
          style={{
            gridArea: isLarge ? "3 / 3 / 5 / 6" : "3 / 1 / 4 / 3",
          }}
        />
      )}
    </div>
  );
}