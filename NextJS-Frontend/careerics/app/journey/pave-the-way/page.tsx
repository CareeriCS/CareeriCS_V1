"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CourseCard } from "@/components/ui/courseCards";
import CourseActionPopup from "@/components/ui/course-action-popup";
import JourneyTree from "@/components/ui/journey-tree";
import JourneyTreeVertical from "@/components/ui/journey-tree-vertical";
import SkillConfirmPopup from "@/components/ui/skillConfirmPopup";
import { StepFlow } from "@/components/ui/roadmap-flow";
import RoadmapProgress from "@/components/ui/roadmapProgress";
import RoadmapResourceCard from "@/components/ui/roadmapResourceCard";
import StepCheckbox from "@/components/ui/roadmapStepCheckbox";
import { useResponsive } from "@/hooks/useResponsive";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import {
  buildRoadmapStepFlowItems,
  buildRoadmapUiSections,
  getLockedRoadmapStepIndexes,
  getNextUnlockedRoadmapSectionAfterCompletion,
  resolveRoadmapSectionSelection,
  type RoadmapUiSection,
} from "@/lib/roadmap-ui";
import { useAuth } from "@/providers/auth-provider";
import { buildJourneyPhaseHref, resolveRoadmapLevel } from "@/lib/journey";
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  completeCourse,
  enrollCourse,
  loadCourseProgress,
  syncCourseProgressFromServer,
  type CourseProgressState,
} from "@/lib/course-progress";
import { roadmapService, skillAssessmentService } from "@/services";
import type {
  APIAssessmentSessionSummary,
  CurrentRoadmapLearning,
  RoadmapCoursesRead,
  RoadmapProgressSummary,
  RoadmapRead,
} from "@/types";
import RoadmapPanelContent from "@/components/ui/roadmap-resources";

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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSessionType(type: APIAssessmentSessionSummary["type"]): string {
  const normalized = String(type || "").toLowerCase();
  return normalized === "skill" ? "skills" : normalized;
}

