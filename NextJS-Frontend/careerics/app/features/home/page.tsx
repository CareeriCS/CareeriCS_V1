"use client";
import ChoiceCard from "@/components/ui/home/choice-card-home";
import { useEffect, useMemo, useState } from "react";
import { RecentActivityCard } from "@/components/ui/home/recent-activity";
import { JourneyProgressCard } from "@/components/ui/home/journey-progress-card";
import { PhaseCard } from "@/components/ui/home/phase-card";
import { CareerCardsContainer } from "@/components/ui/containers/career";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  careerService,
  interviewService,
  jobService,
  skillAssessmentService,
} from "@/services";
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  loadCourseProgress,
  syncCourseProgressFromServer,
} from "@/lib/course-progress";
import { UNIFIED_BOOKMARKS_UPDATED_EVENT } from "@/lib/unified-bookmarks";
import { removeTrackBookmarksFromUnifiedList } from "@/lib/unified-bookmark-actions";
import {
  CAREER_FEATURE_ROUTE,
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
  persistSelectedJourneyTrackId,
  readSelectedJourneyTrackId,
  syncSelectedJourneyTrackProgress,
  toProgressBucket,
} from "@/lib/journey";
import { useResponsive } from "@/hooks/useResponsive";

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

function formatActivityDate(value: string, prefix: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `Recently ${prefix.toLowerCase()}`;
  }

  return `${prefix} ${parsed.toLocaleDateString()}`;
}

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssessmentActivityTitle(sessionType?: string): string {
  const normalized = sessionType?.toLowerCase();
  if (normalized === "skills" || normalized === "skill") {
    return "Skill Assessment";
  }

  if (normalized === "roadmap") {
    return "Roadmap Assessment";
  }

  if (normalized === "section") {
    return "Section Assessment";
  }

  if (normalized === "step") {
    return "Step Assessment";
  }

  return "Assessment Session";
}

