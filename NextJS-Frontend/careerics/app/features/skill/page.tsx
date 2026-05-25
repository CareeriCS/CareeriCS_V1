"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SkillFilters, {
  type SkillFilterTrackOption,
  type SkillFilterType,
} from "@/components/ui/SkillFilters";
import { LearningSkillsCard, MoreSkillsCard, PastTestsCard } from "@/components/ui/cvArchive";
import SkillConfirmPopup from "@/components/ui/skillConfirmPopup";
import {
  getUnifiedBookmarks,
  MAX_UNIFIED_BOOKMARKS,
  UNIFIED_BOOKMARKS_UPDATED_EVENT,
} from "@/lib/unified-bookmarks";
import { useAuth } from "@/providers/auth-provider";
import { roadmapService, skillAssessmentService, skillsService } from "@/services";
import type {
  ApiResponse,
  APIAssessmentSessionSummary,
  APIAssessmentSessionType,
  APISkill,
  CurrentRoadmapLearning,
  RoadmapListItem,
  RoadmapRead,
} from "@/types";
import { RectangularCard } from "@/components/ui/rectangular-card";
import { ActivityCard } from "@/components/ui/activity-card";
import { InlineContainer } from "@/components/ui/containers/inline";
import { FlexContainer } from "@/components/ui/containers/flex";
import { StackContainer } from "@/components/ui/containers/stack";

type AssessmentTarget = {
  id: string;
  label: string;
  subLabel?: string;
  sessionType: APIAssessmentSessionType;
  sectionId?: string;
  isCurrent?: boolean;
};

type CachedApiRequest<T> = {
  expiresAt: number;
  promise: Promise<ApiResponse<T>>;
};

type SessionTitleLookup = {
  roadmapTitleById: Map<string, string>;
  sectionTitleById: Map<string, string>;
  stepTitleById: Map<string, string>;
};

const LAST_ACTIVE_ROADMAP_STORAGE_KEY = "roadmap:last-active-id";
const COMPUTER_SCIENCE_TRACK_TITLE = "computer science";
const GENERAL_SKILLS_TRACK_LABEL = "General Skills";
const CURRENT_LEARNING_CACHE_TTL_MS = 15_000;
const ROADMAP_DETAILS_CACHE_TTL_MS = 60_000;

