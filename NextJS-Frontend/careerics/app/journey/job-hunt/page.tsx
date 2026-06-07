"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BookmarkCard from "@/components/ui/BookmarkCard";
import ContinueCard from "@/components/ui/ContinueCard";
import TipCard from "@/components/ui/3ateyat";
import LevelCard from "@/components/ui/LevelCard";
import SkillConfirmPopup from "@/components/ui/skillConfirmPopup";
import { RectangularCard } from "@/components/ui/rectangular-card";
import JourneyTree from "@/components/ui/journey-tree";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { buildJourneyPhaseHref } from "@/lib/journey";
import { buildJobDetailsHref, mapApiJobToUiModel } from "@/lib/jobs";
import { useAuth } from "@/providers/auth-provider";
import { jobService, roadmapService, skillAssessmentService } from "@/services";
import type { JobUiModel, RoadmapListItem } from "@/types";
import { InlineContainer } from "@/components/ui/containers/inline";

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

export default function JourneyJobHuntPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    selectedTrack,
    maxReached,
    isLoadingTracks,
    trackError,
  } = useJourneyPhase(5);

  const [recentlyViewedJobs, setRecentlyViewedJobs] = useState<JobUiModel[]>([]);
  const [savedJobsCount, setSavedJobsCount] = useState(0);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
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

      if (!user?.id) {
        if (!isActive) {
          return;
        }

        setRecentlyViewedJobs([]);
        setSavedJobsCount(0);
        setApplicationsCount(0);
        setJobsError("Sign in to load your saved, recent, and applied jobs.");
        setIsLoading(false);
        return;
      }

      const [recentResponse, savedResponse, applicationsResponse] = await Promise.all([
        jobService.getRecentlyViewedJobs(user.id, { limit: 12 }),
        jobService.getSavedJobs(user.id, { limit: 1 }),
        jobService.getUserApplications(user.id, { limit: 1 }),
      ]);

      if (!isActive) {
        return;
      }

      setRecentlyViewedJobs(
        recentResponse.success
          ? recentResponse.data.jobs.map(mapApiJobToUiModel)
          : [],
      );
      setSavedJobsCount(savedResponse.success ? savedResponse.data?.total ?? 0 : 0);
      setApplicationsCount(applicationsResponse.success ? applicationsResponse.data?.total ?? 0 : 0);
      setJobsError(
        recentResponse.success && savedResponse.success && applicationsResponse.success
          ? null
          : recentResponse.message ||
          savedResponse.message ||
          applicationsResponse.message ||
          "Unable to load job dashboard data.",
      );
      setIsLoading(false);
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, user?.id]);

  const bookmarkDescription = useMemo(() => {
    if (!savedJobsCount) {
      return "Save jobs from Job Search to keep your high-fit roles organized.";
    }

    return `${savedJobsCount} saved job${savedJobsCount === 1 ? "" : "s"} ready for review.`;
  }, [savedJobsCount]);

  const continueDescription = useMemo(() => {
    if (!applicationsCount) {
      return "Your next opportunity awaits.";
    }

    return `${applicationsCount} tracked application${applicationsCount === 1 ? "" : "s"} so far.`;
  }, [applicationsCount]);

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

    if (user?.id) {
      const sessionsRes = await skillAssessmentService.getUserSessions(user.id);
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
    user?.id,
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

  // Delay render until all data is ready
  const isInitializing = isLoadingTracks || isLoading || isAuthLoading;

  const { isLarge, isMedium, isSmall } = useResponsive();
  const Orientation = isLarge ? JourneyTree : JourneyTreeVertical;

  if (isInitializing && !selectedTrack) {
    return (
      <Orientation
        current={5}
        maxReached={5}
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
                Loading job opportunities...
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

  if (!selectedTrack && !isLoadingTracks) {
    return (
      <Orientation
        current={5}
        maxReached={5}
        renderContent={() => (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              padding: "40px",
              gap: "1rem",
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>No Track Selected</h1>
            <p style={{ margin: 0, color: "#C1CBE6", maxWidth: "60ch" }}>
              Select a track from Home first, then continue your journey phases.
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

  const RecentlyViewed = isSmall ? StackContainer : InlineContainer;
  return (
    <Orientation
      current={5}
      maxReached={5}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack?.id)}
      renderContent={() => (
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
        flexGrow: 0,
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

          <div style={{ gridArea: "3 / 1 / 4 / 2" }}>
            <LevelCard
              style={{ backgroundColor: "var(--medium-blue)" }}
              onClick={handleStartTestClick}
            />
          </div>

          <InlineContainer
            style={{ gridArea: "3 / 2 / 4 / 5", backgroundColor: "var(--medium-blue)" }}
            Title="Recently Viewed"
            centerTitle
          >
            {recentlyViewedJobs.length ? (
              recentlyViewedJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => router.push(buildJobDetailsHref(job.id))}
                  style={{ cursor: "pointer" }}
                >
                  <RectangularCard
                    Title={job.title}
                    isSubtextVisible
                    subtext={job.company}
                    font="nova"
                    variant="radio"
                    style={{ height: "70%" }}
                  />
                </div>
              ))
            ) : !isLoading ? (
              <div style={{ display: "flex", alignItems: "center", color: "white", opacity: 0.8 }}>
                No recently viewed jobs yet.
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", color: "white", opacity: 0.8 }}>
                Loading jobs...
              </div>
            )}
          </InlineContainer>

          {trackError || jobsError ? (
            <p style={{ margin: 0, color: "#FFD3D3", gridArea: "3 / 2 / 4 / 5", alignSelf: "end" }}>
              {trackError || jobsError}
            </p>
          ) : null}

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
      )}
    />
  );
}
