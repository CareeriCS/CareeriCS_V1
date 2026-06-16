"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookmarkCard from "@/components/ui/BookmarkCard";
import ContinueCard from "@/components/ui/ContinueCard";
import TipCard from "@/components/ui/3ateyat";
import LevelCard from "@/components/ui/LevelCard";
import SkillConfirmPopup from "@/components/ui/skillConfirmPopup";
import { RectangularCard } from "@/components/ui/rectangular-card";
import { mapApiJobToUiModel } from "@/lib/jobs";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { useAuth } from "@/providers/auth-provider";
import { jobService, roadmapService, skillAssessmentService } from "@/services";
import type { JobUiModel, RoadmapListItem } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import { InlineContainer } from "@/components/ui/containers/inline";
import { StackContainer } from "@/components/ui/containers/stack";

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

export default function JobHunt() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id;
  const { selectedTrack } = useJourneyPhase(5);
  const [recentlyViewedJobs, setRecentlyViewedJobs] = useState<JobUiModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([]);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(true);
  const [roadmapsError, setRoadmapsError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [nextTestCode, setNextTestCode] = useState("Test_001");
  const [selectedAssessmentOptionId, setSelectedAssessmentOptionId] = useState("");

  const selectedAssessmentOption = useMemo(
    () => roadmaps.find((roadmap) => roadmap.id === selectedAssessmentOptionId) || null,
    [roadmaps, selectedAssessmentOptionId],
  );

  useEffect(() => {
    let alive = true;

    const loadRoadmaps = async () => {
      setIsLoadingRoadmaps(true);
      setRoadmapsError(null);

      const response = await roadmapService.listRoadmaps();
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setRoadmaps([]);
        setRoadmapsError(response.message || "Unable to load roadmaps.");
        setIsLoadingRoadmaps(false);
        return;
      }

      setRoadmaps(normalizeRoadmapListPayload(response.data));
      setIsLoadingRoadmaps(false);
    };

    void loadRoadmaps();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      if (!userId) {
        if (!isActive) {
          return;
        }

        setRecentlyViewedJobs([]);
        setIsLoading(false);
        return;
      }

      const recentResponse = await jobService.getRecentlyViewedJobs(userId, { limit: 12 });

      if (!isActive) {
        return;
      }

      setRecentlyViewedJobs(
        recentResponse.success
          ? recentResponse.data.jobs.map(mapApiJobToUiModel)
          : [],
      );
      setIsLoading(false);
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, userId]);

  const { isLarge, isMedium, isSmall, width } = useResponsive();
  const RecentlyViewed = isSmall ? StackContainer : InlineContainer;

  const handleRecentlyViewedJobClick = useCallback((job: JobUiModel) => {
    if (!job.jobUrl || typeof window === "undefined") {
      return;
    }

    window.open(job.jobUrl, "_blank", "noopener,noreferrer");
  }, []);

  const resolveDefaultAssessmentOptionId = useCallback(() => {
    if (
      selectedTrack?.roadmapId &&
      roadmaps.some((roadmap) => roadmap.id === selectedTrack.roadmapId)
    ) {
      return selectedTrack.roadmapId;
    }

    return roadmaps[0]?.id || "";
  }, [roadmaps, selectedTrack]);

  const handleStartTestClick = useCallback(async () => {
    setAssessmentError("");

    if (isLoadingRoadmaps || isAuthLoading) {
      return;
    }

    if (!roadmaps.length) {
      setAssessmentError(roadmapsError || "No roadmap assessment is available yet.");
      return;
    }

    setSelectedAssessmentOptionId(resolveDefaultAssessmentOptionId());

    if (userId) {
      const sessionsRes = await skillAssessmentService.getUserSessions(userId);
      const submittedCount =
        sessionsRes.success && sessionsRes.data
          ? sessionsRes.data.filter((session) => session.status === "submitted").length
          : 0;
      setNextTestCode(`Test_${String(submittedCount + 1).padStart(3, "0")}`);
    }

    setIsConfirmOpen(true);
  }, [
    isAuthLoading,
    isLoadingRoadmaps,
    resolveDefaultAssessmentOptionId,
    roadmaps.length,
    roadmapsError,
    userId,
  ]);

  const handleStartAssessment = (questions: number) => {
    if (!selectedAssessmentOption) {
      return;
    }

    setIsStarting(true);

    const params = new URLSearchParams({
      targetId: selectedAssessmentOption.id,
      targetName: selectedAssessmentOption.title,
      sessionType: "roadmap",
      numQuestions: String(questions),
    });

    setIsConfirmOpen(false);
    router.push(`/skill-feature/questions?${params.toString()}`);
    setIsStarting(false);
  };

  return (
    <div
      style={{
        display: "grid",

        gridTemplateColumns: isLarge
          ? "1fr 2fr repeat(2, 1fr)"
          : isMedium
            ? "3fr 1fr"
            : "2fr 1fr",

        gridTemplateRows: isLarge
          ? "repeat(3, 1fr)"
          : isMedium
            ? "repeat(4, 1fr)"
            : "repeat(4, 1fr)",

        gridColumnGap: "var(--space-lg)",
        gridRowGap: "var(--space-lg)",

        padding: "var(--space-xl)",

        width: "100%",
        height: "100%",
      }}
    >
      {/* BOOKMARK CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "1 / 1 / 2 / 3"
            : isMedium
              ? "2 / 1 / 3 / 3"
              : "2 / 1 / 3 / 3",
        }}
      >
        <BookmarkCard description="All of your saved jobs are here" />
      </div>

      {/* CONTINUE CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "1 / 3 / 2 / 5"
            : isMedium
              ? "1 / 1 / 2 / 2"
              : "1 / 1 / 2 / 2",
        }}
      >
        <ContinueCard 
        description="Your next opportunity awaits" 
        style={{
          backgroundColor: isSmall?"var(--medium-blue)":"var(--dark-blue)",
        }} />
      </div>

      {/* TIP CARD */}

      {(!isSmall &&
        <div
          style={{
            gridArea: isLarge
              ? "2 / 1 / 3 / 5"
              : "3 / 1 / 4 / 3"
          }}
        >
          <TipCard
            title="Tip of the day"
            description="Research the company and interviewers before your interview so you understand the company's goals and show how you fit."
            icon="/global/tip.svg"
          />
        </div>
      )}

      {/* LEVEL CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "3 / 1 / 4 / 2"
            : isMedium
              ? "1 / 2 / 2 / 3"
              : "1 / 2 / 2 / 3",
        }}
      >
        <LevelCard onClick={handleStartTestClick} />
      </div>

      {/* RECENTLY VIEWED */}
      <RecentlyViewed
        style={{
          gridArea: isLarge
            ? "3 / 2 / 4 / 5"
            : isMedium
              ? "4 / 1 / 5 / 3"
              : "3 / 1 / 5 / 3",

          backgroundColor: "var(--dark-blue)",
        }}
        Title="Recently Viewed"
        centerTitle
        >
        {recentlyViewedJobs.length ? (
          recentlyViewedJobs.map((job) => (
            <RectangularCard
              key={job.id}
              Title={job.title}
              titleVariant={isSmall ? "full" : "clip"}
              isSubtextVisible
              subtext={job.company}
              variant="radio"
              font="nova"
              selectable
              onSelect={() => handleRecentlyViewedJobClick(job)}
              style={{
                width: "100%",
                flex: 1,
              }}
            />
          ))
        ) : !isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "white",
              opacity: 0.8,
            }}
          >
            No recently viewed jobs yet.
          </div>
        ) : null}
      </RecentlyViewed>

      {assessmentError ? (
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
          {assessmentError}
        </div>
      ) : null}

      {isConfirmOpen && roadmaps.length > 0 ? (
        <SkillConfirmPopup
          skillName={selectedAssessmentOption?.title || roadmaps[0].title}
          skillOptions={roadmaps.map((roadmap) => ({
            id: roadmap.id,
            label: roadmap.title,
          }))}
          selectedSkillId={selectedAssessmentOptionId}
          onSkillChange={setSelectedAssessmentOptionId}
          isLoading={isStarting}
          testCode={nextTestCode}
          onCancel={() => {
            if (!isStarting) {
              setIsConfirmOpen(false);
            }
          }}
          onConfirm={handleStartAssessment}
        />
      ) : null}
    </div>
  );
}