export default function JourneyPaveTheWayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isLarge, isSmall } = useResponsive();

  const {
    selectedTrack,
    maxReached,
    isLoadingTracks,
    trackError,
  } = useJourneyPhase(2);

  const [roadmap, setRoadmap] = useState<RoadmapRead | null>(null);
  const [roadmapProgress, setRoadmapProgress] = useState<RoadmapProgressSummary | null>(null);
  const [roadmapCourses, setRoadmapCourses] = useState<RoadmapCoursesRead | null>(null);
  const [currentLearning, setCurrentLearning] = useState<CurrentRoadmapLearning | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgressState>({ current: [], completed: [] });
  const [courseProgressError, setCourseProgressError] = useState<string | null>(null);
  const [activePopupMode, setActivePopupMode] = useState<"enroll" | "complete" | "retake" | null>(null);
  const [activePopupCourse, setActivePopupCourse] = useState<
    RoadmapCoursesRead["sections"][number]["courses"][number] | null
  >(null);
  const [assessmentSessions, setAssessmentSessions] = useState<APIAssessmentSessionSummary[]>([]);
  const [localStepCompletion, setLocalStepCompletion] = useState<Record<string, boolean>>({});
  const [selectedSectionPreferenceId, setSelectedSectionPreferenceId] = useState("");
  const [pendingAssessmentSection, setPendingAssessmentSection] = useState<RoadmapUiSection | null>(null);
  const [pendingNextSectionId, setPendingNextSectionId] = useState("");
  const [sectionAccessMessage, setSectionAccessMessage] = useState<string | null>(null);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  const inFlightStepIdsRef = useRef<Set<string>>(new Set());
  const Orientation = isLarge ? JourneyTree : JourneyTreeVertical;

  useEffect(() => {
    let alive = true;

    const loadRoadmapData = async () => {
      setSelectedSectionPreferenceId("");
      setPendingAssessmentSection(null);
      setPendingNextSectionId("");
      setSectionAccessMessage(null);
      setLocalStepCompletion({});

      if (!selectedTrack?.roadmapId) {
        setRoadmap(null);
        setRoadmapProgress(null);
        setRoadmapCourses(null);
        setCurrentLearning(null);
        setRoadmapError(null);
        setIsLoadingRoadmap(false);
        return;
      }

      setIsLoadingRoadmap(true);
      setRoadmapError(null);

      try {
        const [roadmapResponse, progressResponse, currentLearningResponse, coursesResponse] = await Promise.all([
          roadmapService.getRoadmapById(selectedTrack.roadmapId),
          user?.id
            ? roadmapService.getRoadmapProgress(selectedTrack.roadmapId, user.id)
            : Promise.resolve({ success: false, data: null, message: "" }),
          user?.id
            ? roadmapService.getCurrentRoadmapLearning(user.id, selectedTrack.roadmapId)
            : Promise.resolve({ success: false, data: null, message: "" }),
          roadmapService.getRoadmapCourses(selectedTrack.roadmapId),
        ]);

        if (!alive) {
          return;
        }

        if (!roadmapResponse.success || !roadmapResponse.data) {
          setRoadmap(null);
          setRoadmapProgress(null);
          setRoadmapCourses(null);
          setCurrentLearning(null);
          setRoadmapError(roadmapResponse.message || "Unable to load roadmap details.");
          return;
        }

        setRoadmap(roadmapResponse.data);
        setRoadmapProgress(progressResponse.success ? progressResponse.data || null : null);
        setRoadmapCourses(coursesResponse.success ? coursesResponse.data || null : null);
        setCurrentLearning(currentLearningResponse.success ? currentLearningResponse.data || null : null);

        if (!progressResponse.success && progressResponse.message) {
          setRoadmapError(progressResponse.message);
        } else {
          setRoadmapError(null);
        }
      } catch (error) {
        if (!alive) {
          return;
        }

        setRoadmap(null);
        setRoadmapProgress(null);
        setRoadmapCourses(null);
        setCurrentLearning(null);
        setRoadmapError(
          error instanceof Error
            ? error.message
            : "Unable to load roadmap details.",
        );
      } finally {
        if (alive) {
          setIsLoadingRoadmap(false);
        }
      }
    };

    void loadRoadmapData();

    return () => {
      alive = false;
    };
  }, [selectedTrack?.roadmapId, user?.id]);

  useEffect(() => {
    let alive = true;

    const syncCourseProgress = async () => {
      if (user?.id) {
        const synced = await syncCourseProgressFromServer(user.id);
        if (!alive) {
          return;
        }

        setCourseProgress(synced);
        return;
      }

      setCourseProgress(loadCourseProgress(user?.id));
    };

    void syncCourseProgress();

    const handleCourseProgressUpdated = () => {
      setCourseProgress(loadCourseProgress(user?.id));
    };

    window.addEventListener(COURSE_PROGRESS_UPDATED_EVENT, handleCourseProgressUpdated as EventListener);
    window.addEventListener("storage", handleCourseProgressUpdated);

    return () => {
      alive = false;
      window.removeEventListener(
        COURSE_PROGRESS_UPDATED_EVENT,
        handleCourseProgressUpdated as EventListener,
      );
      window.removeEventListener("storage", handleCourseProgressUpdated);
    };
  }, [user?.id]);

  useEffect(() => {
    const applySyncedProgress = (payload: RoadmapProgressSyncPayload | null) => {
      if (!payload || !user?.id || !selectedTrack?.roadmapId) {
        return;
      }

      if (payload.roadmapId !== selectedTrack.roadmapId || payload.userId !== user.id) {
        return;
      }

      setRoadmapProgress(payload.progress);

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
  }, [selectedTrack?.roadmapId, user?.id]);

  useEffect(() => {
    let alive = true;

    const loadAssessmentSessions = async () => {
      if (!user?.id) {
        setAssessmentSessions([]);
        return;
      }

      try {
        const response = await skillAssessmentService.getUserSessions(user.id);
        if (!alive) {
          return;
        }

        setAssessmentSessions(response.success ? response.data || [] : []);
      } catch {
        if (alive) {
          setAssessmentSessions([]);
        }
      }
    };

    void loadAssessmentSessions();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const sections = useMemo(() => {
    return buildRoadmapUiSections({
      roadmap,
      progress: roadmapProgress,
      localStepCompletion,
    });
  }, [localStepCompletion, roadmap, roadmapProgress]);

  const fallbackCurrentSectionId = useMemo(() => {
    const backendSectionId = currentLearning?.section_id || "";
    const backendSection = sections.find((section) => section.id === backendSectionId);

    if (backendSection?.completionStatus === "completed") {
      const nextSection = getNextUnlockedRoadmapSectionAfterCompletion(sections, backendSection.id);
      return nextSection?.id || backendSection.id;
    }

    return backendSectionId;
  }, [currentLearning?.section_id, sections]);

  const contextSectionSelection = useMemo(() => {
    return resolveRoadmapSectionSelection({
      sections,
      fallbackSectionId: fallbackCurrentSectionId,
    });
  }, [fallbackCurrentSectionId, sections]);

  const panelSectionSelection = useMemo(() => {
    if (!selectedSectionPreferenceId) {
      return null;
    }

    return resolveRoadmapSectionSelection({
      sections,
      preferredSectionId: selectedSectionPreferenceId,
      fallbackSectionId: fallbackCurrentSectionId,
    });
  }, [fallbackCurrentSectionId, sections, selectedSectionPreferenceId]);

  const selectedSection = panelSectionSelection?.selectedSection || contextSectionSelection.selectedSection || null;
  const selectedIndex = selectedSection
    ? sections.findIndex((section) => section.id === selectedSection.id)
    : -1;

  const selectedCoursesSection = useMemo(() => {
    if (!roadmapCourses?.sections?.length || !selectedSection) return null;
    return roadmapCourses.sections.find((section) => section.section_id === selectedSection.id) || null;
  }, [roadmapCourses, selectedSection]);

  const selectedSectionCourses = selectedCoursesSection?.courses || [];

  const courseStatusById: Partial<Record<string, "enrolled" | "completed">> = {};

  for (const course of courseProgress.current) {
    courseStatusById[course.id] = "enrolled";
  }

  for (const course of courseProgress.completed) {
    courseStatusById[course.id] = "completed";
  }

  const steps = useMemo(() => buildRoadmapStepFlowItems(sections), [sections]);
  const lockedStepIndexes = useMemo(() => getLockedRoadmapStepIndexes(sections), [sections]);

  const hasSubmittedSectionAssessment = useCallback(
    (sectionId: string) =>
      assessmentSessions.some((session) => {
        const type = normalizeSessionType(session.type);
        return (
          String(session.status || "").toLowerCase() === "submitted" &&
          type === "section" &&
          session.section_id === sectionId
        );
      }),
    [assessmentSessions],
  );

  const assessedSectionIds = useMemo(() => {
    return new Set(
      assessmentSessions
        .filter((session) => {
          const type = normalizeSessionType(session.type);
          return (
            String(session.status || "").toLowerCase() === "submitted" &&
            type === "section" &&
            session.section_id
          );
        })
        .map((session) => session.section_id as string),
    );
  }, [assessmentSessions]);

  const assessedSectionsCount = useMemo(() => {
    return sections.filter((section) => assessedSectionIds.has(section.id)).length;
  }, [assessedSectionIds, sections]);

  const nextTestCode = useMemo(() => {
    const submitted = assessmentSessions.filter(
      (session) => String(session.status || "").toLowerCase() === "submitted",
    );
    const count = submitted.length + 1;
    return `Test_${String(count).padStart(3, "0")}`;
  }, [assessmentSessions]);

  const completionPercent = clampPercent(roadmapProgress?.completion_percent || 0);
  const completedTopics = roadmapProgress?.completed_steps || 0;
  const totalTopics = roadmapProgress?.total_steps || sections.reduce((sum, section) => sum + section.skills.length, 0);
  const remainingTopics = Math.max(0, totalTopics - completedTopics);
  const currentLevel = resolveRoadmapLevel(completionPercent);
  const nextPhase = maxReached < 5 ? maxReached + 1 : maxReached;

  const handleSectionSelect = (index: number) => {
    const nextSection = sections[index];

    if (!nextSection) {
      return;
    }

    if (nextSection.locked) {
      setSectionAccessMessage(
        nextSection.lockReason || "Complete the previous section first to unlock this one.",
      );
      return;
    }

    setSectionAccessMessage(null);
    setSelectedSectionPreferenceId(nextSection.id);
  };

  const toggleSkill = async (skillIndex: number) => {
    if (!selectedSection || !selectedTrack?.roadmapId) {
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
      progress: roadmapProgress,
      localStepCompletion: optimisticLocalCompletion,
    });
    const optimisticCurrentSection = optimisticSections.find(
      (section) => section.id === selectedSection.id,
    );
    let openedAssessmentSectionId = "";
    let openedPendingNextSectionId = "";

    setSectionAccessMessage(null);
    setLocalStepCompletion(optimisticLocalCompletion);

    if (nextChecked && optimisticCurrentSection?.completionStatus === "completed") {
      const nextSection = getNextUnlockedRoadmapSectionAfterCompletion(
        optimisticSections,
        selectedSection.id,
      );

      if (!hasSubmittedSectionAssessment(optimisticCurrentSection.id)) {
        setPendingAssessmentSection(optimisticCurrentSection);
        const nextSectionId = nextSection?.id || "";
        setPendingNextSectionId(nextSectionId);
        openedAssessmentSectionId = optimisticCurrentSection.id;
        openedPendingNextSectionId = nextSectionId;
      } else if (nextSection) {
        setSelectedSectionPreferenceId(nextSection.id);
      }
    }

    if (!user?.id) {
      return;
    }

    inFlightStepIdsRef.current.add(step.id);

    try {
      const response = await roadmapService.upsertStepProgress(selectedTrack.roadmapId, user.id, step.id, {
        completion_status: nextChecked ? "completed" : "not_started",
      });

      if (!response.success || !response.data) {
        setLocalStepCompletion((previous) => ({
          ...previous,
          [step.id]: previousChecked,
        }));
        setSectionAccessMessage(response.message || "Unable to update progress right now.");
        if (openedAssessmentSectionId) {
          setPendingAssessmentSection((previous) =>
            previous?.id === openedAssessmentSectionId ? null : previous,
          );
          setPendingNextSectionId((previous) =>
            previous === openedPendingNextSectionId ? "" : previous,
          );
        }
        return;
      }

      setRoadmapProgress(response.data);
      setLocalStepCompletion((previous) => {
        if (previous[step.id] !== nextChecked) {
          return previous;
        }
        const next = { ...previous };
        delete next[step.id];
        return next;
      });

      const syncPayload: RoadmapProgressSyncPayload = {
        roadmapId: selectedTrack.roadmapId,
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
      if (openedAssessmentSectionId) {
        setPendingAssessmentSection((previous) =>
          previous?.id === openedAssessmentSectionId ? null : previous,
        );
        setPendingNextSectionId((previous) =>
          previous === openedPendingNextSectionId ? "" : previous,
        );
      }
    } finally {
      inFlightStepIdsRef.current.delete(step.id);
    }
  };

  const handleCourseClick = (course: RoadmapCoursesRead["sections"][number]["courses"][number]) => {
    if (courseStatusById[course.id] === "enrolled") {
      setActivePopupCourse(course);
      setActivePopupMode("complete");
      return;
    }

    if (courseStatusById[course.id] === "completed") {
      setActivePopupCourse(course);
      setActivePopupMode("retake");
      return;
    }

    setActivePopupCourse(course);
    setActivePopupMode("enroll");
  };

  const confirmEnrollment = async () => {
    if (!activePopupCourse) {
      return;
    }

    try {
      setCourseProgressError(null);
      const nextProgress = await enrollCourse(
        {
          id: activePopupCourse.id,
          title: activePopupCourse.title,
          provider: activePopupCourse.provider,
          url: activePopupCourse.url,
        },
        user?.id,
      );

      setCourseProgress(nextProgress);
      setActivePopupCourse(null);
      setActivePopupMode(null);
    } catch (syncError) {
      setCourseProgressError(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync course progress right now.",
      );
    }
  };

  const confirmCompletion = async () => {
    if (!activePopupCourse) {
      return;
    }

    try {
      setCourseProgressError(null);
      const nextProgress = await completeCourse(activePopupCourse.id, user?.id);
      setCourseProgress(nextProgress);
      setActivePopupCourse(null);
      setActivePopupMode(null);
    } catch (syncError) {
      setCourseProgressError(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync course progress right now.",
      );
    }
  };

  const handleContinueCourse = () => {
    if (activePopupCourse?.url) {
      window.open(activePopupCourse.url, "_blank", "noopener,noreferrer");
    }

    setActivePopupCourse(null);
    setActivePopupMode(null);
  };

  if (isLoadingTracks || isLoadingRoadmap) {
    return (
      <Orientation
        current={2}
        maxReached={2}
        renderContent={() => (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "1rem",
                  marginBottom: "1rem",
                  opacity: 0.8,
                }}
              >
                Loading your learning path...
              </div>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  border: "2px solid #4A5FC1",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}
      />
    );
  }

  if (!selectedTrack) {
    return (
      <Orientation
        current={2}
        maxReached={2}
        renderContent={() => (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
              color: "white",
              textAlign: "center",
              padding: "40px",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>No Track Selected</h1>
            <p style={{ margin: 0, color: "#C1CBE6", maxWidth: "60ch" }}>
              Select a track from Home to unlock this phase and load roadmap learning data.
            </p>
            <button
              type="button"
              onClick={() => router.push("/features/home")}
              style={{
                border: "none",
                borderRadius: "2vh",
                backgroundColor: "var(--light-green)",
                color: "black",
                padding: "0.9rem 1.6rem",
                fontFamily: "var(--font-nova-square)",
                cursor: "pointer",
              }}
            >
              Back To Home
            </button>
          </div>
        )}
      />
    );
  }

  return (
    <>
      <Orientation
        current={2}
        maxReached={nextPhase}
        resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack.id)}
        renderContent={() => (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "auto minmax(0, 1fr)",
              gap: "var(--space-lg)",
              width: "100%",
              height: "100%",
              minHeight: 0,
              padding: "var(--space-xl)",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                gridArea: "1 / 1 / 2 / 2",
                flexDirection: "column",
                gap: "var(--space-md)",
                minHeight: 0,
              }}
            >
              <h1
                style={{
                  color: "white",
                  fontSize: "var(--text-lg)",
                  margin: 0,
                }}
              >
                Stats
              </h1>

              <div
                style={{
                  display: "flex",
                  width: "100%",
                  backgroundColor: "var(--medium-blue)",
                  borderRadius: "var(--radius-xl)",
                  flexDirection: "column",
                  padding: "var(--space-lg)",
                  gap: "var(--space-lg)",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    gap: "var(--space-md)",
                    alignItems: "center",
                  }}
                >
                  <h1
                    style={{
                      color: "white",
                      fontSize: "var(--text-md)",
                      margin: 0,
                    }}
                  >
                    Roadmap Progress
                  </h1>

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                      height: "var(--space-lg)",
                      backgroundColor: "var(--dark-blue)",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${completionPercent}%`,
                        height: "100%",
                        backgroundColor: "var(--light-green)",
                        borderRadius: "999px",
                      }}
                    />
                  </div>

                  <p
                    style={{
                      color: "var(--light-green)",
                      fontSize: "var(--text-sm)",
                      margin: 0,
                    }}
                  >
                    {completionPercent}%
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-lg)",
                    alignItems: "flex-start",
                    justifyContent: "space-evenly",
                    flexWrap: isSmall ? "wrap" : "nowrap",
                  }}
                >
                  <RoadmapProgress
                    text="Current Level"
                    done={currentLevel}
                    color="white"
                  />

                  <RoadmapProgress
                    text="Completed Topics"
                    done={String(completedTopics)}
                    total={String(totalTopics)}
                  />

                  <RoadmapProgress
                    text="Remaining Topics"
                    done={String(remainingTopics)}
                    color="var(--light-red)"
                  />

                  <RoadmapProgress
                    text="Skills Assessed"
                    done={String(assessedSectionsCount)}
                    total={String(sections.length)}
                    color="var(--light-orange)"
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                gridArea: "2 / 1 / 3 / 2",
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gridTemplateRows: "1fr",
                minHeight: 0,
                overflow: "hidden",
                gap: "var(--space-lg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-md)",
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <h1
                  style={{
                    color: "white",
                    fontSize: "var(--text-lg)",
                    margin: 0,
                    flexShrink: 0,
                  }}
                >
                  Roadmap
                </h1>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    backgroundColor: "var(--bg-grey)",
                    borderRadius: "var(--radius-xl)",
                    padding: "var(--space-lg)",
                    boxSizing: "border-box",
                  }}
                >
                  {steps.length ? (
                    <StepFlow
                      style={{}}
                      variant="dark"
                      steps={steps}
                      roadmapId={selectedTrack?.roadmapId || undefined}
                      selectedIndex={selectedIndex >= 0 ? selectedIndex : undefined}
                      lockedStepIndexes={lockedStepIndexes}
                      onSelect={handleSectionSelect}
                      isNavigatable={false}
                      routeOnClick={false}
                    />
                  ) : (
                    <div style={{ color: "black" }}>
                      <p style={{ marginTop: 0 }}>
                        No roadmap sections are available for this track yet.
                      </p>

                      <button
                        type="button"
                        onClick={() => router.push("/features/roadmap")}
                        style={{
                          border: "none",
                          borderRadius: "2vh",
                          backgroundColor: "var(--medium-blue)",
                          color: "white",
                          padding: "0.7rem 1.2rem",
                          cursor: "pointer",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      >
                        Open Roadmaps
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-md)",
                  minHeight: 0,
                  overflow: "hidden",
                  alignSelf: "stretch",
                }}
              >
              <h1
                  style={{
                    color: "white",
                    fontSize: "var(--text-lg)",
                    margin: 0,
                    flexShrink: 0,
                  }}
                >
                  Topics & Resources
                </h1>                

                <RoadmapPanelContent
                  sectionAccessMessage={sectionAccessMessage}
                  selectedSection={selectedSection ?? undefined}
                  selectedSectionCourses={selectedSectionCourses}
                  courseProgressError={courseProgressError}
                  courseStatusById={courseStatusById}
                  toggleSkill={toggleSkill}
                  handleCourseClick={handleCourseClick}
                />

              </div>
            </div>
          </div>
        )}
      />

      {activePopupCourse && activePopupMode ? (
        <CourseActionPopup
          mode={activePopupMode}
          courseTitle={activePopupCourse.title}
          courseOrg={activePopupCourse.provider}
          onConfirm={
            activePopupMode === "enroll"
              ? confirmEnrollment
              : activePopupMode === "retake"
                ? handleContinueCourse
                : confirmCompletion
          }
          onCancel={() => {
            setActivePopupCourse(null);
            setActivePopupMode(null);
          }}
          onContinue={
            activePopupMode === "complete" || activePopupMode === "enroll"
              ? handleContinueCourse
              : undefined
          }
        />
      ) : null}

      {pendingAssessmentSection ? (
        <SkillConfirmPopup
          skillName={pendingAssessmentSection.title}
          testCode={nextTestCode}
          onCancel={() => {
            const nextId = pendingNextSectionId;
            setPendingAssessmentSection(null);
            setPendingNextSectionId("");

            if (nextId) {
              setSelectedSectionPreferenceId(nextId);
            }
          }}
          onConfirm={(questions) => {
            const section = pendingAssessmentSection;
            const nextId = pendingNextSectionId;

            setPendingAssessmentSection(null);
            setPendingNextSectionId("");

            if (!section) {
              if (nextId) {
                setSelectedSectionPreferenceId(nextId);
              }
              return;
            }

            const params = new URLSearchParams({
              targetId: section.id,
              targetName: section.title,
              sessionType: "section",
              numQuestions: String(questions),
            });

            router.push(`/skill-feature/questions?${params.toString()}`);
          }}
        />
      ) : null}
    </>
  );
}