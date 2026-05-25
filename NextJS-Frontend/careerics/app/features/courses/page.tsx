"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { InlineContainer } from "@/components/ui/containers/inline";
import { StackContainer } from "@/components/ui/containers/stack";
import { FlexContainer } from "@/components/ui/containers/flex";
import { RectangularCard } from "@/components/ui/rectangular-card";
import { ActivityCard } from "@/components/ui/activity-card";
import CourseActionPopup from "@/components/ui/course-action-popup";
import { useAuth } from "@/providers/auth-provider";
import { roadmapService } from "@/services";
import type { RoadmapListItem } from "@/types";
import {
  COURSE_PROGRESS_UPDATED_EVENT,
  completeCourse,
  loadCourseProgress,
  retakeCourse as restartCourse,
  syncCourseProgressFromServer,
  type CourseProgressItem,
} from "@/lib/course-progress";
import { useResponsive } from "@/hooks/useResponsive";

function LoadingState({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "#D7E3FF",
        fontFamily: "var(--font-jura)",
      }}
    >
      <LoaderCircle size={20} className="courses-spinner" />
      <span>{label}</span>
      <style jsx>{`
        .courses-spinner {
          animation: courses-spin 1s linear infinite;
        }
        @keyframes courses-spin {
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

function EmptyCoursesState({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#D7E3FF",
        fontFamily: "var(--font-jura)",
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      {label}
    </div>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [currentCourses, setCurrentCourses] = useState<CourseProgressItem[]>([]);
  const [completedCourses, setCompletedCourses] = useState<CourseProgressItem[]>([]);
  const [pendingCompletionCourse, setPendingCompletionCourse] = useState<CourseProgressItem | null>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState("");
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([]);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(false);
  const [roadmapsError, setRoadmapsError] = useState<string | null>(null);
  const [pendingRetakeCourse, setPendingRetakeCourse] = useState<CourseProgressItem | null>(null);
  const [courseProgressError, setCourseProgressError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadRoadmaps = async () => {
      setIsLoadingRoadmaps(true);

      const response = await roadmapService.listRoadmaps();
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setRoadmaps([]);
        setRoadmapsError(response.message || "Unable to load roadmaps right now.");
        setIsLoadingRoadmaps(false);
        return;
      }

      setRoadmaps(response.data);
      setSelectedRoadmapId((previous) => previous || response.data[0]?.id || "");
      setRoadmapsError(null);
      setIsLoadingRoadmaps(false);
    };

    void loadRoadmaps();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const syncCourseProgress = async () => {
      const progress = user?.id
        ? await syncCourseProgressFromServer(user.id)
        : loadCourseProgress(user?.id);

      if (!alive) {
        return;
      }

      setCurrentCourses(progress.current);
      setCompletedCourses(progress.completed);
      setSelectedCourseId((previous) => {
        if (progress.current.some((course) => course.id === previous)) {
          return previous;
        }

        return progress.current[0]?.id || "";
      });
    };

    void syncCourseProgress();

    const handleCourseProgressUpdated = () => {
      const progress = loadCourseProgress(user?.id);

      setCurrentCourses(progress.current);
      setCompletedCourses(progress.completed);
      setSelectedCourseId((previous) => {
        if (progress.current.some((course) => course.id === previous)) {
          return previous;
        }

        return progress.current[0]?.id || "";
      });
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

  const handleCurrentCourseClick = (course: CourseProgressItem) => {
    setSelectedCourseId(course.id);
    setPendingCompletionCourse(course);
  };

  const confirmCompletion = async () => {
    if (!pendingCompletionCourse) {
      return;
    }

    try {
      setCourseProgressError(null);
      const progress = await completeCourse(pendingCompletionCourse.id, user?.id);
      setCurrentCourses(progress.current);
      setCompletedCourses(progress.completed);
      setSelectedCourseId(progress.current[0]?.id || "");
      setPendingCompletionCourse(null);
    } catch (syncError) {
      setCourseProgressError(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync course progress right now.",
      );
    }
  };

  const handleContinueCurrentCourse = () => {
    if (pendingCompletionCourse?.url) {
      window.open(pendingCompletionCourse.url, "_blank", "noopener,noreferrer");
    }

    setPendingCompletionCourse(null);
  };

  const confirmRetake = async (course: CourseProgressItem) => {
    try {
      setCourseProgressError(null);
      const progress = await restartCourse(course.id, user?.id);

      setCurrentCourses(progress.current);
      setCompletedCourses(progress.completed);
      setSelectedCourseId(course.id);
      setPendingRetakeCourse(null);

      if (course.url) {
        window.open(course.url, "_blank", "noopener,noreferrer");
      }
    } catch (syncError) {
      setCourseProgressError(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync course progress right now.",
      );
    }
  };

  const { isLarge, isMedium, isSmall } = useResponsive();

  const CompletedCourses = isSmall ? InlineContainer : StackContainer;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: !isSmall ? isMedium ? "1.5fr 1fr" : "repeat(2, 1fr) repeat(2, 2fr)" : "1fr",
        gridTemplateRows: !isSmall ? isMedium ? "1fr 2fr" : "1fr repeat(5, 1fr)" : "repeat(2, 1fr) 2fr",
        gridColumnGap: "var(--space-lg)",
        gridRowGap: "var(--space-lg)",
        height: "100%",
        width: "100%",
        padding: "var(--space-lg)",
      }}
    >
      {courseProgressError ? (
        <div
          style={{
            gridColumn: "1 / -1",
            color: "#FFD3D3",
            fontFamily: "var(--font-jura)",
            marginBottom: "-4px",
          }}
        >
          {courseProgressError}
        </div>
      ) : null}
      <InlineContainer
        Title="Courses you are currently taking"
        style={{ gridArea: isSmall ? "1 / 1 / 2 / 2" : isMedium ? "1 / 1 / 2 / 3" : "1 /1 /3 /5", width: "100%" }}
      >
        {currentCourses.map((course) => (
          <RectangularCard
            key={course.id}
            Title={course.title}
            variant="radio"
            theme="light"
            subtext={`by ${course.provider}`}
            isSubtextVisible={true}
            selectable
            selected={selectedCourseId === course.id}
            onSelect={() => handleCurrentCourseClick(course)}

          />
        ))}
      </InlineContainer>

      <FlexContainer
        Title="More fields to discover"
        style={{ gridArea: isSmall ? "3 / 1 / 4 / 2" : isMedium ? "2 / 1 / 3 / 2" : "3 / 1 / 7 / 4", backgroundColor: "var(--dark-blue)" }}
      >
        {isLoadingRoadmaps ? <LoadingState label="Loading roadmaps..." /> : null}

        {!isLoadingRoadmaps && roadmapsError ? (
          <div
            style={{
              gridColumn: "1 / -1",
              color: "#FFD3D3",
              fontFamily: "var(--font-jura)",
              textAlign: "center",
              paddingInline: "20px",
            }}
          >
            {roadmapsError}
          </div>
        ) : null}

        {!isLoadingRoadmaps && !roadmapsError && !roadmaps.length ? (
          <div
            style={{
              gridColumn: "1 / -1",
              color: "#D7E3FF",
              fontFamily: "var(--font-jura)",
              textAlign: "center",
              paddingInline: "20px",
            }}
          >
            No roadmaps available yet.
          </div>
        ) : null}

        {!isLoadingRoadmaps && !roadmapsError
          ? roadmaps.map((roadmap) => (
            <RectangularCard
              key={roadmap.id}
              Title={roadmap.title}
              theme="dark"
              selectable
              selected={selectedRoadmapId === roadmap.id}
              onSelect={() => {
                setSelectedRoadmapId(roadmap.id);
                router.push(`/courses?roadmapId=${encodeURIComponent(roadmap.id)}`);
              }}
              variant="radio"
              style={{
                flex: 1,
                whiteSpace: "nowrap",
              }}
            />
          ))
          : null}
      </FlexContainer>

      <CompletedCourses
        Title="Completed Courses"
        centerTitle
        style={{ gridArea: isSmall ? "2 / 1 / 3 / 2" :isMedium ? "2 / 2 / 3 / 3" : "3 / 4 / 7 / 5", width: "100%", backgroundColor: "var(--dark-blue)" }}
      >
        {completedCourses.length ? (
          completedCourses.map((course) => (
            <ActivityCard
              variant="retake"
              key={course.id}
              title={course.title}
              provider={course.provider}
              onClick={() => setPendingRetakeCourse(course)}
            />
          ))
        ) : (
          <EmptyCoursesState label="Complete a course and it will show up here." />
        )}
      </CompletedCourses>

      {pendingCompletionCourse ? (
        <CourseActionPopup
          mode="complete"
          courseTitle={pendingCompletionCourse.title}
          courseOrg={pendingCompletionCourse.provider}
          onConfirm={confirmCompletion}
          onCancel={() => setPendingCompletionCourse(null)}
          onContinue={handleContinueCurrentCourse}
        />
      ) : null}

      {pendingRetakeCourse ? (
        <CourseActionPopup
          mode="retake"
          courseTitle={pendingRetakeCourse.title}
          courseOrg={pendingRetakeCourse.provider}
          onConfirm={() => confirmRetake(pendingRetakeCourse)}
          onCancel={() => setPendingRetakeCourse(null)}
        />
      ) : null}
    </div>
  );
}
