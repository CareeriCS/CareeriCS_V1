"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CourseActionPopup from "@/components/ui/course-action-popup";
import { CourseCard } from "@/components/ui/courseCards";
import JourneyButton from "@/components/ui/journey-button";
import JourneyTree from "@/components/ui/journey-tree";
import { StepFlow } from "@/components/ui/roadmap-flow";
import RoadmapProgress from "@/components/ui/roadmapProgress";
import RoadmapResourceCard from "@/components/ui/roadmapResourceCard";
import StepCheckbox from "@/components/ui/roadmapStepCheckbox";
import SkillConfirmPopup from "@/components/ui/skillConfirmPopup";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import {
  buildRoadmapStepFlowItems,
  buildRoadmapUiSections,
  getLockedRoadmapStepIndexes,
  resolveRoadmapSectionSelection,
} from "@/lib/roadmap-ui";
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  completeCourse,
  enrollCourse,
  loadCourseProgress,
  syncCourseProgressFromServer,
  type CourseProgressState,
} from "@/lib/course-progress";
import { useAuth } from "@/providers/auth-provider";
import { buildJourneyPhaseHref, resolveRoadmapLevel } from "@/lib/journey";
import { roadmapService, skillAssessmentService } from "@/services";
import type {
  APIAssessmentSessionSummary,
  CurrentRoadmapLearning,
  RoadmapCompletionStatus,
  RoadmapCoursesRead,
  RoadmapProgressSummary,
  RoadmapRead,
} from "@/types";
import JourneyTreeVertical from "@/components/ui/journey-tree-vertical";
import { useResponsive } from "@/hooks/useResponsive";
import { JourneyProgressCard } from "@/components/ui/home/journey-progress-card";

function formatCompletionStatus(status: RoadmapCompletionStatus): string {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "in_progress") {
    return "In Progress";
  }

  return "Not Started";
}

function doesSessionMatchSectionTarget(
  session: APIAssessmentSessionSummary,
  sectionId: string,
): boolean {
  const type = session.type === "skill" ? "skills" : session.type;
  return type === "section" && session.section_id === sectionId;
}

