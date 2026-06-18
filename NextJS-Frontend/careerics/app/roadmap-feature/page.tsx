"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RoadmapProgress from "@/components/ui/roadmapProgress";
import { StepFlow } from "@/components/ui/roadmap-flow";
import StepCheckbox from "@/components/ui/roadmapStepCheckbox";
import RoadmapResourceCard from "@/components/ui/roadmapResourceCard";
import {
  buildRoadmapStepFlowItems,
  buildRoadmapUiSections,
  getLockedRoadmapStepIndexes,
  getNextUnlockedRoadmapSectionAfterCompletion,
  resolveRoadmapSectionSelection,
} from "@/lib/roadmap-ui";
import { useAuth } from "@/providers/auth-provider";
import { roadmapService } from "@/services";
import type { ApiResponse, RoadmapListItem, RoadmapProgressSummary, RoadmapRead } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import RoadmapPanelContent from "@/components/ui/roadmap-resources";

type CachedApiRequest<T> = {
  expiresAt: number;
  promise: Promise<ApiResponse<T>>;
};

const ROADMAP_DETAILS_CACHE_TTL_MS = 60_000;
const ROADMAP_PROGRESS_UPDATED_EVENT = "careerics-roadmap-progress-updated";

type RoadmapProgressSyncPayload = {
  roadmapId: string;
  userId: string;
  progress: RoadmapProgressSummary;
  updatedAt: number;
};