function dedupeActivities(activities: RecentActivityItem[]): RecentActivityItem[] {
  const byKey = new Map<string, RecentActivityItem>();

  for (const activity of [...activities].sort((a, b) => b.timestamp - a.timestamp)) {
    if (!byKey.has(activity.key)) {
      byKey.set(activity.key, activity);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [projectActivities, setProjectActivities] = useState<RecentActivityItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isStartingCareerQuiz, setIsStartingCareerQuiz] = useState(false);
  const [careerQuizError, setCareerQuizError] = useState<string | null>(null);
  const [bookmarkActionError, setBookmarkActionError] = useState<string | null>(null);
  const [activityRefreshNonce, setActivityRefreshNonce] = useState(0);
  const [bookmarkRefreshNonce, setBookmarkRefreshNonce] = useState(0);
  const [phaseStateRefreshNonce, setPhaseStateRefreshNonce] = useState(0);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const [journeyTracks, setJourneyTracks] = useState<JourneyTrackCard[]>([]);
  const [journeyProgressSnapshot, setJourneyProgressSnapshot] = useState<JourneyProgressSnapshot>({
    byTrackId: new Map(),
    selectedTrackId: null,
  });
  const [isLoadingJourneyTracks, setIsLoadingJourneyTracks] = useState(false);
  const [removingTrackIds, setRemovingTrackIds] = useState<Set<string>>(new Set());
  const [journeyError, setJourneyError] = useState<string | null>(null);

  const handleStartCareerQuiz = async () => {
    if (isStartingCareerQuiz || isAuthLoading) {
      return;
    }

    if (!userId) {
      setCareerQuizError("Please sign in first to start the career quiz.");
      router.push(`/auth/login?redirect=${encodeURIComponent(CAREER_FEATURE_ROUTE)}`);
      return;
    }

    setCareerQuizError(null);
    setIsStartingCareerQuiz(true);

    try {
      const sessionId = await startCareerQuizSession(userId);
      router.push(buildCareerQuizSelectionHref(sessionId));
    } catch (error) {
      setCareerQuizError(
        error instanceof Error
          ? error.message
          : "Unable to start the career quiz right now. Please try again.",
      );
      setIsStartingCareerQuiz(false);
    }
  };

  useEffect(() => {
    const handleJourneyPhaseStateUpdated = () => {
      invalidateJourneyProgressCache(userId);
      setPhaseStateRefreshNonce((previous) => previous + 1);
    };

    const handleBookmarksUpdated = () => {
      if (!isAuthLoading) {
        invalidateJourneyTrackCardsCache(userId);
        setBookmarkRefreshNonce((previous) => previous + 1);
      }
    };

    window.addEventListener(
      JOURNEY_PHASE_STATE_UPDATED_EVENT,
      handleJourneyPhaseStateUpdated as EventListener,
    );
    window.addEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated as EventListener);
    window.addEventListener("storage", handleBookmarksUpdated);

    return () => {
      window.removeEventListener(
        JOURNEY_PHASE_STATE_UPDATED_EVENT,
        handleJourneyPhaseStateUpdated as EventListener,
      );
      window.removeEventListener(
        UNIFIED_BOOKMARKS_UPDATED_EVENT,
        handleBookmarksUpdated as EventListener,
      );
      window.removeEventListener("storage", handleBookmarksUpdated);
    };
  }, [isAuthLoading, userId]);

  useEffect(() => {
    const handleCourseProgressUpdated = () => {
      setActivityRefreshNonce((previous) => previous + 1);
    };

    window.addEventListener(
      COURSE_PROGRESS_UPDATED_EVENT,
      handleCourseProgressUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        COURSE_PROGRESS_UPDATED_EVENT,
        handleCourseProgressUpdated as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadProjectActivities = async () => {
      if (isAuthLoading) {
        return;
      }

      if (!userId) {
        if (!isCancelled) {
          setProjectActivities([]);
          setIsLoadingActivities(false);
        }
        return;
      }

      if (!isCancelled) {
        setIsLoadingActivities(true);
      }

      try {
        await syncCourseProgressFromServer(userId);

        const [
          assessmentSessionsResponse,
          interviewSessionsResponse,
          careerSessionsResponse,
          jobApplicationsResponse,
        ] = await Promise.all([
          skillAssessmentService.getUserSessions(userId),
          interviewService.getUserSessions(userId),
          careerService.getUserSessions(userId),
          jobService.getUserApplications(userId, {
            limit: RECENT_ACTIVITY_LIMIT,
            sort: "date",
          }),
        ]);

        const careerSessions = (careerSessionsResponse.success
          ? careerSessionsResponse.data ?? []
          : []
        )
          .filter((session) => session.status?.toLowerCase() === "submitted")
          .sort(
            (left, right) =>
              toTimestamp(right.submitted_at ?? right.started_at) -
              toTimestamp(left.submitted_at ?? left.started_at),
          );

        const recentCareerSessions = careerSessions.slice(0, RECENT_ACTIVITY_LIMIT);
        const careerResultsResponses = await Promise.all(
          recentCareerSessions.map((session) => careerService.getCareerResults(session.id)),
        );

        const careerActivities = recentCareerSessions.map((session, index) => {
          const activityDate = session.submitted_at ?? session.started_at ?? "";
          const resultsResponse = careerResultsResponses[index];
          const topTrack =
            resultsResponse.success && resultsResponse.data?.track_scores?.length
              ? resultsResponse.data.track_scores[0]
              : null;

          return {
            key: `career:${session.id}`,
            id: topTrack
              ? `Career Quiz: ${topTrack.track_name}`
              : "Career Quiz Completed",
            date: formatActivityDate(activityDate, "Completed on"),
            type: "career" as const,
            score:
              typeof topTrack?.score === "number"
                ? Math.min(Math.max(Math.round(topTrack.score), 0), 100)
                : undefined,
            timestamp: toTimestamp(activityDate),
            href: buildCareerQuizResultsHref(session.id, topTrack?.track_id),
          };
        });

        const assessmentActivities = (
          assessmentSessionsResponse.success ? assessmentSessionsResponse.data ?? [] : []
        )
          .filter((session) => session.status === "submitted")
          .sort(
            (left, right) =>
              toTimestamp(right.submitted_at ?? right.started_at) -
              toTimestamp(left.submitted_at ?? left.started_at),
          )
          .slice(0, RECENT_ACTIVITY_LIMIT)
          .map((session) => {
            const activityDate = session.submitted_at ?? session.started_at;
            const activityScore =
              typeof session.score === "number"
                ? Math.min(Math.max(Math.round(session.score), 0), 100)
                : undefined;

            return {
              key: `skill:${session.id}`,
              id: `${getAssessmentActivityTitle(session.type)} Completed`,
              date: formatActivityDate(activityDate, "Completed on"),
              type: "skill" as const,
              score: activityScore,
              timestamp: toTimestamp(activityDate),
              href: "/features/skill",
            };
          });

        const interviewActivities = (
          interviewSessionsResponse.success ? interviewSessionsResponse.data ?? [] : []
        )
          .filter((session) => session.status?.toLowerCase() === "completed")
          .sort(
            (left, right) =>
              toTimestamp(right.created_at) -
              toTimestamp(left.created_at),
          )
          .slice(0, RECENT_ACTIVITY_LIMIT)
          .map((session) => ({
            key: `interview:${session.id}`,
            id: `Interview: ${session.name}`,
            date: formatActivityDate(session.created_at ?? "", "Completed on"),
            type: "interview" as const,
            timestamp: toTimestamp(session.created_at),
            href: `/interview-feature/last-analysis?type=${encodeURIComponent(
              session.type || "hr",
            )}&sessionId=${encodeURIComponent(session.id)}&q=1`,
          }));

        const courseActivities = loadCourseProgress(user?.id).completed.map((course) => {
          const activityDate = course.completedAt ?? course.updatedAt ?? "";

          return {
            key: `course:${course.id}`,
            id: `Course Completed: ${course.title}`,
            date: formatActivityDate(activityDate, "Completed on"),
            type: "course" as const,
            timestamp: toTimestamp(activityDate),
            href: "/features/courses",
          };
        });

        const jobActivities = (
          jobApplicationsResponse.success
            ? (jobApplicationsResponse.data?.jobs ?? []).map(mapApiJobToUiModel)
            : []
        )
          .filter((job) => Boolean(job.appliedAt))
          .map((job) => ({
            key: `job:${job.id}`,
            id: `Applied to ${job.title}`,
            date: formatActivityDate(job.appliedAt ?? "", "Applied on"),
            type: "job" as const,
            timestamp: toTimestamp(job.appliedAt),
            href: buildJobDetailsHref(job.id),
          }));

        const merged = dedupeActivities([
          ...careerActivities,
          ...assessmentActivities,
          ...interviewActivities,
          ...courseActivities,
          ...jobActivities,
        ]).slice(0, RECENT_ACTIVITY_LIMIT);

        if (!isCancelled) {
          setProjectActivities(merged);
          setIsLoadingActivities(false);
        }
      } catch {
        if (!isCancelled) {
          setProjectActivities([]);
          setIsLoadingActivities(false);
        }
      }
    };

    void loadProjectActivities();

    return () => {
      isCancelled = true;
    };
  }, [activityRefreshNonce, isAuthLoading, userId, user?.id]);

  useEffect(() => {
    let alive = true;

    const loadTracks = async () => {
      if (isAuthLoading) {
        return;
      }

      if (!userId) {
        setJourneyTracks([]);
        setJourneyProgressSnapshot({
          byTrackId: new Map(),
          selectedTrackId: null,
        });
        setSelectedTrackId(null);
        setJourneyError(null);
        setIsLoadingJourneyTracks(false);
        return;
      }

      setIsLoadingJourneyTracks(true);
      setJourneyError(null);

      try {
        const [tracks, snapshot] = await Promise.all([
          loadJourneyTrackCards(userId),
          loadJourneyProgressSnapshot(userId),
        ]);

        if (!alive) {
          return;
        }

        setJourneyTracks(tracks);
        setJourneyProgressSnapshot(snapshot);
        const bookmarkedTracks = tracks.filter((track) => track.source === "bookmark");

        const persistedTrackId = snapshot.selectedTrackId || readSelectedJourneyTrackId(userId);
        const selectedFromStorage = persistedTrackId
          ? bookmarkedTracks.find((track) => track.id === persistedTrackId) || null
          : null;
        const fallbackTrack = selectedFromStorage || bookmarkedTracks[0] || null;

        setSelectedTrackId(fallbackTrack?.id || null);
        persistSelectedJourneyTrackId(fallbackTrack?.id || null, userId);

        setIsLoadingJourneyTracks(false);
      } catch {
        if (!alive) {
          return;
        }

        setJourneyTracks([]);
        setJourneyProgressSnapshot({
          byTrackId: new Map(),
          selectedTrackId: null,
        });
        setSelectedTrackId(null);
        setJourneyError("Unable to load your journey tracks right now.");
        setIsLoadingJourneyTracks(false);
      }
    };

    void loadTracks();

    return () => {
      alive = false;
    };
  }, [bookmarkRefreshNonce, isAuthLoading, phaseStateRefreshNonce, userId]);

  const recentActivities = useMemo<RecentActivityItem[]>(() => {
    if (!projectActivities.length) {
      return RECENT_ACTIVITY_PLACEHOLDER;
    }

    return projectActivities;
  }, [projectActivities]);

  const bookmarkedJourneyTracks = useMemo(() => {
    return journeyTracks.filter((track) => track.source === "bookmark");
  }, [journeyTracks]);

  const activeTrack = useMemo(() => {
    if (!bookmarkedJourneyTracks.length) {
      return null;
    }

    if (selectedTrackId) {
      const matched = bookmarkedJourneyTracks.find((track) => track.id === selectedTrackId);
      if (matched) {
        return matched;
      }
    }

    return bookmarkedJourneyTracks[0];
  }, [bookmarkedJourneyTracks, selectedTrackId]);

  const activePhaseState = activeTrack?.id
    ? getJourneyPhaseStateFromSnapshot(
        journeyProgressSnapshot,
        activeTrack.id,
        userId,
      )
    : { maxReached: 1 as const, hasStarted: false };

  const dashboardData = useMemo(() => {
    if (!activeTrack) {
      return {
        activities: recentActivities,
        progress: 0,
        currentPhase: 1,
        nextPhase: 2,
        nextPhaseDesc: JOURNEY_PHASES[1].description,
      };
    }

    const currentPhase = activePhaseState.maxReached;
    const nextPhase = currentPhase >= 5 ? 5 : currentPhase + 1;
    const progressValue = activePhaseState.hasStarted
      ? currentPhase <= 1
        ? 10
        : toProgressBucket(((currentPhase - 1) / 4) * 100)
      : 0;

    return {
      activities: recentActivities,
      progress: progressValue,
      currentPhase,
      nextPhase,
      nextPhaseDesc: JOURNEY_PHASES[nextPhase - 1]?.description || "No next phase description available.",
    };
  }, [activePhaseState.hasStarted, activePhaseState.maxReached, activeTrack, recentActivities]);

  const handleSelectTrack = (trackId: string) => {
    setBookmarkActionError(null);
    setSelectedTrackId(trackId);
    persistSelectedJourneyTrackId(trackId, userId);

    const selectedTrack = bookmarkedJourneyTracks.find((track) => track.id === trackId);
    if (!selectedTrack) {
      return;
    }

    void syncSelectedJourneyTrackProgress({
      trackId,
      userId,
      roadmapId: selectedTrack.roadmapId,
      maxReached: getJourneyPhaseStateFromSnapshot(
        journeyProgressSnapshot,
        trackId,
        userId,
      ).maxReached,
    });
  };

  const openTrackJourney = (track: JourneyTrackCard) => {
    setBookmarkActionError(null);
    persistSelectedJourneyTrackId(track.id, userId);
    setSelectedTrackId(track.id);
    void syncSelectedJourneyTrackProgress({
      trackId: track.id,
      userId,
      roadmapId: track.roadmapId,
      maxReached: getJourneyPhaseStateFromSnapshot(
        journeyProgressSnapshot,
        track.id,
        userId,
      ).maxReached,
    });

    const targetPhase = getJourneyPhaseStateFromSnapshot(
      journeyProgressSnapshot,
      track.id,
      userId,
    ).maxReached;
    router.push(buildJourneyPhaseHref(targetPhase, track.id));
  };

  const handleRemoveTrack = async (track: JourneyTrackCard) => {
    if (!userId) {
      setBookmarkActionError("Please sign in first to manage your saved careers.");
      return;
    }

    if (removingTrackIds.has(track.id)) {
      return;
    }

    setBookmarkActionError(null);
    setRemovingTrackIds((previous) => new Set(previous).add(track.id));

    try {
      const removal = await removeTrackBookmarksFromUnifiedList({
        trackId: track.id,
        roadmapId: track.roadmapId,
        userId,
      });

      if (!removal.success) {
        setBookmarkActionError(removal.message || "Unable to remove this career right now.");
        return;
      }

      invalidateJourneyTrackCardsCache(userId);

      const currentTracks = bookmarkedJourneyTracks;
      const currentIndex = currentTracks.findIndex((item) => item.id === track.id);
      const remainingTracks = currentTracks.filter((item) => item.id !== track.id);
      const fallbackTrack = remainingTracks[currentIndex] || remainingTracks[currentIndex - 1] || remainingTracks[0] || null;

      setJourneyTracks((previous) => previous.filter((item) => item.id !== track.id));

      if (selectedTrackId === track.id) {
        setSelectedTrackId(fallbackTrack?.id || null);
        persistSelectedJourneyTrackId(fallbackTrack?.id || null, userId);

        if (fallbackTrack) {
          void syncSelectedJourneyTrackProgress({
            trackId: fallbackTrack.id,
            userId,
            roadmapId: fallbackTrack.roadmapId,
            maxReached: getJourneyPhaseStateFromSnapshot(
              journeyProgressSnapshot,
              fallbackTrack.id,
              userId,
            ).maxReached,
          });
        }
      }
    } finally {
      setRemovingTrackIds((previous) => {
        const next = new Set(previous);
        next.delete(track.id);
        return next;
      });
    }
  };

  const isRemovingAnyTrack = removingTrackIds.size > 0;
  const shouldShowJourneyLoadingCard =
    isLoadingJourneyTracks && !bookmarkedJourneyTracks.length && !isRemovingAnyTrack;
  const showJourneyPlaceholder =
    !isLoadingJourneyTracks && !bookmarkedJourneyTracks.length && !isRemovingAnyTrack;
  const showSavedCareerPlaceholder = showJourneyPlaceholder && journeyTracks.length > 0;
  const isLoadingJourneyWidgets = isAuthLoading || isLoadingJourneyTracks;

  const {
    isLarge,
    isMedium,
    isSmall,
  } = useResponsive();

  const gridTemplateColumns = isLarge
    ? "1.3fr 1.3fr 1.3fr 0.7fr 0.9fr"
    : isMedium
      ? "repeat(2, 1fr) 1.2fr"
      : "1fr 1.2fr";

  const gridTemplateRows = isLarge
    ? "1.4fr 1.4fr 0.7fr 0.9fr"
    : isMedium
      ? "1.2fr repeat(2, 1fr)"
      : "1.6fr repeat(2, 1fr)";


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
      <CareerCardsContainer
        Title="Your Careers"
        columns={isSmall ? 2 : undefined}
        style={{
          gridArea: isLarge
            ? "1 / 1 / 3 / 4"
            : isMedium
              ? "1 / 1 / 2 / 4"
              : "1 / 1 / 2 / 3",
        }}
      >
        {careerQuizError ? (
          <p
            style={{
              margin: "0 0 1rem 0",
              color: "#FFD3D3",
              fontFamily: "var(--font-jura)",
              fontSize: "0.95rem",
            }}
          >
            {careerQuizError}
          </p>
        ) : null}

        {bookmarkActionError ? (
          <p
            style={{
              margin: "0 0 1rem 0",
              color: "#FFD3D3",
              fontFamily: "var(--font-jura)",
              fontSize: "0.9rem",
            }}
          >
            {bookmarkActionError}
          </p>
        ) : null}

        {journeyError ? (
          <p
            style={{
              margin: "0 0 1rem 0",
              color: "#FFD3D3",
              fontFamily: "var(--font-jura)",
              fontSize: "0.9rem",
            }}
          >
            {journeyError}
          </p>
        ) : null}

        {shouldShowJourneyLoadingCard ? (
          <ChoiceCard
            key="journey-loading"
            title="Loading Tracks"
            image="/landing/Rectangle.svg"
            buttonLabel="Loading..."
            type="bookmark"
            disabled
          />
        ) : null}

        {bookmarkedJourneyTracks.map((track) => {
          const isRemovingTrack = removingTrackIds.has(track.id);

          return (
            <ChoiceCard
              key={track.id}
              isSelected={activeTrack?.id === track.id}
              title={track.title}
              image="/landing/Rectangle.svg"
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

{showJourneyPlaceholder ? (
  <ChoiceCard
    key="journey-empty-state"
    title="No Journey Started Yet"
    description="Take the career quiz to get track recommendations, then continue your 5-phase journey."
    buttonLabel={isStartingCareerQuiz ? "Starting..." : "Take Quiz"}
    type="bookmark"
    disabled={isStartingCareerQuiz || isAuthLoading}
    onAction={() => {
      void handleStartCareerQuiz();
    }}
  />
) : null}
      </CareerCardsContainer>

      <RecentActivityCard
        activities={dashboardData.activities}
        isLoading={isLoadingActivities}
        style={{
          gridArea: isLarge
            ? "1 / 4 / 3 / 6"
            : isMedium
              ? "2 / 3 / 4 / 4"
              : "2 / 2 / 4 / 3",
        }}
      />

      <JourneyProgressCard
        percentage={dashboardData.progress}
        isLoading={isLoadingJourneyWidgets}
        style={{
          gridArea: isLarge
            ? "3 / 1 / 5 / 2"
            : "2 / 1 / 3 / 2",
        }}
      />

      <PhaseCard
        type="current"
        phaseNumber={isSmall ? String(dashboardData.nextPhase) : String(dashboardData.currentPhase)}
        isLoading={isLoadingJourneyWidgets}
        style={{
          gridArea: isLarge
            ? "3 / 2 / 5 / 3"
            : isMedium
              ? "2 / 2 / 3 / 3"
              : "3 / 1 / 4 / 2",
        }}
      />

      {!isSmall && (
        <PhaseCard
          type="next"
          phaseNumber={String(dashboardData.nextPhase)}
          isLoading={isLoadingJourneyWidgets}
        desc={
            dashboardData.nextPhaseDesc ||
            "No next phase description available."
          }
          style={{
            gridArea: isLarge
              ? "3 / 3 / 5 / 6"
              : "3 / 1 / 4 / 3",
          }}
        />
      )}
    </div>
  );
}