function normalizeEntityId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeRoadmapListPayload(payload: unknown): RoadmapListItem[] {
  if (Array.isArray(payload)) {
    return payload as RoadmapListItem[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "roadmaps" in payload &&
    Array.isArray((payload as { roadmaps: unknown }).roadmaps)
  ) {
    return (payload as { roadmaps: RoadmapListItem[] }).roadmaps;
  }

  return [];
}

function isComputerScienceTrackTitle(title?: string | null): boolean {
  return normalizeTextForMatch(title || "") === COMPUTER_SCIENCE_TRACK_TITLE;
}

function normalizeSessionType(sessionType?: string | null): APIAssessmentSessionType {
  if (sessionType === "skill") {
    return "skills";
  }

  if (
    sessionType === "skills" ||
    sessionType === "roadmap" ||
    sessionType === "section" ||
    sessionType === "step"
  ) {
    return sessionType;
  }

  return "skills";
}

function doesSessionMatchTarget(
  session: APIAssessmentSessionSummary,
  target: AssessmentTarget,
): boolean {
  const type = normalizeSessionType(session.type);
  if (type !== target.sessionType) {
    return false;
  }

  if (type === "skills") {
    return session.skill_id === target.id;
  }

  if (type === "roadmap") {
    return session.roadmap_id === target.id;
  }

  if (type === "section") {
    return session.section_id === target.id;
  }

  return session.step_id === target.id;
}

function resolveSessionTitle(
  session: APIAssessmentSessionSummary,
  skillById: Map<string, APISkill>,
  lookup?: SessionTitleLookup,
): string {
  const type = normalizeSessionType(session.type);
  if (type === "skills") {
    return skillById.get(session.skill_id || "")?.skill_name || "Skill Assessment";
  }

  if (type === "roadmap") {
    return lookup?.roadmapTitleById.get(session.roadmap_id || "") || "Roadmap Assessment";
  }

  if (type === "section") {
    return lookup?.sectionTitleById.get(session.section_id || "") || "General Topic";
  }

  if (type === "step") {
    return lookup?.stepTitleById.get(session.step_id || "") || "Specific Skill";
  }

  return "Roadmap Assessment";
}

function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextTokens(value: string): string[] {
  return normalizeTextForMatch(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function doesSkillMatchContext(skillName: string, contextTexts: string[]): boolean {
  const normalizedSkill = normalizeTextForMatch(skillName);
  if (!normalizedSkill) {
    return false;
  }

  const skillTokens = splitTextTokens(normalizedSkill);
  if (!skillTokens.length) {
    return false;
  }

  return contextTexts.some((context) => {
    const normalizedContext = normalizeTextForMatch(context);
    if (!normalizedContext) {
      return false;
    }

    if (normalizedContext.includes(normalizedSkill) || normalizedSkill.includes(normalizedContext)) {
      return true;
    }

    const contextTokens = splitTextTokens(normalizedContext);
    if (!contextTokens.length) {
      return false;
    }

    return skillTokens.some((token) => contextTokens.includes(token));
  });
}

export default function SkillAssessment() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [skills, setSkills] = useState<APISkill[]>([]);
  const [sessions, setSessions] = useState<APIAssessmentSessionSummary[]>([]);
  const [roadmapTracks, setRoadmapTracks] = useState<RoadmapListItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [trackHelperText, setTrackHelperText] = useState("");
  const [selectedSkillType, setSelectedSkillType] = useState<SkillFilterType>("general");

  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapRead | null>(null);
  const [, setCurrentLearning] = useState<CurrentRoadmapLearning | null>(null);
  const [bookmarkedCurrentTargets, setBookmarkedCurrentTargets] = useState<AssessmentTarget[]>([]);
  const [bookmarkedTargetsHint, setBookmarkedTargetsHint] = useState("");
  const [sessionRoadmapsById, setSessionRoadmapsById] = useState<Record<string, RoadmapRead>>({});
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedLearningTargetId, setSelectedLearningTargetId] = useState("");
  const [selectedMoreSkillId, setSelectedMoreSkillId] = useState("");

  const [pendingTarget, setPendingTarget] = useState<AssessmentTarget | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const currentLearningRequestCacheRef =
    useRef<Map<string, CachedApiRequest<CurrentRoadmapLearning>>>(new Map());
  const roadmapByIdRequestCacheRef = useRef<Map<string, CachedApiRequest<RoadmapRead>>>(new Map());

  const isGeneralSkillsMode = !selectedTrackId;
  const getCurrentLearningCached = useCallback((roadmapId?: string) => {
    if (!user?.id) {
      return Promise.resolve({
        data: null as unknown as CurrentRoadmapLearning,
        success: false,
        message: "Missing user id",
      });
    }

    const cacheKey = roadmapId ? `roadmap:${roadmapId}` : "roadmap:current";
    const now = Date.now();
    const cached = currentLearningRequestCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.promise;
    }

    const requestPromise = roadmapService
      .getCurrentRoadmapLearning(user.id, roadmapId)
      .then((response) => {
        if (!response.success) {
          currentLearningRequestCacheRef.current.delete(cacheKey);
        }
        return response;
      });

    currentLearningRequestCacheRef.current.set(cacheKey, {
      expiresAt: now + CURRENT_LEARNING_CACHE_TTL_MS,
      promise: requestPromise,
    });

    return requestPromise;
  }, [user]);

  const getRoadmapByIdCached = useCallback((roadmapId: string) => {
    const cacheKey = roadmapId;
    const now = Date.now();
    const cached = roadmapByIdRequestCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.promise;
    }

    const requestPromise = roadmapService.getRoadmapById(roadmapId).then((response) => {
      if (!response.success) {
        roadmapByIdRequestCacheRef.current.delete(cacheKey);
      }
      return response;
    });

    roadmapByIdRequestCacheRef.current.set(cacheKey, {
      expiresAt: now + ROADMAP_DETAILS_CACHE_TTL_MS,
      promise: requestPromise,
    });

    return requestPromise;
  }, []);

  useEffect(() => {
    currentLearningRequestCacheRef.current.clear();
    roadmapByIdRequestCacheRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    let alive = true;

    const sessionRoadmapIds = Array.from(
      new Set(
        sessions
          .filter((session) => {
            const type = normalizeSessionType(session.type);
            return (
              (type === "roadmap" || type === "section" || type === "step") &&
              Boolean(session.roadmap_id)
            );
          })
          .map((session) => String(session.roadmap_id)),
      ),
    );

    if (!sessionRoadmapIds.length) {
      return () => {
        alive = false;
      };
    }

    const missingRoadmapIds = sessionRoadmapIds.filter((roadmapId) => {
      if (selectedRoadmap?.id === roadmapId) {
        return false;
      }
      return !sessionRoadmapsById[roadmapId];
    });

    if (!missingRoadmapIds.length) {
      return () => {
        alive = false;
      };
    }

    const loadSessionRoadmaps = async () => {
      const loadedEntries = await Promise.all(
        missingRoadmapIds.map(async (roadmapId) => {
          const response = await getRoadmapByIdCached(roadmapId);
          if (!response.success || !response.data) {
            return null;
          }

          return [roadmapId, response.data] as const;
        }),
      );

      if (!alive) {
        return;
      }

      const resolvedEntries = loadedEntries.filter(
        (entry): entry is readonly [string, RoadmapRead] => Boolean(entry),
      );
      if (!resolvedEntries.length) {
        return;
      }

      setSessionRoadmapsById((previous) => {
        const next = { ...previous };
        let hasChanges = false;

        for (const [roadmapId, roadmap] of resolvedEntries) {
          if (next[roadmapId] !== roadmap) {
            next[roadmapId] = roadmap;
            hasChanges = true;
          }
        }

        return hasChanges ? next : previous;
      });
    };

    void loadSessionRoadmaps();

    return () => {
      alive = false;
    };
  }, [getRoadmapByIdCached, selectedRoadmap?.id, sessionRoadmapsById, sessions]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let alive = true;

    const loadData = async () => {
      setIsLoading(true);
      setError("");

      const [skillsRes, roadmapsRes, sessionsRes] = await Promise.all([
        skillsService.listSkills(),
        roadmapService.listRoadmaps(),
        user?.id
          ? skillAssessmentService.getUserSessions(user.id)
          : Promise.resolve({ success: true, data: [] as APIAssessmentSessionSummary[] }),
      ]);

      if (!alive) {
        return;
      }

      if (!skillsRes.success || !skillsRes.data) {
        setError(skillsRes.message || "Failed to load skills.");
        setIsLoading(false);
        return;
      }

      if (!roadmapsRes.success) {
        setError(roadmapsRes.message || "Failed to load roadmap tracks.");
        setSkills(skillsRes.data);
        setSessions([]);
        setRoadmapTracks([]);
        setSelectedTrackId("");
        setTrackHelperText("Roadmaps unavailable. Showing all skills from the database.");
        setIsLoading(false);
        return;
      }

      const tracks = normalizeRoadmapListPayload(roadmapsRes.data);
      const resolvedSessions = sessionsRes.success && sessionsRes.data ? sessionsRes.data : [];
      setSkills(skillsRes.data);
      setRoadmapTracks(tracks);
      setSessions(resolvedSessions);

      if (!tracks.length) {
        setSelectedTrackId("");
        setTrackHelperText("No roadmap tracks found. Showing all skills from the database.");
        setIsLoading(false);
        return;
      }

      const defaultTrack =
        tracks.find((track) => isComputerScienceTrackTitle(track.title)) || tracks[0];
      setSelectedTrackId(defaultTrack?.id || "");
      setTrackHelperText("");

      setIsLoading(false);
    };

    void loadData();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, user?.id]);

  useEffect(() => {
    if (!selectedTrackId || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LAST_ACTIVE_ROADMAP_STORAGE_KEY, selectedTrackId);
  }, [selectedTrackId]);

  const handleTrackChange = (trackId: string) => {
    setSelectedTrackId(trackId);
    setTrackHelperText("");
  };

  useEffect(() => {
    let alive = true;

    const loadTrackContext = async () => {
      if (!selectedTrackId) {
        setSelectedRoadmap(null);
        setCurrentLearning(null);
        setSelectedSectionId("");
        return;
      }

      const roadmapRes = await getRoadmapByIdCached(selectedTrackId);
      if (!alive) {
        return;
      }

      if (!roadmapRes.success || !roadmapRes.data) {
        setSelectedRoadmap(null);
        setCurrentLearning(null);
        setSelectedSectionId("");
        setError(roadmapRes.message || "Failed to load selected track roadmap.");
        return;
      }

      const roadmap = roadmapRes.data;
      setSelectedRoadmap(roadmap);

      const sections = roadmap.sections.slice().sort((a, b) => a.order - b.order);
      const fallbackSectionId = sections[0]?.id || "";

      if (!user?.id) {
        setCurrentLearning(null);
        setSelectedSectionId((prev) => {
          if (prev && sections.some((section) => section.id === prev)) {
            return prev;
          }
          return fallbackSectionId;
        });
        return;
      }

      const currentRes = await getCurrentLearningCached(selectedTrackId);
      if (!alive) {
        return;
      }

      if (currentRes.success && currentRes.data) {
        const current = currentRes.data;
        setCurrentLearning(current);

        const preferredSectionId = current.section_id || fallbackSectionId;
        const sectionExists = preferredSectionId
          ? sections.some((section) => section.id === preferredSectionId)
          : false;

        const resolvedSectionId = sectionExists ? preferredSectionId : fallbackSectionId;
        setSelectedSectionId(resolvedSectionId);
      } else {
        setCurrentLearning(null);
        setSelectedSectionId((prev) => {
          if (prev && sections.some((section) => section.id === prev)) {
            return prev;
          }
          return fallbackSectionId;
        });
      }
    };

    void loadTrackContext();

    return () => {
      alive = false;
    };
  }, [getCurrentLearningCached, getRoadmapByIdCached, selectedTrackId, user?.id]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let alive = true;

    const loadBookmarkedCurrentTargets = async () => {
      if (!user?.id) {
        setBookmarkedCurrentTargets([]);
        setBookmarkedTargetsHint("");
        return;
      }

      const unifiedRoadmapBookmarks = Array.from(
        new Map(
          getUnifiedBookmarks(user.id)
            .filter((entry) => entry.kind === "roadmap" && Boolean(entry.entity_id))
            .map((entry) => [normalizeEntityId(entry.entity_id), entry] as const),
        ).values(),
      );

      const unifiedRoadmapBookmarkById = new Map(
        unifiedRoadmapBookmarks.map((entry) => [normalizeEntityId(entry.entity_id), entry] as const),
      );

      const roadmapTitleById = new Map(
        roadmapTracks.map((track) => [normalizeEntityId(track.id), track.title] as const),
      );

      const mergedRoadmapIds: string[] = [];
      const mergedRoadmapIdSet = new Set<string>();

      const appendRoadmapId = (candidateRoadmapId: unknown) => {
        const roadmapId = String(candidateRoadmapId ?? "").trim();
        const normalizedRoadmapId = normalizeEntityId(roadmapId);
        if (!normalizedRoadmapId || mergedRoadmapIdSet.has(normalizedRoadmapId)) {
          return;
        }

        mergedRoadmapIdSet.add(normalizedRoadmapId);
        mergedRoadmapIds.push(roadmapId);
      };

      let sourceHint = "";

      const backendBookmarksResponse = await roadmapService.getUserRoadmapBookmarks(user.id);
      if (backendBookmarksResponse.success && backendBookmarksResponse.data?.bookmarks) {
        for (const bookmark of backendBookmarksResponse.data.bookmarks) {
          appendRoadmapId(bookmark.roadmap_id);
        }
      } else {
        sourceHint = "Backend bookmark sync is unavailable. Showing locally saved roadmap bookmarks.";
      }

      for (const bookmark of unifiedRoadmapBookmarks) {
        appendRoadmapId(bookmark.entity_id);
      }

      const roadmapIds = mergedRoadmapIds.slice(0, MAX_UNIFIED_BOOKMARKS);
      if (!roadmapIds.length) {
        setBookmarkedCurrentTargets([]);
        setBookmarkedTargetsHint(sourceHint || "No roadmap bookmarks found.");
        return;
      }

      const targetCandidates: AssessmentTarget[] = await Promise.all(
        roadmapIds.map(async (roadmapId): Promise<AssessmentTarget> => {
          const normalizedRoadmapId = normalizeEntityId(roadmapId);
          const fallbackRoadmapTitle =
            unifiedRoadmapBookmarkById.get(normalizedRoadmapId)?.title ||
            roadmapTitleById.get(normalizedRoadmapId) ||
            "Roadmap";

          const currentResponse = await getCurrentLearningCached(roadmapId);
          const current = currentResponse.success ? currentResponse.data : null;

          if (current?.step_id) {
            const roadmapTitle = current.roadmap_title || fallbackRoadmapTitle;
            const stepTitle = current.step_title?.trim();
            const sectionTitle = current.section_title?.trim();
            const displayLabel = stepTitle || sectionTitle || roadmapTitle;
            const displaySubLabel =
              normalizeTextForMatch(displayLabel) === normalizeTextForMatch(roadmapTitle)
                ? undefined
                : roadmapTitle;

            return {
              id: current.step_id,
              label: displayLabel,
              subLabel: displaySubLabel,
              sessionType: "step" as const,
              sectionId: current.section_id || undefined,
              isCurrent: true,
            };
          }

          const roadmapResponse = await getRoadmapByIdCached(roadmapId);
          const roadmap = roadmapResponse.success ? roadmapResponse.data : null;
          if (!roadmap) {
            return {
              id: roadmapId,
              label: fallbackRoadmapTitle,
              sessionType: "roadmap",
              isCurrent: false,
            };
          }

          const orderedSections = roadmap.sections.slice().sort((a, b) => a.order - b.order);
          const firstSection = orderedSections[0];
          const firstSectionTitle = firstSection?.title?.trim();

          if (!firstSection) {
            return {
              id: roadmapId,
              label: roadmap.title || fallbackRoadmapTitle,
              sessionType: "roadmap",
              isCurrent: false,
            };
          }

          return {
            id: firstSection.id,
            label: firstSectionTitle || fallbackRoadmapTitle,
            subLabel: firstSectionTitle ? roadmap.title : undefined,
            sessionType: "section" as const,
            sectionId: firstSection.id,
            isCurrent: false,
          };
        }),
      );

      if (!alive) {
        return;
      }

      setBookmarkedCurrentTargets(targetCandidates);

      if (!targetCandidates.length) {
        setBookmarkedTargetsHint(sourceHint || "No roadmap bookmarks found.");
        return;
      }

      if (sourceHint) {
        setBookmarkedTargetsHint(sourceHint);
        return;
      }

      if (!targetCandidates.some((target) => target.isCurrent)) {
        setBookmarkedTargetsHint("Showing starter steps for your bookmarked roadmaps.");
        return;
      }

      setBookmarkedTargetsHint("");
    };

    const handleBookmarksUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      const eventUserId = customEvent.detail?.userId;

      if (
        eventUserId &&
        user?.id &&
        eventUserId !== user.id &&
        eventUserId !== "guest"
      ) {
        return;
      }

      void loadBookmarkedCurrentTargets();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!user?.id) {
        return;
      }

      const key = event.key || "";
      if (key && key !== `unified-bookmarks:${user.id}`) {
        return;
      }

      void loadBookmarkedCurrentTargets();
    };

    void loadBookmarkedCurrentTargets();

    if (typeof window !== "undefined") {
      window.addEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated);
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated);
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, [getCurrentLearningCached, getRoadmapByIdCached, isAuthLoading, roadmapTracks, user?.id]);

  const skillById = useMemo(() => {
    const map = new Map<string, APISkill>();
    for (const skill of skills) {
      map.set(skill.id, skill);
    }
    return map;
  }, [skills]);

  const sessionTitleLookup = useMemo<SessionTitleLookup>(() => {
    const roadmapTitleById = new Map<string, string>();
    const sectionTitleById = new Map<string, string>();
    const stepTitleById = new Map<string, string>();

    const roadmaps = Object.values(sessionRoadmapsById);
    if (
      selectedRoadmap &&
      !roadmaps.some((roadmap) => String(roadmap.id) === String(selectedRoadmap.id))
    ) {
      roadmaps.push(selectedRoadmap);
    }

    for (const roadmap of roadmaps) {
      roadmapTitleById.set(roadmap.id, roadmap.title || "Roadmap Assessment");
      for (const section of roadmap.sections) {
        sectionTitleById.set(section.id, section.title);
        for (const step of section.steps) {
          stepTitleById.set(step.id, step.title);
        }
      }
    }

    return {
      roadmapTitleById,
      sectionTitleById,
      stepTitleById,
    };
  }, [selectedRoadmap, sessionRoadmapsById]);

  const trackOptions: SkillFilterTrackOption[] = useMemo(
    () =>
      roadmapTracks.map((track) => ({
        id: track.id,
        title: isComputerScienceTrackTitle(track.title)
          ? GENERAL_SKILLS_TRACK_LABEL
          : track.title,
      })),
    [roadmapTracks],
  );

  const sortedSections = useMemo(
    () => selectedRoadmap?.sections.slice().sort((a, b) => a.order - b.order) || [],
    [selectedRoadmap],
  );

  useEffect(() => {
    if (!sortedSections.length) {
      return;
    }

    if (!selectedSectionId || !sortedSections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(sortedSections[0].id);
    }
  }, [selectedSectionId, sortedSections]);

  const learningTargets = useMemo<AssessmentTarget[]>(() => bookmarkedCurrentTargets, [bookmarkedCurrentTargets]);

  useEffect(() => {
    if (!learningTargets.length) {
      setSelectedLearningTargetId("");
      return;
    }

    if (!learningTargets.some((target) => target.id === selectedLearningTargetId)) {
      setSelectedLearningTargetId(learningTargets[0].id);
    }
  }, [learningTargets, selectedLearningTargetId]);

  const learningItems = useMemo(
    () => learningTargets.map((target) => ({
      id: target.id,
      label: target.label,
      subLabel: target.subLabel,
      isCurrent: target.isCurrent,
    })),
    [learningTargets],
  );

  const roadmapSectionContextTexts = useMemo(() => {
    if (isGeneralSkillsMode || !sortedSections.length) {
      return [] as string[];
    }

    const contextParts: string[] = [];
    for (const section of sortedSections) {
      contextParts.push(section.title);
      if (section.description) {
        contextParts.push(section.description);
      }
    }

    return contextParts;
  }, [isGeneralSkillsMode, sortedSections]);

  const roadmapStepContextTexts = useMemo(() => {
    if (isGeneralSkillsMode || !sortedSections.length) {
      return [] as string[];
    }

    const contextParts: string[] = [];
    for (const section of sortedSections) {
      for (const step of section.steps) {
        contextParts.push(step.title);
        if (step.description) {
          contextParts.push(step.description);
        }

        for (const resource of step.resources || []) {
          if (resource.title) {
            contextParts.push(resource.title);
          }
          if (resource.resourceType) {
            contextParts.push(resource.resourceType);
          }
        }
      }
    }

    return contextParts;
  }, [isGeneralSkillsMode, sortedSections]);

  const filteredSkills = useMemo(() => {
    if (isGeneralSkillsMode || !selectedRoadmap) {
      return skills;
    }

    const contextTexts =
      selectedSkillType === "general" ? roadmapSectionContextTexts : roadmapStepContextTexts;
    if (!contextTexts.length) {
      return skills;
    }

    const matched = skills.filter((skill) => doesSkillMatchContext(skill.skill_name, contextTexts));
    return matched.length ? matched : skills;
  }, [
    isGeneralSkillsMode,
    roadmapSectionContextTexts,
    roadmapStepContextTexts,
    selectedRoadmap,
    selectedSkillType,
    skills,
  ]);

  const moreSkills = useMemo(() => filteredSkills.map((skill) => skill.skill_name), [filteredSkills]);

  useEffect(() => {
    if (!selectedMoreSkillId) {
      return;
    }

    if (!filteredSkills.some((skill) => skill.id === selectedMoreSkillId)) {
      setSelectedMoreSkillId("");
    }
  }, [filteredSkills, selectedMoreSkillId]);

  const selectedMoreName = skillById.get(selectedMoreSkillId)?.skill_name || "";
  const pendingTargetName = pendingTarget?.label || "";

  const allPastTests = useMemo(
    () =>
      sessions
        .filter((session) => session.status === "submitted")
        .sort((a, b) => {
          const aSubmittedAt =
            new Date(a.submitted_at || a.started_at).getTime() || 0;
          const bSubmittedAt =
            new Date(b.submitted_at || b.started_at).getTime() || 0;
          return bSubmittedAt - aSubmittedAt;
        })
        .slice(0, 20)
        .map((session, index, arr) => {
          const sessionTitle = resolveSessionTitle(
            session,
            skillById,
            sessionTitleLookup
          ).trim();

          const sessionTitleKey = sessionTitle
            ? sessionTitle.replace(/\s+/g, "_")
            : "assessment";

          const reversedIndex = arr.length - index;

          const formattedIndex = String(reversedIndex).padStart(3, "0");

          return {
            id: formattedIndex,
            title: `Test_${formattedIndex}`,
            skill: sessionTitleKey,
            score: session.score,
          };
        }),
    [sessions, sessionTitleLookup, skillById]
  );

  const openConfirmForTarget = (target: AssessmentTarget) => {
    if (isAuthLoading || !user?.id || isLoading || isStarting) {
      return;
    }

    setSelectedLearningTargetId(target.id);
    setPendingTarget(target);
    setIsConfirmOpen(true);
  };

  const handleStartAssessment = (target: AssessmentTarget,
    questions: number) => {
    if (!user?.id || !target.id) {
      return;
    }

    setIsStarting(true);

    const params = new URLSearchParams({
      targetId: target.id,
      targetName: target.label,
      sessionType: target.sessionType,
      numQuestions: String(questions),
    });

    if (target.sessionType === "skills") {
      params.set("skillId", target.id);
      params.set("skillName", target.label);
      setSelectedMoreSkillId(target.id);
    }

    const inProgressSession = sessions.find(
      (session) => session.status === "in_progress" && doesSessionMatchTarget(session, target),
    );
    if (inProgressSession) {
      params.set("sessionId", inProgressSession.id);
    }

    setIsConfirmOpen(false);
    setPendingTarget(null);
    router.push(`/skill-feature/questions?${params.toString()}`);
    setIsStarting(false);
  };


  const nextTestCode = useMemo(() => {
    const submitted = sessions.filter(
      (s) => s.status === "submitted"
    );

    const count = submitted.length + 1;

    return `Test_${String(count).padStart(3, "0")}`;
  }, [sessions]);

  const [search, setSearch] = useState("");

  const filteredMoreSkills = moreSkills.filter((skill) =>
    skill.toLowerCase().includes(search.toLowerCase())
  );



  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr) repeat(2, 2fr)",
          gridTemplateRows: "1.5fr repeat(5, 1fr)",
          columnGap: "25px",
          rowGap: "20px",
          height: "100%",
          width: "100%",
          padding: "40px",
        }}
      >
        <SkillFilters
            tracks={trackOptions}
            selectedTrackId={selectedTrackId}
            onTrackChange={handleTrackChange}
            skillType={selectedSkillType}
            onSkillTypeChange={setSelectedSkillType}
            disabled={isLoading}
            disableSkillTypeToggle={isGeneralSkillsMode}
            trackHelperText={trackHelperText}
            style={{
            gridArea: "1/ 1 / 3 / 3",  
          }}
        />
         

        <InlineContainer
          Title="Skill you are currently learning"
          style={{
            backgroundColor: "var(--dark-blue)",
            width: "100%",
            gridArea: "1 / 3 / 3 / 5",
          }}
        >
          {learningItems.length ? (
            learningItems.map((item) => (
              <RectangularCard
                key={item.id}
                Title={item.subLabel}
                isSubtextVisible
                subtext={item.label}
                theme="light"
                selectable
                selected={selectedLearningTargetId === item.id}
                onSelect={() => {
                  const target = learningTargets.find(
                    (t) => t.id === item.id
                  );

                  if (target) {
                    openConfirmForTarget(target);
                  }
                }}
                style={{
                  height: "fit-content",
                }}
              />
            ))
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: "var(--font-jura)",
                fontSize: "0.95rem",
                opacity: 0.8,
              }}
            >
              There are no skills you are currently learning.
            </div>
          )}
        </InlineContainer>

        <FlexContainer
          Title="More Skills to test"
          searchBar
          searchValue={search}
          onSearchChange={setSearch}
          style={{
            gridArea: "3 / 1 / 7 / 4",
            backgroundColor: "var(--dark-blue)",
          }}
        >
          {filteredMoreSkills.map((skill) => {
            const isSelected = selectedMoreName === skill;

            return (
              <RectangularCard
                key={skill}
                Title={skill}
                theme="dark"
                selectable={true}
                selected={isSelected}
                onSelect={() => {
                  const selected = filteredSkills.find(
                    (s) => s.skill_name === skill
                  );

                  if (!selected) return;

                  setSelectedMoreSkillId(selected.id);

                  openConfirmForTarget({
                    id: selected.id,
                    label: selected.skill_name,
                    sessionType: "skills",
                  });
                }}
                style={{
                  minWidth: "fit-content",
                  flex:1,
                }}
              />
            );
          })}
        </FlexContainer>


        <StackContainer
          Title="Past Tests"
          centerTitle
          style={{
            gridArea: "3 / 4 / 7 / 5",
            backgroundColor: "var(--dark-blue)",
          }}
        >
          {allPastTests.map((test) => (
            <ActivityCard
              key={test.id}
              title={test.title}
              score={test.score}
              skill={test.skill}
              variant="progress"
            />
          ))}
        </StackContainer>

      </div>

      {
        error ? (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(127, 29, 29, 0.92)",
              color: "#fee2e2",
              padding: "10px 16px",
              borderRadius: "12px",
              zIndex: 1001,
              fontSize: "13px",
              maxWidth: "70vw",
            }}
          >
            {error}
          </div>
        ) : null
      }

      {
        isConfirmOpen && pendingTarget && (
          <SkillConfirmPopup
            skillName={pendingTargetName}
            isLoading={isStarting}
            testCode={nextTestCode}
            onCancel={() => {
              if (!isStarting) {
                setIsConfirmOpen(false);
                setPendingTarget(null);
              }
            }}
            onConfirm={(questions) =>
              handleStartAssessment(pendingTarget, questions)
            }
          />
        )
      }
    </div >
  );
}