function getProgressStepIds(progressSummary: RoadmapProgressSummary): Set<string> {
  const stepIds = new Set<string>();

  for (const section of progressSummary.sections || []) {
    for (const step of section.steps || []) {
      if (step.step_id) {
        stepIds.add(step.step_id);
      }
    }
  }

  return stepIds;
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

export default function RoadmapFeaturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();


  const roadmapParam = searchParams.get("roadmap") || "";
  const stepParam = searchParams.get("step") || "";

  const [roadmapList, setRoadmapList] = useState<RoadmapListItem[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapRead | null>(null);
  const [progress, setProgress] = useState<RoadmapProgressSummary | null>(null);
  const [localStepCompletion, setLocalStepCompletion] = useState<Record<string, boolean>>({});
  const [selectedSectionPreferenceId, setSelectedSectionPreferenceId] = useState("");
  const [sectionAccessMessage, setSectionAccessMessage] = useState<string | null>(null);

  const inFlightStepIdsRef = useRef<Set<string>>(new Set());
  const hasManualSectionSelectionRef = useRef(false);
  const roadmapByIdCacheRef = useRef<Map<string, CachedApiRequest<RoadmapRead>>>(new Map());

  const activeRoadmapId = useMemo(() => {
    if (!roadmapList.length) {
      return "";
    }

    const requestedRoadmapIdExists = roadmapList.some((item) => item.id === roadmapParam);
    if (requestedRoadmapIdExists) {
      return roadmapParam;
    }

    return roadmapList[0]?.id || "";
  }, [roadmapList, roadmapParam]);

  const getRoadmapByIdCached = useCallback((roadmapId: string) => {
    const now = Date.now();
    const cached = roadmapByIdCacheRef.current.get(roadmapId);
    if (cached && cached.expiresAt > now) {
      return cached.promise;
    }

    const requestPromise = roadmapService.getRoadmapById(roadmapId).then((response) => {
      if (!response.success) {
        roadmapByIdCacheRef.current.delete(roadmapId);
      }
      return response;
    });

    roadmapByIdCacheRef.current.set(roadmapId, {
      expiresAt: now + ROADMAP_DETAILS_CACHE_TTL_MS,
      promise: requestPromise,
    });

    return requestPromise;
  }, []);

  useEffect(() => {
    let alive = true;

    const loadRoadmaps = async () => {
      const response = await roadmapService.listRoadmaps();
      if (!alive) {
        return;
      }

      if (!response.success) {
        setRoadmapList([]);
        return;
      }

      setRoadmapList(normalizeRoadmapListPayload(response.data));
    };

    void loadRoadmaps();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadRoadmap = async () => {
      if (!activeRoadmapId) {
        setRoadmap(null);
        return;
      }

      const response = await getRoadmapByIdCached(activeRoadmapId);
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setRoadmap(null);
        return;
      }

      setRoadmap(response.data);
      setSectionAccessMessage(null);
    };

    void loadRoadmap();

    return () => {
      alive = false;
    };
  }, [activeRoadmapId, getRoadmapByIdCached]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let alive = true;

    const loadProgress = async () => {
      if (!user?.id || !activeRoadmapId) {
        setProgress(null);
        return;
      }

      const response = await roadmapService.getRoadmapProgress(activeRoadmapId, user.id);
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setProgress(null);
        return;
      }

      setProgress(response.data);
      setLocalStepCompletion({});
    };

    void loadProgress();

    return () => {
      alive = false;
    };
  }, [activeRoadmapId, isAuthLoading, user?.id]);

  useEffect(() => {
    hasManualSectionSelectionRef.current = false;
  }, [activeRoadmapId]);

  useEffect(() => {
    const applySyncedProgress = (payload: RoadmapProgressSyncPayload | null) => {
      if (!payload || !user?.id || !activeRoadmapId) {
        return;
      }

      if (payload.roadmapId !== activeRoadmapId || payload.userId !== user.id) {
        return;
      }

      setProgress(payload.progress);

      const syncedStepIds = getProgressStepIds(payload.progress);
      setLocalStepCompletion((previous) => {
        if (!syncedStepIds.size) {
          return previous;
        }

        let changed = false;
        const next = { ...previous };

        for (const stepId of syncedStepIds) {
          if (stepId in next) {
            delete next[stepId];
            changed = true;
          }
        }

        return changed ? next : previous;
      });

      if (!hasManualSectionSelectionRef.current && !stepParam) {
        setSelectedSectionPreferenceId("");
      }
    };

    const handleProgressUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<RoadmapProgressSyncPayload | null>;
      applySyncedProgress(customEvent.detail || null);
    };

    const handleStorageUpdated = (event: StorageEvent) => {
      if (event.key !== ROADMAP_PROGRESS_UPDATED_EVENT || !event.newValue) {
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as RoadmapProgressSyncPayload;
        applySyncedProgress(parsed);
      } catch {
        // Ignore malformed sync payloads.
      }
    };

    window.addEventListener(ROADMAP_PROGRESS_UPDATED_EVENT, handleProgressUpdated as EventListener);
    window.addEventListener("storage", handleStorageUpdated);

    return () => {
      window.removeEventListener(
        ROADMAP_PROGRESS_UPDATED_EVENT,
        handleProgressUpdated as EventListener,
      );
      window.removeEventListener("storage", handleStorageUpdated);
    };
  }, [activeRoadmapId, stepParam, user?.id]);

  const { isLarge } = useResponsive();

  const sections = useMemo(() => {
    return buildRoadmapUiSections({
      roadmap,
      progress,
      localStepCompletion,
    });
  }, [localStepCompletion, progress, roadmap]);

  const fallbackCurrentSectionId = useMemo(() => {
    const firstIncompleteUnlocked = sections.find(
      (section) => !section.locked && section.completionStatus !== "completed",
    );

    if (firstIncompleteUnlocked) {
      return firstIncompleteUnlocked.id;
    }

    const unlockedSections = sections.filter((section) => !section.locked);
    return unlockedSections[unlockedSections.length - 1]?.id || sections[0]?.id || "";
  }, [sections]);

  const sectionSelection = useMemo(() => {
    return resolveRoadmapSectionSelection({
      sections,
      preferredSectionId: selectedSectionPreferenceId,
      requestedSectionParam: stepParam,
      fallbackSectionId: fallbackCurrentSectionId,
    });
  }, [fallbackCurrentSectionId, sections, selectedSectionPreferenceId, stepParam]);

  const { selectedSection, selectedIndex } = sectionSelection;
  const activeSectionAccessMessage = sectionAccessMessage || sectionSelection.lockedMessage;

  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const closeStats = useCallback(() => {
    setIsStatsOpen(false);
  }, []);

  const handleSectionSelect = useCallback(
    (index: number) => {
      const nextSection = sections[index];
      if (!nextSection) return;

      if (nextSection.locked) {
        setSectionAccessMessage(
          nextSection.lockReason || "Locked section",
        );
        return;
      }

      hasManualSectionSelectionRef.current = true;
      setSelectedSectionPreferenceId(nextSection.id);

      // MOBILE LOGIC ONLY
      if (!isLarge) {
        setIsStatsOpen((prev) => {
          // if same section clicked → toggle
          const sameSection = selectedSection?.id === nextSection.id;
          if (sameSection) return !prev;

          // different section → always open
          return true;
        });
      }
    },
    [sections, isLarge, selectedSection]
  );


  useEffect(() => {
    if (!selectedSection || !activeRoadmapId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (params.get("roadmap") !== activeRoadmapId) {
      params.set("roadmap", activeRoadmapId);
      changed = true;
    }

    const shouldWriteStepParam = Boolean(stepParam) || Boolean(selectedSectionPreferenceId);
    if (shouldWriteStepParam && params.get("step") !== selectedSection.id) {
      params.set("step", selectedSection.id);
      changed = true;
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (changed && nextQuery !== currentQuery) {
      router.replace(`?${nextQuery}`, { scroll: false });
    }
  }, [activeRoadmapId, router, searchParams, selectedSection, selectedSectionPreferenceId, stepParam]);

  const toggleSkill = async (skillIndex: number) => {
    if (!selectedSection || !activeRoadmapId) {
      return;
    }

    if (selectedSection.locked) {
      setSectionAccessMessage(
        selectedSection.lockReason || "Complete the previous section first to unlock this one.",
      );
      return;
    }

    const step = selectedSection.skills[skillIndex];
    if (!step) {
      return;
    }

    if (inFlightStepIdsRef.current.has(step.id)) {
      return;
    }

    const previousChecked = step.checked;
    const nextChecked = !previousChecked;
    const optimisticLocalCompletion = {
      ...localStepCompletion,
      [step.id]: nextChecked,
    };
    const optimisticSections = buildRoadmapUiSections({
      roadmap,
      progress,
      localStepCompletion: optimisticLocalCompletion,
    });
    const optimisticCurrentSection = optimisticSections.find(
      (section) => section.id === selectedSection.id,
    );

    setSectionAccessMessage(null);
    setLocalStepCompletion(optimisticLocalCompletion);

    if (nextChecked && optimisticCurrentSection?.completionStatus === "completed") {
      const nextSection = getNextUnlockedRoadmapSectionAfterCompletion(
        optimisticSections,
        selectedSection.id,
      );

      if (nextSection) {
        setSectionAccessMessage(null);
        setSelectedSectionPreferenceId(nextSection.id);

        if (!isLarge) {
          setIsStatsOpen(true);
        }
      }
    }

    if (!user?.id) {
      return;
    }

    inFlightStepIdsRef.current.add(step.id);

    try {
      const response = await roadmapService.upsertStepProgress(activeRoadmapId, user.id, step.id, {
        completion_status: nextChecked ? "completed" : "not_started",
      });

      if (!response.success || !response.data) {
        setLocalStepCompletion((previous) => ({
          ...previous,
          [step.id]: previousChecked,
        }));
        setSectionAccessMessage(response.message || "Unable to update progress right now.");
        return;
      }

      setProgress(response.data);
      setLocalStepCompletion((previous) => {
        if (previous[step.id] !== nextChecked) {
          return previous;
        }
        const next = { ...previous };
        delete next[step.id];
        return next;
      });

      const syncPayload: RoadmapProgressSyncPayload = {
        roadmapId: activeRoadmapId,
        userId: user.id,
        progress: response.data,
        updatedAt: Date.now(),
      };

      window.dispatchEvent(
        new CustomEvent(ROADMAP_PROGRESS_UPDATED_EVENT, {
          detail: syncPayload,
        }),
      );
      localStorage.setItem(ROADMAP_PROGRESS_UPDATED_EVENT, JSON.stringify(syncPayload));
    } catch {
      setLocalStepCompletion((previous) => ({
        ...previous,
        [step.id]: previousChecked,
      }));
      setSectionAccessMessage("Unable to update progress right now.");
    } finally {
      inFlightStepIdsRef.current.delete(step.id);
    }
  };

  const steps = useMemo(() => buildRoadmapStepFlowItems(sections), [sections]);

  const lockedStepIndexes = useMemo(() => getLockedRoadmapStepIndexes(sections), [sections]);

  const completedSections = progress?.completed_sections || 0;
  const totalSections = progress?.total_sections || sections.length;
  const completedSteps = progress?.completed_steps || 0;
  const totalSteps = progress?.total_steps || sections.reduce((sum, section) => sum + section.skills.length, 0);
  const currentSectionCompletedSteps = selectedSection
    ? selectedSection.skills.filter((skill) => skill.checked).length
    : 0;
  const currentSectionTotalSteps = selectedSection ? selectedSection.skills.length : 0;
  const roadmapHeading = roadmap?.title ? `${roadmap.title} Roadmap` : "Loading roadmap...";


  return (
    <div
      style={{
        display: isLarge ? "flex" : "grid",
        width: "100%",
        height: isLarge ? "100%" : "100%",
        padding: "var(--space-xl)",
        flexDirection: "row",
        overflow: "auto",
        gap: "var(--space-md)",
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
      }}
    >

      {(isStatsOpen || isLarge) && !isLarge && (
        <div
          onClick={closeStats}
          style={{
            position: "fixed",
            inset: 0,
            backdropFilter: "blur(2px)",
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 998,
          }}
        />
      )}

      {/* Main Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minHeight: 0,
          overflow: "hidden",
          flex: 1,
          gap: "var(--space-md)",
          gridArea: "1/1/2/2",
        }}
      >

        <h1
          style={{
            fontSize: "var(--text-xl)",
            color: "white",
            margin: 0,
          }}
        >
          {roadmapHeading}
        </h1>

        {activeSectionAccessMessage ? (
          <p style={{ margin: 0, color: "#FFD3D3", fontSize: "0.95rem" }}>
            {activeSectionAccessMessage}
          </p>
        ) : null}


        {/* Progress Cards */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: "var(--space-xl)",
            flexWrap: "wrap"
          }}
        >
          <RoadmapProgress
            text="Sections Completed"
            done={String(completedSections)}
            total={String(totalSections)}
          />
          <RoadmapProgress
            text="Total Steps Completed"
            done={String(completedSteps)}
            total={String(totalSteps)}
          />
          <RoadmapProgress
            text="Current Steps Completed"
            done={String(currentSectionCompletedSteps)}
            total={String(currentSectionTotalSteps)}
          />
        </div>

        {/* Roadmap */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          <StepFlow
            steps={steps}
            selectedIndex={selectedIndex}
            lockedStepIndexes={lockedStepIndexes}
            onSelect={handleSectionSelect}
            isNavigatable={false}
          />
        </div>
      </div>


      {/* Stats */}
      {(isStatsOpen || isLarge) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--medium-grey)",
            borderRadius: "var(--radius-xl)",
            width:isLarge?"30vw":"70vw",
            alignItems: "center",
            overflow: "hidden",
            gap: "var(--space-md)",
            marginTop: "10vh",
            gridArea: "1/1/2/2",
            marginLeft: !isLarge ? "auto" : 0,
            zIndex: 999,
          }}
        >
          <RoadmapPanelContent
            sectionAccessMessage={sectionAccessMessage}
            selectedSection={selectedSection ?? undefined}
            toggleSkill={toggleSkill}
            courses={false}
            title={selectedSection?.title || "Section"}
          />
        </div>
      )}



    </div >
  );
}
