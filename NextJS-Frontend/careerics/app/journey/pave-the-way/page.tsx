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
    const syncCourseProgress = () => {
      setCourseProgress(loadCourseProgress(user?.id));
    };

    syncCourseProgress();

    const handleCourseProgressUpdated = () => {
      syncCourseProgress();
    };

    window.addEventListener(COURSE_PROGRESS_UPDATED_EVENT, handleCourseProgressUpdated as EventListener);
    window.addEventListener("storage", handleCourseProgressUpdated);

    return () => {
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
  const activeSystemError = trackError || roadmapError || assessmentError;

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

  const confirmEnrollment = () => {
    if (!activePopupCourse) {
      return;
    }

    const nextProgress = enrollCourse(
      {
        id: activePopupCourse.id,
        title: activePopupCourse.title,
        provider: activePopupCourse.provider,
        url: activePopupCourse.url,
      },
      user?.id,
    );

    setCourseProgress(nextProgress);
    setActivePopupMode("complete");
  };

  const confirmCompletion = () => {
    if (!activePopupCourse) {
      return;
    }

    const nextProgress = completeCourse(activePopupCourse.id, user?.id);
    setCourseProgress(nextProgress);
    setActivePopupCourse(null);
    setActivePopupMode(null);
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

  if (isLoadingTracks || isLoadingRoadmap) {
    return (
      <JourneyTree
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
      <JourneyTree
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
      <JourneyTree
        current={2}
        maxReached={nextPhase}
        resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack.id)}
        renderContent={() => (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isSectionPanelOpen ? "0.9fr 1.75fr 1.25fr" : "1fr 3fr",
              gridTemplateRows: "3fr 1fr",
              columnGap: "25px",
              rowGap: "20px",
              width: "100%",
              height: "100%",
              padding: "40px",
              overflow: "hidden",
              position: "relative",
              transition: "grid-template-columns 0.25s ease",
            }}
          >
            <div
              style={{
                gridArea: "1 / 1 / 2 / 2",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "0.5rem",
                minWidth: 0,
              }}
            >
              <h1 style={{ color: "white", margin: 0 }}>Quick Stats</h1>

              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "var(--medium-blue)",
                  padding: "1rem",
                  borderRadius: "4vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "stretch",
                  boxSizing: "border-box",
                  transition: "all 0.25s ease",
                }}
              >
                <div>
                  <h1 style={{ color: "white", marginBottom: "0.5rem", marginTop: 0 }}>Current Level</h1>
                  <RoadmapProgress isScore={false} text={currentLevel} />
                </div>

                <div>
                  <h1 style={{ color: "white", marginBottom: "0.5rem", marginTop: 0 }}>Roadmap Progress</h1>

                  <div
                    style={{
                      width: "100%",
                      height: "2vh",
                      backgroundColor: "#131F3F",
                      borderRadius: "1vh",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, completionPercent))}%`,
                        height: "100%",
                        backgroundColor: "#E6FFB2",
                        borderRadius: "1vh",
                      }}
                    />
                  </div>
                </div>

                <RoadmapProgress
                  done={String(completedTopics)}
                  text="Completed Topics"
                />

                <RoadmapProgress
                  done={String(remainingTopics)}
                  text="Remaining Topics"
                  color="#FFB2B2"
                />
              </div>
            </div>

            <div
              style={{
                gridArea: "1 / 2 / 2 / 3",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "0.5rem",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%" }}>
                <h1 style={{ color: "white", margin: 0 }}>
                  {selectedTrack?.title || "Track"} Roadmap
                </h1>

                {sectionAccessMessage ? (
                  <p style={{ margin: 0, color: "#FFD3D3", fontSize: "0.95rem" }}>
                    {sectionAccessMessage}
                  </p>
                ) : null}
              </div>

              <div
                style={{
                  backgroundColor: "#C1CBE6",
                  padding: "2rem",
                  borderRadius: "4vh",
                  minWidth: 0,
                  minHeight: 0,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  width: "100%",
                  flex: 1,
                  boxSizing: "border-box",
                }}
              >
                {steps.length ? (
                  <StepFlow
                    variant="dark"
                    steps={steps}
                    roadmapId={selectedTrack?.roadmapId || undefined}
                    selectedIndex={isSectionPanelOpen ? selectedIndex : undefined}
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
                gridArea: "2 / 1 / 3 / 2",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "0.5rem",
                minWidth: 0,
              }}
            >
              <h1 style={{ color: "white", margin: 0 }}>Test Your Skills</h1>

              <JourneyButton
                variant="sA"
                course="Start Assessment"
                style={{ width: "100%", height: "100%" }}
                onClick={openAssessmentPopup}
              />
            </div>

            <div
              style={{
                gridArea: "2 / 2 / 3 / 3",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "0.5rem",
                overflow: "hidden",
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {/* HEADER */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <h1 style={{ color: "white", margin: 0 }}>Courses</h1>

              </div>

              {/* SCROLL AREA */}
              <div
                style={{
                  width: "100%",
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,

                  overflowX: "auto",
                  overflowY: "hidden",

                  scrollbarWidth: "none",
                }}
              >
                {/* LOADING */}
                {isLoadingRoadmap && !roadmapCourses ? (
                  <div style={{ color: "white", opacity: 0.7 }}>
                    Loading courses...
                  </div>
                ) : null}

                {/* COURSES */}
                {!isLoadingRoadmap && activeCourseSection?.courses?.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap",
                      gap: "var(--space-md)",
                      width: "max-content",
                      maxHeight:"100%",
                    }}
                  >
                    {activeCourseSection.courses.map((course) => (
                      <div key={course.id} >
                        <CourseCard
                          title={course.title}
                          provider={course.provider}
                          status={courseStatusById?.[course.id] ?? "default"}
                          onSelect={() => handleCourseClick(course)}
                          style={{
                            maxHeight:"100%",
                            height:"100%",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* EMPTY STATE */}
                {!isLoadingRoadmap &&
                  (!activeCourseSection?.courses || activeCourseSection.courses.length === 0) ? (
                  <div style={{ color: "#C1CBE6" }}>
                    No courses available for this section.
                  </div>
                ) : null}
              </div>
            </div>

            {isSectionPanelOpen && selectedSection ? (
              <div
                style={{
                  gridArea: "1 / 3 / 3 / 4",
                  display: "flex",
                  flexDirection: "column",
                  padding: "1rem 1.35rem",
                  backgroundColor: "var(--medium-grey)",
                  borderRadius: "4vh",
                  alignItems: "center",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        fontSize: "1.35rem",
                        color: "white",
                        margin: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      {selectedSection.title}
                    </h2>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.65rem" }}>
                      <span
                        style={{
                          padding: "0.28rem 0.65rem",
                          borderRadius: "999px",
                          backgroundColor:
                            selectedSection.completionStatus === "completed"
                              ? "rgba(212, 255, 71, 0.18)"
                              : selectedSection.completionStatus === "in_progress"
                                ? "rgba(193, 203, 230, 0.2)"
                                : "rgba(255, 255, 255, 0.12)",
                          color:
                            selectedSection.completionStatus === "completed"
                              ? "var(--primary-green)"
                              : "white",
                          fontSize: "0.78rem",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      >
                        {selectedSectionStatus}
                      </span>

                      <span
                        style={{
                          padding: "0.28rem 0.65rem",
                          borderRadius: "999px",
                          backgroundColor: "rgba(255, 255, 255, 0.12)",
                          color: "white",
                          fontSize: "0.78rem",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      >
                        {selectedSection.completedSteps}/{selectedSection.totalSteps} topics
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSectionPreferenceId("")}
                    style={{
                      border: "none",
                      backgroundColor: "transparent",
                      color: "white",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src="/global/close.svg"
                      alt="Close section details"
                      style={{
                        width: "1.4rem",
                        height: "1.4rem",
                        filter: "invert(1)",
                      }}
                    />
                  </button>
                </div>

                <div
                  style={{
                    height: "0.1rem",
                    backgroundColor: "white",
                    width: "100%",
                    marginBottom: "1rem",
                  }}
                />

                <div
                  className="journey-section-scroll-box"
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
                    paddingRight: "0.2rem",
                  }}
                >
                  {Boolean(selectedSection.resources.length) ? (
                    <div
                      style={{
                        width: "100%",
                        marginBottom: "1rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.7rem",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "1.1rem",
                          color: "white",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      >
                        Resources:
                      </p>

                      {selectedSection.resources.map((resource) => {
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
                  ) : null}

                  {selectedSection.skills.length ? (
                    <p
                      style={{
                        margin: "0 0 1rem 0",
                        fontSize: "1.1rem",
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
                    {selectedSection.skills.map((skill, index) => (
                      <StepCheckbox
                        key={skill.id}
                        text={skill.text}
                        isChecked={skill.checked}
                        disabled={Boolean(selectedSection.locked)}
                        onToggle={() => {
                          void toggleSkill(index);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSystemError ? (
              <p
                style={{
                  margin: 0,
                  color: "#FFD3D3",
                  position: "absolute",
                  bottom: "16px",
                  right: "24px",
                  fontSize: "0.9rem",
                }}
              >
                {activeSystemError}
              </p>
            ) : null}

            <style jsx>{`
            .journey-section-scroll-box::-webkit-scrollbar {
              width: 0;
              height: 0;
            }
          `}</style>
          </div>
        )}
      />

      {activePopupCourse && activePopupMode ? (
        <CourseActionPopup
          mode={activePopupMode}
          courseTitle={activePopupCourse.title}
          courseOrg={activePopupCourse.provider}
          onConfirm={activePopupMode === "enroll" ? confirmEnrollment : confirmCompletion}
          onCancel={() => {
            setActivePopupCourse(null);
            setActivePopupMode(null);
          }}
          onContinue={activePopupMode === "complete" ? handleContinueCourse : undefined}
        />
      ) : null}

      {pendingAssessmentSection ? (
        <SkillConfirmPopup
          skillName={pendingAssessmentSection.title}
          isLoading={isStartingAssessment}
          testCode="Section Test"
          onCancel={() => {
            if (!isStartingAssessment) {
              setPendingAssessmentSection(null);
            }
          }}
          onConfirm={(questions) => {
            void handleStartAssessment(questions);
          }}
        />
      ) : null}
    </>
  );
}
