"use client";
import { Button } from "@/components/ui/button";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JobCard from "@/components/ui/jobCard";
import JobDetailsCard from "@/components/ui/JobDetailsCard";
import { useRouter } from "next/navigation";
import {
  formatFilterTriggerLabel,
  mapApiJobToUiModel,
  mergeSelectedFilterOptions,
  persistSelectedJobId,
  readSelectedJobIdFromUrl,
  readPersistedSelectedJobId,
  replaceSelectedJobIdInUrl,
} from "@/lib/jobs";
import { useAuth } from "@/providers/auth-provider";
import { jobService } from "@/services";
import { useResponsive } from "@/hooks/useResponsive";

import type {
  APIJobFilters,
  JobApplicationStatus,
  JobFilterOption,
  JobSortOption,
  JobUiModel,
} from "@/types";
import { SearchBar } from "@/components/ui/searchbar";

type JobBrowserMode = "all" | "applications";

interface JobBrowserPageProps {
  mode: JobBrowserMode;
  syncSelectionToUrl?: boolean;
}

interface MultiSelectDropdownProps {
  placeholder: string;
  options: JobFilterOption[];
  selectedValues: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  emptyLabel?: string;
}

const PAGE_SIZE = 20;
const EMPTY_FILTER_OPTIONS: APIJobFilters = {
  countries: [],
  cities: [],
  job_types: [],
  work_types: [],
  career_levels: [],
};

const EMPTY_SELECTED_VALUES: string[] = [];
const DROPDOWN_MIN_WIDTH = 240;
const DROPDOWN_MAX_WIDTH = 320;
const DROPDOWN_GAP = 6;
const DROPDOWN_VIEWPORT_MARGIN = 12;

const dropdownSurfaceStyle: React.CSSProperties = {
  position: "fixed",
  backgroundColor: "#111827",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "14px",
  zIndex: 200,
  overflow: "hidden",
  boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
};

function buildEmptyFilterState(): APIJobFilters {
  return {
    countries: [],
    cities: [],
    job_types: [],
    work_types: [],
    career_levels: [],
  };
}

const MultiSelectDropdown = ({
  placeholder,
  options,
  selectedValues,
  onToggle,
  onClear,
  emptyLabel = "No options available",
}: MultiSelectDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const triggerLabel = useMemo(
    () => formatFilterTriggerLabel(placeholder, selectedValues, options),
    [options, placeholder, selectedValues],
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateDropdownPosition = () => {
      const triggerRect = ref.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const availableWidth = Math.max(
        DROPDOWN_MIN_WIDTH,
        window.innerWidth - (DROPDOWN_VIEWPORT_MARGIN * 2),
      );
      const desiredWidth = Math.max(DROPDOWN_MIN_WIDTH, triggerRect.width);
      const width = Math.min(desiredWidth, DROPDOWN_MAX_WIDTH, availableWidth);
      const left = Math.min(
        Math.max(DROPDOWN_VIEWPORT_MARGIN, triggerRect.left),
        window.innerWidth - width - DROPDOWN_VIEWPORT_MARGIN,
      );
      const top = triggerRect.bottom + DROPDOWN_GAP;
      const maxHeight = Math.max(
        160,
        Math.min(280, window.innerHeight - top - DROPDOWN_VIEWPORT_MARGIN),
      );

      setDropdownPosition({
        left,
        top,
        width,
        maxHeight,
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: "fit-content", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "34px",
          padding: "0 14px",
          borderRadius: "999px",
          border: "1.5px solid rgba(255,255,255,0.5)",
          backgroundColor: "#C1CBE6",
          color: "#000000",
          fontSize: "0.78rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
          outline: "none",
          width: "fit-content",
        }}
      >
        <span>{triggerLabel}</span>
        {selectedValues.length > 1 && (
          <span
            style={{
              minWidth: "20px",
              height: "20px",
              paddingInline: "6px",
              borderRadius: "999px",
              backgroundColor: "rgba(17,24,39,0.12)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.7rem",
            }}
          >
            {selectedValues.length}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          <path
            d="M1 3L5 7L9 3"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && dropdownPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...dropdownSurfaceStyle,
            left: dropdownPosition.left,
            top: dropdownPosition.top,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span style={{ color: "white", fontSize: "0.78rem", opacity: 0.8 }}>
              {placeholder}
            </span>
            <button
              type="button"
              onClick={onClear}
              disabled={!selectedValues.length}
              style={{
                background: "none",
                border: "none",
                color: selectedValues.length ? "#C5FF41" : "rgba(255,255,255,0.35)",
                cursor: selectedValues.length ? "pointer" : "default",
                fontSize: "0.75rem",
                padding: 0,
              }}
            >
              Clear
            </button>
          </div>

          <div
            style={{
              maxHeight: Math.max(120, dropdownPosition.maxHeight - 60),
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.15) transparent",
            }}
          >
            {options.length ? (
              options.map((option) => {
                const isActive = selectedValues.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onToggle(option.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      width: "100%",
                      padding: "10px 14px",
                      backgroundColor: isActive ? "rgba(197,255,65,0.1)" : "transparent",
                      color: "rgba(255,255,255,0.92)",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: isActive ? "2px solid #C5FF41" : "2px solid rgba(255,255,255,0.7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isActive && (
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: "#C5FF41",
                            }}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {option.title}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", opacity: 0.58, flexShrink: 0 }}>
                      {option.count ?? 0}
                    </span>
                  </button>
                );
              })
            ) : (
              <div style={{ color: "rgba(255,255,255,0.68)", padding: "14px", fontSize: "0.8rem" }}>
                {emptyLabel}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

interface SortLinkProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SortLink = ({ label, isActive, onClick }: SortLinkProps) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "none",
        border: "none",
        padding: "2px 0",
        cursor: "pointer",
        color: isActive ? "#C5FF41" : hover ? "#C5FF41" : "white",
        fontSize: "0.85rem",
        fontWeight: isActive ? 600 : 400,
        transition: "color 0.2s",
        outline: "none",
        position: "relative",
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          bottom: "-2px",
          left: 0,
          width: isActive ? "100%" : "0%",
          height: "1.5px",
          backgroundColor: "#C5FF41",
          transition: "width 0.25s ease",
          borderRadius: "2px",
          display: "block",
        }}
      />
    </button>
  );
};

