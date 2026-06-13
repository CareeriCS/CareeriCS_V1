"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import RoadmapProgress from "@/components/ui/roadmapProgress";
import CourseActionPopup from "@/components/ui/course-action-popup";
import { CourseCard } from "@/components/ui/courseCards";
import { SearchBar } from "@/components/ui/searchbar";
import { useAuth } from "@/providers/auth-provider";
import { roadmapService } from "@/services";
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  completeCourse,
  enrollCourse,
  loadCourseProgress,
  syncCourseProgressFromServer,
  type CourseProgressState,
} from "@/lib/course-progress";
import type { RoadmapCoursesRead } from "@/types";
import {
  hasComputerScienceUiText,
  isHiddenComputerScienceCourse,
  isHiddenComputerScienceOption,
} from "@/lib/hidden-ui-items";

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex w-full items-start justify-center gap-[var(--space-md)] px-[var(--space-xl)] py-[var(--space-xl)] text-[var(--text-secondary)] sm:px-[var(--space-2xl)]">
      <LoaderCircle size={22} className="course-page-spinner" />
      <span style={{ fontFamily: "var(--font-jura), sans-serif" }}>{label}</span>
      <style jsx>{`
        .course-page-spinner {
          animation: course-page-spin 1s linear infinite;
        }
        @keyframes course-page-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function CourseLibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roadmapId = searchParams.get("roadmapId") || "";
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [roadmapCourses, setRoadmapCourses] = useState<RoadmapCoursesRead | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgressState>({ current: [], completed: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseProgressError, setCourseProgressError] = useState<string | null>(null);
  const [activePopupMode, setActivePopupMode] = useState<"enroll" | "complete" | "retake" | null>(null);
  const [activePopupCourse, setActivePopupCourse] = useState<
    RoadmapCoursesRead["sections"][number]["courses"][number] | null
  >(null);

  useEffect(() => {
    let alive = true;

    const loadRoadmapCourses = async () => {
      if (!roadmapId) {
        setRoadmapCourses(null);
        setError("Please choose a roadmap first.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const response = await roadmapService.getRoadmapCourses(roadmapId);
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setRoadmapCourses(null);
        setError(response.message || "Unable to load roadmap courses right now.");
        setIsLoading(false);
        return;
      }

      setRoadmapCourses(response.data);
      setError(null);
      setIsLoading(false);
    };

    void loadRoadmapCourses();

    return () => {
      alive = false;
    };
  }, [roadmapId]);

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

  const filteredSections = useMemo(() => {
    if (!roadmapCourses) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return roadmapCourses.sections;
    }

    return roadmapCourses.sections
      .map((section) => ({
        ...section,
        courses: section.courses.filter((course) => {
          const haystack = `${course.title} ${course.provider} ${course.description || ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((section) => section.courses.length > 0 || section.section_title.toLowerCase().includes(normalizedSearch));
  }, [roadmapCourses, searchTerm]);

  const courseStatusById: Partial<Record<string, "enrolled" | "completed">> = {};

  for (const course of courseProgress.current) {
    courseStatusById[course.id] = "enrolled";
  }

  for (const course of courseProgress.completed) {
    courseStatusById[course.id] = "completed";
  }

  const visibleSections = useMemo(() => {
    if (!roadmapCourses) return [];

    const roadmapTitle = roadmapCourses.roadmap_title;
    if (
      isHiddenComputerScienceOption({ title: roadmapTitle }) ||
      hasComputerScienceUiText(roadmapTitle)
    ) {
      return [];
    }

    return filteredSections
      .map((section) => ({
        ...section,
        courses: section.courses.filter(
          (course) =>
            !isHiddenComputerScienceCourse(course, { roadmapTitle }),
        ),
      }))
      .filter((section) => section.courses.length > 0);
  }, [filteredSections, roadmapCourses]);

  const totalTopics = visibleSections.length;
  const totalCourses = visibleSections.reduce((acc, section) => acc + section.courses.length, 0);
  const completedCount = visibleSections.reduce(
    (acc, section) =>
      acc + section.courses.filter((course) => courseStatusById[course.id] === "completed").length,
    0,
  );

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

  if (isLoading) {
    return <LoadingState label="Loading courses..." />;
  }

  if (error) {
    return (
      <div
        className="flex min-h-[18.75rem] w-full items-center justify-center px-[var(--space-xl)] py-[var(--space-xl)] text-center text-[var(--text-danger)] sm:px-[var(--space-2xl)]"
        style={{ fontFamily: "var(--font-jura), sans-serif" }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="no-scrollbar flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden px-[var(--space-xl)] py-[var(--space-xl)] text-[var(--text-primary)] sm:px-[var(--space-2xl)]"
      style={{
        fontFamily: "var(--font-nova-square), sans-serif",
        scrollbarWidth: "none",
      }}
    >
      {courseProgressError ? (
        <div
          className="mb-[var(--space-md)] text-[var(--text-danger)]"
          style={{ fontFamily: "var(--font-jura), sans-serif" }}
        >
          {courseProgressError}
        </div>
      ) : null}

      <header className="mb-[var(--space-xl)] flex flex-col gap-[var(--space-md)]">
        <div className="flex flex-col gap-[var(--space-md)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="m-0 text-[length:var(--text-xl)] font-normal leading-[var(--line-tight)]">
            {roadmapCourses?.roadmap_title || "Courses"}
          </h1>

          <div className="flex w-full items-center gap-[var(--space-md)] sm:w-auto sm:justify-end">
            <div className="min-w-0 flex-1 sm:max-w-[22rem]">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="search"
                inputStyle={{ width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Close courses"
              className="flex h-[var(--icon-lg)] w-[var(--icon-lg)] shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 transition hover:bg-[var(--light-red)]"
            >
              <img
                src="/global/close.svg"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain"
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-xl)]">
          <RoadmapProgress text="All Topics" done={String(totalTopics)} />
          <RoadmapProgress text="All Courses" done={String(totalCourses)} />
          <RoadmapProgress
            text="Completed Courses"
            done={String(completedCount)}
            total={String(totalCourses)}
          />
        </div>
      </header>

      <hr className="mb-[var(--space-lg)] w-full border-0 border-t-2 border-[var(--border-muted)]" />

      <div className="flex min-h-0 flex-1 flex-col gap-[var(--space-md)] pb-[var(--space-lg)]">
        {visibleSections.length ? (
          visibleSections.map((section) => (
            <section
              key={section.section_id}
              className="flex flex-col gap-[var(--space-md)]"
            >
              <h3 className="m-0 text-[length:var(--text-md)] font-normal leading-[var(--line-normal)]">
                {section.section_title}:
              </h3>

              <div className="grid w-full grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {section.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    title={course.title}
                    provider={course.provider}
                    status={courseStatusById?.[course.id] ?? "default"}
                    onSelect={
                      handleCourseClick
                        ? () => handleCourseClick(course)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div
            className="text-center text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-jura), sans-serif" }}
          >
            No courses matched your search.
          </div>
        )}
      </div>

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
    </div>
  );
}
