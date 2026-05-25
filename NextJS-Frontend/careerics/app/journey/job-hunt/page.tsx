"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BookmarkCard from "@/components/ui/BookmarkCard";
import ContinueCard from "@/components/ui/ContinueCard";
import TipCard from "@/components/ui/3ateyat";
import LevelCard from "@/components/ui/LevelCard";
import { RectangularCard } from "@/components/ui/rectangular-card";
import JourneyTree from "@/components/ui/journey-tree";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { buildJourneyPhaseHref } from "@/lib/journey";
import { buildJobDetailsHref, mapApiJobToUiModel } from "@/lib/jobs";
import { useAuth } from "@/providers/auth-provider";
import { jobService } from "@/services";
import type { JobUiModel } from "@/types";
import { InlineContainer } from "@/components/ui/containers/inline";

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

  // Delay render until all data is ready
  const isInitializing = isLoadingTracks || isLoading || isAuthLoading;
  if (isInitializing && !selectedTrack) {
    return (
      <JourneyTree
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
      <JourneyTree
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


  return (
    <JourneyTree
      current={5}
      maxReached={5}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack?.id)}
      renderContent={() => (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr repeat(2, 1fr)",
          gridTemplateRows: "repeat(3,1fr)",
          gridColumnGap: "15px",
          gridRowGap: "15px",
          width: "100%",
          height: "100%",
          padding: "45px",
        }}>
          <div style={{ gridArea: "1 / 1 / 2 / 3" }}>
            <BookmarkCard description={bookmarkDescription} />
          </div>

          <div style={{ gridArea: "1 / 3 / 2 / 5" }}>
            <ContinueCard description={continueDescription} />
          </div>

          <div style={{ gridArea: "2 / 1 / 3 / 5" }}>
            <TipCard
              title="Tip of the day"
              description="Prioritize roles with strong fit and clear requirements, then tailor your CV before applying."
              icon="/global/tip.svg"
            />
          </div>

          <div style={{ gridArea: "3 / 1 / 4 / 2" }}>
            <LevelCard
              style={{ backgroundColor: "var(--medium-blue)" }}
              onClick={() => router.push("/features/skill")}
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
        </div>
      )}
    />
  );
}