function toggleSelection(currentValues: string[], nextValue: string): string[] {
  return currentValues.includes(nextValue)
    ? currentValues.filter((value) => value !== nextValue)
    : [...currentValues, nextValue];
}

export default function JobBrowserPage({

  mode,
  syncSelectionToUrl = false,
}: JobBrowserPageProps) {
  const { isLarge, isMedium, isSmall } = useResponsive();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [jobs, setJobs] = useState<JobUiModel[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobFallback, setSelectedJobFallback] = useState<JobUiModel | null>(null);
  const urlJobIdRef = useRef<string | null>(syncSelectionToUrl ? readSelectedJobIdFromUrl() : null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [activeSort, setActiveSort] = useState<JobSortOption>("relevance");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<APIJobFilters>(buildEmptyFilterState);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [bookmarkingJobId, setBookmarkingJobId] = useState<string | null>(null);
  const fallbackRequestJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isActive = true;

    const loadJobs = async () => {
      setIsLoading(true);
      setError(null);

      if (mode === "applications" && !user?.id) {
        if (!isActive) {
          return;
        }

        setJobs([]);
        setFilterOptions(buildEmptyFilterState());
        setTotalJobs(0);
        setTotalPages(0);
        setIsLoading(false);
        setError("Please sign in to view your applications.");
        return;
      }

      const requestParams = {
        skip: (currentPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        query: deferredSearchQuery || undefined,
        countries: selectedCountries,
        cities: selectedCities,
        jobTypes: selectedJobTypes,
        workTypes: selectedWorkTypes,
        careerLevels: selectedLevels,
        sort: activeSort,
      };

      const response = mode === "applications" && user?.id
        ? await jobService.getUserApplications(user.id, requestParams)
        : await jobService.listJobs({
          ...requestParams,
          userId: user?.id,
        });

      if (!isActive) {
        return;
      }

      if (response.success && response.data) {
        setJobs(response.data.jobs.map(mapApiJobToUiModel));
        setFilterOptions(response.data.filters ?? EMPTY_FILTER_OPTIONS);
        setTotalJobs(response.data.total ?? 0);
        setTotalPages(response.data.total_pages ?? 0);
      } else {
        setJobs([]);
        setFilterOptions(buildEmptyFilterState());
        setTotalJobs(0);
        setTotalPages(0);
        setError(response.message ?? "We could not load jobs right now.");
      }

      setIsLoading(false);
    };

    void loadJobs();

    return () => {
      isActive = false;
    };
  }, [
    activeSort,
    currentPage,
    deferredSearchQuery,
    isAuthLoading,
    mode,
    selectedCities,
    selectedCountries,
    selectedJobTypes,
    selectedLevels,
    selectedWorkTypes,
    user?.id,
  ]);

  useEffect(() => {
    if (!syncSelectionToUrl) {
      urlJobIdRef.current = null;
      replaceSelectedJobIdInUrl(null);
    }
  }, [syncSelectionToUrl]);

  useEffect(() => {
    const currentPageJobIds = new Set(jobs.map((job) => job.id));
    const storedJobId = readPersistedSelectedJobId();
    const nextSelectedJobId = urlJobIdRef.current
      ?? (storedJobId && currentPageJobIds.has(storedJobId) ? storedJobId : null)
      ?? jobs[0]?.id
      ?? null;

    if (nextSelectedJobId !== selectedJobId) {
      const timeoutId = window.setTimeout(() => setSelectedJobId(nextSelectedJobId), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [jobs, selectedJobId, syncSelectionToUrl]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    persistSelectedJobId(selectedJobId);
    if (syncSelectionToUrl) {
      replaceSelectedJobIdInUrl(selectedJobId);
      urlJobIdRef.current = selectedJobId;
    }
  }, [selectedJobId, syncSelectionToUrl]);

  useEffect(() => {
    const fallbackRequestKey = `${user?.id ?? "guest"}:${selectedJobId ?? "none"}`;

    if (!selectedJobId || jobs.some((job) => job.id === selectedJobId)) {
      fallbackRequestJobIdRef.current = null;
      if (!selectedJobFallback) {
        return;
      }

      const timeoutId = window.setTimeout(() => setSelectedJobFallback(null), 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (fallbackRequestJobIdRef.current === fallbackRequestKey) {
      return;
    }
    fallbackRequestJobIdRef.current = fallbackRequestKey;

    let isActive = true;

    const loadSelectedJob = async () => {
      const response = await jobService.getJobDetails(selectedJobId, user?.id);
      if (!isActive) {
        return;
      }

      if (response.success && response.data) {
        setSelectedJobFallback(mapApiJobToUiModel(response.data));
      } else {
        setSelectedJobFallback(null);
      }
    };

    void loadSelectedJob();

    return () => {
      isActive = false;
    };
  }, [jobs, selectedJobFallback, selectedJobId, user?.id]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId)
      ?? (selectedJobFallback?.id === selectedJobId ? selectedJobFallback : null),
    [jobs, selectedJobFallback, selectedJobId],
  );

  const updateSingleJob = (jobId: string, updater: (job: JobUiModel) => JobUiModel) => {
    setJobs((currentJobs) => currentJobs.map((job) => (
      job.id === jobId ? updater(job) : job
    )));
    setSelectedJobFallback((currentJob) => (
      currentJob?.id === jobId ? updater(currentJob) : currentJob
    ));
  };

  const handleBookmarkToggle = async (job: JobUiModel) => {
    if (!user?.id) {
      setError("Please sign in to save jobs.");
      return;
    }

    setBookmarkingJobId(job.id);
    const response = job.isSaved
      ? await jobService.unsaveJob(job.id, user.id)
      : await jobService.saveJob(job.id, user.id);

    if (response.success) {
      jobService.invalidateJobList(user.id);
      updateSingleJob(job.id, (currentJob) => ({
        ...currentJob,
        isSaved: !currentJob.isSaved,
        savedAt: currentJob.isSaved ? null : new Date().toISOString(),
      }));
    } else {
      setError(response.message ?? "We could not update your saved jobs.");
    }

    setBookmarkingJobId(null);
  };

  const handleApply = async () => {
    if (!selectedJob || !user?.id) {
      setError("Please sign in to apply to jobs.");
      return;
    }

    const nextStatus = (selectedJob.applicationStatus ?? "applied") as JobApplicationStatus;

    try {
      if (selectedJob.jobUrl && typeof window !== "undefined") {
        window.open(selectedJob.jobUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Keep the apply flow alive even if opening the external tab is blocked.
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

  const hasActiveFilters = Boolean(
    searchQuery.trim()
    || selectedCountries.length
    || selectedCities.length
    || selectedJobTypes.length
    || selectedWorkTypes.length
    || selectedLevels.length,
  );

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCountries(EMPTY_SELECTED_VALUES);
    setSelectedCities(EMPTY_SELECTED_VALUES);
    setSelectedJobTypes(EMPTY_SELECTED_VALUES);
    setSelectedWorkTypes(EMPTY_SELECTED_VALUES);
    setSelectedLevels(EMPTY_SELECTED_VALUES);
    setActiveSort("relevance");
    setCurrentPage(1);
  };

  const countryOptions = useMemo(
    () => mergeSelectedFilterOptions(filterOptions.countries, selectedCountries),
    [filterOptions.countries, selectedCountries],
  );
  const cityOptions = useMemo(
    () => mergeSelectedFilterOptions(filterOptions.cities, selectedCities),
    [filterOptions.cities, selectedCities],
  );
  const jobTypeOptions = useMemo(
    () => mergeSelectedFilterOptions(filterOptions.job_types, selectedJobTypes),
    [filterOptions.job_types, selectedJobTypes],
  );
  const workTypeOptions = useMemo(
    () => mergeSelectedFilterOptions(filterOptions.work_types, selectedWorkTypes),
    [filterOptions.work_types, selectedWorkTypes],
  );
  const levelOptions = useMemo(
    () => mergeSelectedFilterOptions(filterOptions.career_levels, selectedLevels),
    [filterOptions.career_levels, selectedLevels],
  );

  const pageStart = totalJobs ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
  const pageEnd = totalJobs ? Math.min(totalJobs, currentPage * PAGE_SIZE) : 0;

  const renderLeftPanelContent = () => {
    
    if (!isLoading && !jobs.length) {
      return <p style={{ color: "white", opacity: 0.8, margin: 0 }}>No jobs match your filters yet.</p>;
    }

    return jobs.map((job) => (
      <div
        key={job.id}
        style={{ width: "100%", cursor: "pointer" }}
      >
        <JobCard
          {...job}
          disableNavigation
          onSelect={() => setSelectedJobId(job.id)}
          isBookmarked={job.isSaved}
          isBookmarkLoading={bookmarkingJobId === job.id}
          onBookmarkToggle={() => handleBookmarkToggle(job)}
          isSelected={job.id===selectedJobId}
        />
      </div>
    ));
  };
  const router = useRouter();
  //job card
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          width: "var(--icon-lg)",
          height: "var(--icon-lg)",
          cursor: "pointer",
          alignSelf: "flex-end",
          boxSizing: "content-box",
          padding: "var(--space-md)",
          paddingBottom: "0",
        }}
      >
        <img
          src="/global/close.svg"
          alt="Close"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </button>
      <div
        style={{
          display: "flex",
          flexDirection: isSmall ? "column" : "row",
          width: "100%",
          maxHeight: "100%",
          height: "100%",
          padding: "var(--space-xl)",
          paddingTop: "0",
          boxSizing: "border-box",
          justifyContent: isLarge ? "space-between" : "center",
          overflow: "hidden",
          scrollbarWidth: "none",
          position: "relative",
          gap: "calc(var(--space-xl) *2 )",
        }}
      >
        <div
          style={{
            width: "fit-content",
            maxWidth: "var(--container-sm)",
            minHeight: "0",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
            overflowX: "hidden",
            overflowY: "auto",
            scrollbarWidth: "none",
            zIndex: 1,
          }}
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search jobs..."

            style={{
              width: "100%",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              zIndex: 10,
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            <MultiSelectDropdown
              placeholder="Country"
              options={countryOptions}
              selectedValues={selectedCountries}
              onToggle={(value) => {
                setCurrentPage(1);
                setSelectedCountries((current) => toggleSelection(current, value));
              }}
              onClear={() => {
                setCurrentPage(1);
                setSelectedCountries([]);
              }}
              emptyLabel="No country options available"
            />

            <MultiSelectDropdown
              placeholder="City"
              options={cityOptions}
              selectedValues={selectedCities}
              onToggle={(value) => {
                setCurrentPage(1);
                setSelectedCities((current) => toggleSelection(current, value));
              }}
              onClear={() => {
                setCurrentPage(1);
                setSelectedCities([]);
              }}
              emptyLabel="No city options available"
            />

            <MultiSelectDropdown
              placeholder="Job Type"
              options={jobTypeOptions}
              selectedValues={selectedJobTypes}
              onToggle={(value) => {
                setCurrentPage(1);
                setSelectedJobTypes((current) => toggleSelection(current, value));
              }}
              onClear={() => {
                setCurrentPage(1);
                setSelectedJobTypes([]);
              }}
              emptyLabel="No job type options available"
            />

            <MultiSelectDropdown
              placeholder="Work Mode"
              options={workTypeOptions}
              selectedValues={selectedWorkTypes}
              onToggle={(value) => {
                setCurrentPage(1);
                setSelectedWorkTypes((current) => toggleSelection(current, value));
              }}
              onClear={() => {
                setCurrentPage(1);
                setSelectedWorkTypes([]);
              }}
              emptyLabel="No work mode options available"
            />

            <MultiSelectDropdown
              placeholder="Experience Level"
              options={levelOptions}
              selectedValues={selectedLevels}
              onToggle={(value) => {
                setCurrentPage(1);
                setSelectedLevels((current) => toggleSelection(current, value));
              }}
              onClear={() => {
                setCurrentPage(1);
                setSelectedLevels([]);
              }}
              emptyLabel="No experience levels available"
            />

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              style={{
                height: "fit-content",
                paddingInline: "var(--space-sm)",
                paddingBlock: "var(--space-xxs)",
                backgroundColor: "transparent",
                color: hasActiveFilters ? "var(--light-blue)" : "var(--text-grey)",
                cursor: hasActiveFilters ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                fontSize: "var(--text-base)",
                fontFamily: "var(--font-jura)",
                marginLeft:"auto",
              }}
            >
              Reset Filters
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: isSmall ? "var(--space-sm)" : "var(--space-md)",
              fontSize: "var(--text-sm)",
              color: "var(--light-blue)",
              alignItems: "center",
              flexWrap: "wrap",
              lineHeight: "var(--line-normal)",
            }}
          >
            <span style={{ opacity: 0.7, flexShrink: 0 }}>Sort By:</span>

            <SortLink
              label="Relevance"
              isActive={activeSort === "relevance"}
              onClick={() => {
                setCurrentPage(1);
                setActiveSort("relevance");
              }}
            />

            <span style={{ opacity: 0.4 }}>-</span>

            <SortLink
              label="Date Posted"
              isActive={activeSort === "date"}
              onClick={() => {
                setCurrentPage(1);
                setActiveSort("date");
              }}
            />

            <span style={{ opacity: 0.4 }}>-</span>

            <SortLink
              label="Resume Match"
              isActive={activeSort === "match"}
              onClick={() => {
                setCurrentPage(1);
                setActiveSort("match");
              }}
            />
          </div>



          {error && (
            <p
              style={{
                color: "var(--light-red)",
                margin: 0,
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-jura)",
                lineHeight: "var(--line-normal)",
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-lg)",
            }}
          >
            {renderLeftPanelContent()}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: isSmall ? "flex-start" : "center",
              justifyContent: "space-between",
              flexDirection: isSmall ? "column" : "row",
              color: "var(--light-blue)",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ opacity: 0.8, fontSize: "var(--text-sm)" }}>
              {totalJobs
                ? `Showing ${pageStart}-${pageEnd} of ${totalJobs} jobs`
                : isLoading
                  ? "Loading jobs..."
                  : "No jobs found"}
            </span>

            <span style={{ opacity: 0.6, fontSize: "var(--text-xs)" }}>
              Page {Math.min(currentPage, Math.max(totalPages, 1))} of{" "}
              {Math.max(totalPages, 1)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-md)",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "var(--space-xl)",
              flexDirection: isSmall ? "column" : "row",
            }}
          >
            <Button
              variant="outline"
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              disabled={currentPage <= 1 || isLoading}
              style={{
                width: isSmall ? "100%" : undefined,
                cursor: currentPage > 1 && !isLoading ? "pointer" : "default",
              }}
            >
              Previous
            </Button>

            <Button
              variant="primary"
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(page + 1, Math.max(totalPages, 1)),
                )
              }
              disabled={currentPage >= totalPages || isLoading || !totalPages}
              style={{
                width: isSmall ? "100%" : undefined,
                cursor:
                  currentPage < totalPages && !isLoading ? "pointer" : "default",
              }}
            >
              Next
            </Button>
          </div>
        </div>

        {!isSmall && (
          <div
            style={{
              width: "1.5px",
              backgroundColor: "var(--medium-grey)",
              height: "95%",
              flexShrink: 0,
              position: "relative",
              alignSelf: "center",
            }}
          />
        )}

        {/* job details */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            width: "fit-content",
            minWidth: "fit-content",
            minHeight: "0",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
          }}
        >
          {selectedJob ? (
            <JobDetailsCard
              jobData={selectedJob}
              onApply={handleApply}
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
                minWidth:"var(--container-md)"
              }}
            >
              {isLoading ? "Loading job details..." : "No job selected yet."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
