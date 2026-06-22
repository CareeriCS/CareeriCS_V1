"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import JobCard from "@/components/ui/jobCard";
import JobDetailsCard from "@/components/ui/JobDetailsCard";
import { useRouter } from "next/navigation";
import {
  clearPersistedSelectedJobId,
  mapApiJobToUiModel,
  persistSelectedJobId,
  readSelectedJobIdFromUrl,
  replaceSelectedJobIdInUrl,
} from "@/lib/jobs";
import { useAuth } from "@/providers/auth-provider";
import { jobService } from "@/services";
import type { JobApplicationStatus, JobUiModel } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import { SearchBar } from "@/components/ui/searchbar";

export default function BookmarkedJobs() {
  const { isLarge, isMedium, isSmall } = useResponsive();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [jobs, setJobs] = useState<JobUiModel[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const urlJobIdRef = useRef<string | null>(readSelectedJobIdFromUrl());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [bookmarkingJobId, setBookmarkingJobId] = useState<string | null>(null);

  // ── Separate boolean to control the floating modal on compact screens ──
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const isCompactScreen = isSmall || isMedium;

  // ── Close modal when viewport grows to large (side panel takes over) ──
  useEffect(() => {
    if (isLarge) {
      setIsDetailsModalOpen(false);
    }
  }, [isLarge]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isActive = true;

    const loadSavedJobs = async () => {
      setIsLoading(true);
      setError(null);

      if (!user?.id) {
        setJobs([]);
        setIsLoading(false);
        setError("Please sign in to view your saved jobs.");
        return;
      }

      const response = await jobService.getAllSavedJobs(user.id);
      if (!isActive) {
        return;
      }

      if (response.success) {
        setJobs(response.data.map(mapApiJobToUiModel));
      } else {
        setJobs([]);
        setError(response.message ?? "We could not load your saved jobs.");
      }

      setIsLoading(false);
    };

    void loadSavedJobs();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, user?.id]);

  useEffect(() => {
    if (!jobs.length) {
      if (selectedJobId !== null) {
        const timeoutId = window.setTimeout(() => setSelectedJobId(null), 0);
        return () => window.clearTimeout(timeoutId);
      }
      return;
    }

    if (selectedJobId && jobs.some((job) => job.id === selectedJobId)) {
      return;
    }

    if (!urlJobIdRef.current) {
      return;
    }

    if (jobs.some((job) => job.id === urlJobIdRef.current)) {
      const timeoutId = window.setTimeout(() => setSelectedJobId(urlJobIdRef.current), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      replaceSelectedJobIdInUrl(null);
      urlJobIdRef.current = null;
      return;
    }

    persistSelectedJobId(selectedJobId);
    replaceSelectedJobIdInUrl(selectedJobId);
    urlJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return jobs;
    }

    return jobs.filter((job) => (
      job.title.toLowerCase().includes(normalizedSearch)
      || job.company.toLowerCase().includes(normalizedSearch)
    ));
  }, [jobs, searchTerm]);

  const updateSingleJob = (jobId: string, updater: (job: JobUiModel) => JobUiModel) => {
    setJobs((currentJobs) => currentJobs.map((job) => (
      job.id === jobId ? updater(job) : job
    )));
  };

  const handleBookmarkToggle = async (job: JobUiModel) => {
    if (!user?.id) {
      setError("Please sign in to manage saved jobs.");
      return;
    }

    setBookmarkingJobId(job.id);
    const response = await jobService.unsaveJob(job.id, user.id);

    if (response.success) {
      jobService.invalidateJobList(user.id);
      setJobs((currentJobs) => currentJobs.filter((currentJob) => currentJob.id !== job.id));

      if (selectedJobId === job.id) {
        clearPersistedSelectedJobId();
        setSelectedJobId(null);
        setIsDetailsModalOpen(false);
      }
    } else {
      setError(response.message ?? "We could not update this bookmark.");
    }

    setBookmarkingJobId(null);
  };

  const handleApply = async () => {
    if (!selectedJob || !user?.id) {
      return;
    }

    const nextStatus = (selectedJob.applicationStatus ?? "applied") as JobApplicationStatus;

    try {
      if (selectedJob.jobUrl && typeof window !== "undefined") {
        window.open(selectedJob.jobUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // ignore popup errors and continue
    }

    setIsApplying(true);
    const response = await jobService.applyToJob(selectedJob.id, user.id, nextStatus);

    if (response.success) {
      jobService.invalidateJobList(user.id);
      updateSingleJob(selectedJob.id, (currentJob) => ({
        ...currentJob,
        applicationStatus: response.data.status,
        appliedAt: response.data.applied_at,
      }));
    } else {
      setError(response.message ?? "We could not submit your application.");
    }

    setIsApplying(false);
  };

  const handleCardSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    // Only open the floating modal on compact screens;
    // on large screens the side panel handles it.
    if (isCompactScreen) {
      setIsDetailsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsDetailsModalOpen(false);
  };

  const renderBookmarkCards = () => {
    if (isLoading) {
      return <p style={{ color: "white", margin: 0 }}>Loading jobs...</p>;
    }

    if (!filteredJobs.length) {
      return <p style={{ color: "white", margin: 0 }}>No bookmarked jobs found.</p>;
    }

    return filteredJobs.map((job) => (
      <div
        key={job.id}
        onClick={() => handleCardSelect(job.id)}
        style={{ cursor: "pointer" }}
      >
        <JobCard
          {...job}
          isBookmarked={job.isSaved}
          isBookmarkLoading={bookmarkingJobId === job.id}
          onBookmarkToggle={() => handleBookmarkToggle(job)}
          isSelected={job.id === selectedJobId}
        />
      </div>
    ));
  };

  const router = useRouter();

  return (
    <div
      style={{
        padding: "var(--space-xl)",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
      }}
    >
      {/* ── Floating modal for small / medium screens ── */}
      {isDetailsModalOpen && selectedJob && (
        <div
          onClick={handleCloseModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(10, 10, 10, 0.75)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: isSmall ? "var(--space-md)" : "var(--space-lg)",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isSmall ? "90vw" : "70vw",
              maxWidth: "var(--container-lg)",
              maxHeight: "85vh",
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              backgroundColor: "transparent",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <JobDetailsCard
              jobData={selectedJob}
              onApply={handleApply}
              onClose={handleCloseModal}
              isApplying={isApplying}
              actionLabel="Apply"
              isApplyDisabled={false}
            />
          </div>
        </div>
      )}

      {/* ── Header row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            color: "white",
            fontFamily: "Nova Square, sans-serif",
            fontSize: "var(--text-xl)",
          }}
        >
          Bookmarked Jobs
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "var(--space-md)",
          }}
        >
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search jobs..."
          />
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: "var(--icon-lg)",
              height: "var(--icon-lg)",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--light-red)", marginTop: 0, fontSize: "var(--text-sm)" }}>
          {error}
        </p>
      )}

      {/* ── Main content area ── */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: "calc(var(--space-xl) * 2)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Left panel — card list */}
        <div
          style={{
            // On compact screens take full width; on large share space with the side panel
            width: isCompactScreen ? "100%" : "fit-content",
            maxWidth: isCompactScreen ? "100%" : "var(--container-sm)",
            display: isLarge
              ? "flex"
              : isCompactScreen
                ? "grid"
                : "flex",
            gridTemplateColumns: isMedium ? "repeat(2, 1fr)" : "repeat(1, 1fr)",
            flexDirection: "column",
            gap: "var(--space-md)",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            paddingBottom: "var(--space-xl)",
            alignContent: "flex-start",
          }}
        >
          {renderBookmarkCards()}
        </div>

        {/* Right panel — job details, large screens only */}
        {isLarge && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              borderLeft: "1px solid white",
            }}
          >
            {selectedJob ? (
              <JobDetailsCard
                jobData={selectedJob}
                onApply={handleApply}
                onClose={() => setSelectedJobId(null)}
                isApplying={isApplying}
                actionLabel="Apply"
                isApplyDisabled={false}
              />
            ) : (
              <div
                style={{
                  color: "var(--light-blue)",
                  paddingTop: "var(--space-2xl)",
                  fontSize: "var(--text-base)",
                  fontFamily: "var(--font-jura)",
                  lineHeight: "var(--line-normal)",
                  minWidth: "var(--container-md)",
                }}
              >
                {isLoading && "Loading job details..." }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}