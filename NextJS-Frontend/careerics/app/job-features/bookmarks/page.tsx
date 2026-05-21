"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import JobCard from "@/components/ui/jobCard";
import JobDetailsCard from "@/components/ui/JobDetailsCard";
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

  const renderBookmarkCards = () => {
    if (isLoading) {
      return <p style={{ color: "white", margin: 0, }}>Loading jobs...</p>;
    }

    if (!filteredJobs.length) {
      return <p style={{ color: "white", margin: 0, }}>No bookmarked jobs found.</p>;
    }

    return filteredJobs.map((job) => (
      <div key={job.id} onClick={() => setSelectedJobId(job.id)} style={{ cursor: "pointer" }}>
        <JobCard
          {...job}
          isBookmarked={job.isSaved}
          isBookmarkLoading={bookmarkingJobId === job.id}
          onBookmarkToggle={() => handleBookmarkToggle(job)}
        />
      </div>
    ));
  };

  const renderDefaultGrid = () => (
    <div style={{
      display: "grid",
      gridTemplateColumns: isLarge ? "repeat(3, 1fr)" : isMedium ? "repeat(2, 1fr)" : "repeat(1, 1fr)",
      gap: "10px",
      paddingRight: "20px",
      width: "100%",
      boxSizing: "border-box",
      paddingBottom: "10vh",
      overflowY: "auto",
      scrollbarWidth: "none",
    }}>
      {renderBookmarkCards()}
    </div>
  );

  const renderSelectedLayout = () => (
    <div style={{ display: isLarge ? "flex" : "grid", gridTemplateColumns:"1fr", gridTemplateRows:"1fr", gap: "var(--space-lg)", height: "100%", overflow: "hidden", justifyContent:"space-around", position: "relative" }}>
      
      {/* Cards List Panel */}
      <div style={{
        width: "fit-content",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        gap: "var(--space-md)",
        overflowY: "auto",
        scrollbarWidth: "none",
        gridArea: "1 / 1 / 2 / 2",
        zIndex: 0,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", }}>
          <h2 style={{ color: "var(--light-blue)", fontFamily: "Nova Square, sans-serif", fontSize: "var(--text-xl)" }}>
            Bookmarked Jobs
          </h2>

          {renderBookmarkCards()}
        </div>
      </div>

      {/* Vertical Divider Separator */}
      {isLarge && (
        <div style={{
          width: "1.5px",
          backgroundColor: "var(--medium-grey)",
          height: "90%",
          alignSelf: "center",
          flexShrink: 0,
          position: "relative",
        }} />
      )}


      {/* Floating/Side Details Card Container */}
      <div style={{
        height: "100%",
        width: "fit-content",
        justifyContent: "center",
        alignItems: "flex-start",
        position: "relative",
        zIndex: isLarge ? 1 : 10,
        display: "flex",
        gridArea: "1 / 1 / 2 / 2",
        marginLeft: isLarge ? "0" : "auto",
        scrollbarWidth: "none",
      }}>
        <div style={{ position: "relative", width: "fit-content", display: "flex", justifyContent: "center", alignItems: "flex-start", height: "100%",maxWidth:"70vw" }}>
          {selectedJob && (
            <JobDetailsCard
              jobData={selectedJob}
              onApply={handleApply}
              isApplying={isApplying}
              actionLabel="Apply"
              isApplyDisabled={false}
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: "var(--space-lg)",
      height: "100dvh",
      width: "100%",
      overflowY: "auto",
      overflowX: "hidden",
      boxSizing: "border-box",
      scrollbarWidth: "none",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-lg)",
    }}>

      {/* Dimming Backdrop Overlay (Triggers when card is active on smaller screens over the whole viewport) */}
      {selectedJob && !isLarge && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "var(--bg-color)",
          opacity: 0.65,
          zIndex: 5,
          pointerEvents: "auto",
        }} />
      )}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
        zIndex: 1,
      }}>

        {!selectedJob && (
          <h2 style={{ color: "var(--light-blue)", fontFamily: "Nova Square, sans-serif", fontSize: "var(--text-xl)" }}>
            Bookmarked Jobs
          </h2>
        )}

        {!selectedJob && (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search By Job Title"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--light-blue)",
                borderRadius: "var(--radius-xl)",
                color: "var(--light-blue)",
                width: "var(--container-xxs)",
                maxWidth: "200px",
                height: "var(--min-touch-target)",
                outline: "none",
                padding: " var(--space-lg)",
                fontFamily: "Nova Square, sans-serif",
                fontSize: "var(--text-base)",
              }}
            />
            <img
              src="/global/search.svg"
              alt="search"
              style={{
                position: "absolute",
                right: "0",
                top: "50%",
                transform: "translateY(-50%)",
                width: "var(--icon-lg)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--light-red)", marginTop: 0, fontSize: "var(--text-sm)" }}>
          {error}
        </p>
      )}

      {selectedJob ? renderSelectedLayout() : renderDefaultGrid()}
    </div>
  );
}