export default function JourneyPaveTheWayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedTrack,
    maxReached,
    isLoadingTracks,
    trackError,
  } = useJourneyPhase(2);

  const [roadmap, setRoadmap] = useState<RoadmapRead | null>(null);
  const [roadmapCourses, setRoadmapCourses] = useState<RoadmapCoursesRead | null>(null);
  const [roadmapProgress, setRoadmapProgress] = useState<RoadmapProgressSummary | null>(null);
  const [currentLearning, setCurrentLearning] = useState<CurrentRoadmapLearning | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgressState>({ current: [], completed: [] });
  const [localStepCompletion, setLocalStepCompletion] = useState<Record<string, boolean>>({});
  const [selectedSectionPreferenceId, setSelectedSectionPreferenceId] = useState("");
  const [sectionAccessMessage, setSectionAccessMessage] = useState<string | null>(null);
  const [activePopupMode, setActivePopupMode] = useState<"enroll" | "complete" | null>(null);
  const [activePopupCourse, setActivePopupCourse] = useState<
    RoadmapCoursesRead["sections"][number]["courses"][number] | null
  >(null);
  const [pendingAssessmentSection, setPendingAssessmentSection] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isStartingAssessment, setIsStartingAssessment] = useState(false);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [courseProgressError, setCourseProgressError] = useState<string | null>(null);

  const inFlightStepIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;

    const loadRoadmapData = async () => {
      setSelectedSectionPreferenceId("");
      setSectionAccessMessage(null);
      setAssessmentError(null);
      setActivePopupCourse(null);
      setActivePopupMode(null);
      setLocalStepCompletion({});

      if (!selectedTrack?.roadmapId) {
        setRoadmap(null);
        setRoadmapCourses(null);
        setRoadmapProgress(null);
        setCurrentLearning(null);
        setRoadmapError(null);
        setIsLoadingRoadmap(false);
        return;
      }

      setIsLoadingRoadmap(true);
      setRoadmapError(null);

      const [roadmapResponse, coursesResponse, progressResponse, currentLearningResponse] = await Promise.all([
        roadmapService.getRoadmapById(selectedTrack.roadmapId),
        roadmapService.getRoadmapCourses(selectedTrack.roadmapId),
        user?.id
          ? roadmapService.getRoadmapProgress(selectedTrack.roadmapId, user.id)
          : Promise.resolve({ success: false, data: null, message: "" }),
        user?.id
          ? roadmapService.getCurrentRoadmapLearning(user.id, selectedTrack.roadmapId)
          : Promise.resolve({ success: false, data: null, message: "" }),
      ]);

      if (!alive) {
        return;
      }

      if (!roadmapResponse.success || !roadmapResponse.data) {
        setRoadmap(null);
        setRoadmapCourses(null);
        setRoadmapProgress(null);
        setCurrentLearning(null);
        setRoadmapError(roadmapResponse.message || "Unable to load roadmap details.");
        setIsLoadingRoadmap(false);
        return;
      }

      setRoadmap(roadmapResponse.data);
      setRoadmapCourses(coursesResponse.success ? coursesResponse.data || null : null);
      setRoadmapProgress(progressResponse.success ? progressResponse.data || null : null);
      setCurrentLearning(currentLearningResponse.success ? currentLearningResponse.data || null : null);

      if (!coursesResponse.success && coursesResponse.message) {
        setRoadmapError(coursesResponse.message);
      } else if (!progressResponse.success && progressResponse.message) {
        setRoadmapError(progressResponse.message);
      } else {
        setRoadmapError(null);
      }

      setIsLoadingRoadmap(false);
    };

    void loadRoadmapData();

    return () => {
      alive = false;
    };
  }, [selectedTrack?.roadmapId, user?.id]);

  useEffect(() => {
    let alive = true;

    const syncCourseProgressState = async () => {
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

    void syncCourseProgressState();

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

  const sections = useMemo(() => {
    return buildRoadmapUiSections({
      roadmap,
      progress: roadmapProgress,
      localStepCompletion,
    });
  }, [localStepCompletion, roadmap, roadmapProgress]);

  const contextSectionSelection = useMemo(() => {
    return resolveRoadmapSectionSelection({
      sections,
      fallbackSectionId: currentLearning?.section_id,
    });
  }, [currentLearning?.section_id, sections]);

  const panelSectionSelection = useMemo(() => {
    if (!selectedSectionPreferenceId) {
      return null;
    }

    return resolveRoadmapSectionSelection({
      sections,
      preferredSectionId: selectedSectionPreferenceId,
      fallbackSectionId: currentLearning?.section_id,
    });
  }, [currentLearning?.section_id, sections, selectedSectionPreferenceId]);

  const selectedSection = panelSectionSelection?.selectedSection || null;
  const selectedIndex = panelSectionSelection?.selectedIndex;
  const activeSectionContext = selectedSection || contextSectionSelection.selectedSection;
  const isSectionPanelOpen = Boolean(selectedSection);
  const steps = useMemo(() => buildRoadmapStepFlowItems(sections), [sections]);
  const lockedStepIndexes = useMemo(() => getLockedRoadmapStepIndexes(sections), [sections]);

  const activeCourseSection = useMemo(() => {
    if (!roadmapCourses?.sections?.length || !activeSectionContext) {
      return null;
    }

    return roadmapCourses.sections.find((section) => section.section_id === activeSectionContext.id) || null;
  }, [activeSectionContext, roadmapCourses]);

  const courseStatusById: Partial<Record<string, "enrolled" | "completed">> = {};

  for (const course of courseProgress.current) {
    courseStatusById[course.id] = "enrolled";
  }

  for (const course of courseProgress.completed) {
    courseStatusById[course.id] = "completed";
  }

  const completionPercent = roadmapProgress?.completion_percent || 0;
  const completedTopics = roadmapProgress?.completed_steps || 0;
  const totalTopics = roadmapProgress?.total_steps || sections.reduce((sum, section) => sum + section.skills.length, 0);
  const remainingTopics = Math.max(0, totalTopics - completedTopics);
  const currentLevel = resolveRoadmapLevel(completionPercent);
  const selectedSectionStatus = selectedSection ? formatCompletionStatus(selectedSection.completionStatus) : "";
  const activeSystemError = trackError || roadmapError || assessmentError || courseProgressError;

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
    setAssessmentError(null);
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

    setSectionAccessMessage(null);
    setLocalStepCompletion((previous) => ({
      ...previous,
      [step.id]: nextChecked,
    }));

    if (!user?.id) {
      return;
    }

    inFlightStepIdsRef.current.add(step.id);

    const response = await roadmapService.upsertStepProgress(selectedTrack.roadmapId, user.id, step.id, {
      completion_status: nextChecked ? "completed" : "not_started",
    });

    inFlightStepIdsRef.current.delete(step.id);

    if (!response.success || !response.data) {
      setLocalStepCompletion((previous) => ({
        ...previous,
        [step.id]: previousChecked,
      }));
      setSectionAccessMessage(response.message || "Unable to update progress right now.");
      return;
    }

    setRoadmapProgress(response.data);
    setLocalStepCompletion((previous) => {
      const next = { ...previous };
      delete next[step.id];
      return next;
    });
  };

  const handleCourseClick = (course: RoadmapCoursesRead["sections"][number]["courses"][number]) => {
    const currentStatus = courseStatusById[course.id];

    if (currentStatus === "enrolled") {
      setActivePopupCourse(course);
      setActivePopupMode("complete");
      return;
    }

    if (currentStatus === "completed") {
      if (course.url) {
        window.open(course.url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (course.url) {
      window.open(course.url, "_blank", "noopener,noreferrer");
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
    } catch (error) {
      setCourseProgressError(
        error instanceof Error
          ? error.message
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
    } catch (error) {
      setCourseProgressError(
        error instanceof Error
          ? error.message
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

  const openAssessmentPopup = () => {
    const sectionTarget = activeSectionContext;

    if (!sectionTarget) {
      setAssessmentError("Select a roadmap section first to start an assessment.");
      return;
    }

    setAssessmentError(null);
    setPendingAssessmentSection({
      id: sectionTarget.id,
      title: sectionTarget.title,
    });
  };

  const handleStartAssessment = async (questions: number) => {
    if (!user?.id || !pendingAssessmentSection) {
      return;
    }

    setIsStartingAssessment(true);
    setAssessmentError(null);

    let resumeSessionId = "";
    const sessionsResponse = await skillAssessmentService.getUserSessions(user.id);

    if (sessionsResponse.success && sessionsResponse.data?.length) {
      const inProgressSession = sessionsResponse.data.find((session) => {
        return session.status === "in_progress" && doesSessionMatchSectionTarget(session, pendingAssessmentSection.id);
      });

      resumeSessionId = inProgressSession?.id || "";
    }

    const params = new URLSearchParams({
      targetId: pendingAssessmentSection.id,
      targetName: pendingAssessmentSection.title,
      sessionType: "section",
      numQuestions: String(questions),
    });

    if (resumeSessionId) {
      params.set("sessionId", resumeSessionId);
    }

    setPendingAssessmentSection(null);
    setIsStartingAssessment(false);
    router.push(`/skill-feature/questions?${params.toString()}`);
  };

  const { isLarge, isMedium, isSmall } = useResponsive();
  const Orientation = isLarge ? JourneyTree : JourneyTreeVertical;

  // if (isLoadingTracks || isLoadingRoadmap) {
  //   return (
  //     <Orientation
  //       current={2}
  //       maxReached={2}
  //       renderContent={() => (
  //         <div
  //           style={{
  //             width: "100%",
  //             height: "100%",
  //             display: "flex",
  //             justifyContent: "center",
  //             alignItems: "center",
  //             color: "white",
  //           }}
  //         >
  //           <div style={{ textAlign: "center" }}>
  //             <div
  //               style={{
  //                 fontSize: "1rem",
  //                 marginBottom: "1rem",
  //                 opacity: 0.8,
  //               }}
  //             >
  //               Loading your learning path...
  //             </div>
  //             <div
  //               style={{
  //                 width: "30px",
  //                 height: "30px",
  //                 border: "2px solid #4A5FC1",
  //                 borderTop: "2px solid transparent",
  //                 borderRadius: "50%",
  //                 animation: "spin 0.8s linear infinite",
  //                 margin: "0 auto",
  //               }}
  //             />
  //             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  //           </div>
  //         </div>
  //       )}
  //     />
  //   );
  // }

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

  const nextPhase = maxReached < 5
    ? maxReached + 1
    : maxReached;

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
              gridTemplateRows: "1fr 2fr",
              gap: "var(--space-lg)",
              width: "100%",
              height: "100%",
              minHeight: 0,
              padding: "var(--space-xl)",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {/* Stats Section */}
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
                  height: "100%",
                  backgroundColor: "var(--medium-blue)",
                  borderRadius: "var(--radius-xl)",
                  flexDirection: "column",
                  padding: "var(--space-lg)",
                  justifyContent: "space-between",
                  boxSizing: "border-box",
                }}
              >
                {/* Roadmap Progress */}
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
                    }}
                  >
                    <div
                      style={{
                        width: "60%",
                        height: "100%",
                        backgroundColor: "var(--light-green)",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    gap: "var(--space-lg)",
                    alignItems: "flex-start",
                    justifyContent: "space-evenly",
                    maxHeight: "fit-content",
                  }}
                >
                  <RoadmapProgress
                    text={"Current Level"}
                    done="Beginner"
                    color="white"
                  />

                  <RoadmapProgress
                    text={"Completed Topics"}
                    done="10"
                  />

                  <RoadmapProgress
                    text={"Remaining Topics"}
                    done="10"
                    color="var(--light-red)"
                  />

                  <RoadmapProgress
                    text={"Skills Assessed"}
                    done="10"
                    total="100"
                    color="var(--light-orange)"
                  />
                </div>
              </div>
            </div>

            {/* Roadmap Section */}
            <div
              style={{
                gridArea: "2 / 1 / 3 / 2",
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gridTemplateRows: "1fr",
                minHeight: 0,
                overflow: "hidden",
                gap: "var(--space-lg)"
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

                    backgroundColor: "var(--bg-grey)",
                    borderRadius: "var(--radius-xl)",
                    padding: "var(--space-lg)",
                    boxSizing: "border-box",
                  }}
                >

                  {steps.length ? (
                    <StepFlow
                    style={{
                    }}
                      variant="dark"
                      steps={steps}
                      roadmapId={selectedTrack?.roadmapId || undefined}
                      selectedIndex={
                        isSectionPanelOpen ? selectedIndex : undefined
                      }
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

              {/* Resources */}
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
                  Topics & Resources
                </h1>

                <div
                  style={{
                    flex: 1,
                    backgroundColor: "var(--medium-blue)",
                    borderRadius: "var(--radius-xl)",
                    padding: "var(--space-md)",
                    overflowY: "auto",
                    overflowX: "hidden",
                    scrollbarWidth: "none",
                    gap: "var(--space-md)",
                  }}
                >
                  {/* Title */}
                  <h2
                    style={{
                      fontSize: "var(--text-lg)",
                      color: "white",
                      fontFamily: "var(--font-nova-square)",
                    }}
                  >
                    {selectedSection?.title || "Select a Section"}
                  </h2>

                  {/* Divider */}
                  <div
                    style={{
                      height: "0.1rem",
                      backgroundColor: "white",
                      width: "100%",
                    }}
                  />

                  {/* Content */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      minHeight: 0,
                      flex: 1,
                      overflowY: "auto",
                      overflowX: "hidden",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                      paddingRight: "var(--space-xxs)",
                      gap: "var(--space-md)",
                    }}
                  >
                    {Boolean(selectedSection?.resources.length) && (
                      <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-sm)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "var(--text-md)",
                            color: "white",
                            fontFamily: "var(--font-nova-square)",
                          }}
                        >
                          Resources:
                        </p>

                        {selectedSection?.resources.map((resource) => {
                          const key = `${resource.url}|${resource.title}|${resource.resourceType}`;

                          return (
                            <RoadmapResourceCard
                              key={key}
                              resourceType={resource.resourceType}
                              title={resource.title}
                              url={resource.url}
                            />
                          );
                        })}

                        <div
                          style={{
                            height: "0.1rem",
                            backgroundColor: "white",
                            width: "100%",
                          }}
                        />
                      </div>
                    )}

                    {(selectedSection?.skills.length ?? 0) > 0 ? (
                      <p
                        style={{
                          fontSize: "var(--text-md)",
                          color: "white",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      >
                        Topics to cover:
                      </p>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                      }}
                    >
                      {(selectedSection?.skills || []).map((skill, index) => (
                        <StepCheckbox
                          key={skill.id}
                          text={skill.text}
                          isChecked={skill.checked}
                          disabled={Boolean(selectedSection?.locked)}
                          onToggle={() => {
                            void toggleSkill(index);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      />


    </>
  );
}
