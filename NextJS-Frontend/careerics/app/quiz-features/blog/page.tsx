"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RectangularCard } from "@/components/ui/rectangular-card";
import {
  fetchCareerBlogDetails,
  formatSalaryRange,
  type CareerBlogDetails,
  type LevelDetail,
} from "@/lib/career-blog";

type Level = "Entry" | "Junior" | "Senior";

const LEVELS: Level[] = ["Entry", "Junior", "Senior"];

const TRACK_DESCRIPTION_FALLBACK =
  "Explore this path and see what the day-to-day work, opportunities, and growth can look like.";

const BLOG_CONTENT_TOP_OFFSET = "calc(var(--icon-lg) + var(--space-md))";

const EMPTY_LEVEL_CONTENT: LevelDetail = {
  salary: "Not available yet",
  demand: "Unknown",
  demandColor: "#C1CBE6",
  responsibilities: [],
  fitReason: [],
  skills: [],
};

function createEmptyLevelState(): Record<Level, LevelDetail | null> {
  return {
    Entry: null,
    Junior: null,
    Senior: null,
  };
}

function renderLoadingState(label: string) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "70vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        fontFamily: "var(--font-nova-square)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1rem", marginBottom: "1rem", opacity: 0.85 }}>{label}</div>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "2px solid #4A5FC1",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "blog-spin 0.8s linear infinite",
            margin: "0 auto",
          }}
        />
        <style>{`@keyframes blog-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function BlogBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      style={{
        position: "fixed",
        top: "var(--space-lg)",
        left: "var(--space-lg)",
        zIndex: 30,
        width: "var(--icon-lg)",
        height: "var(--icon-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        backgroundColor: "transparent",
        padding: 0,
        cursor: "pointer",
        color: "white",
        fontSize: "1.5rem",
        lineHeight: 1,
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden="true">{"\u2190"}</span>
    </button>
  );
}

function BlogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const careerId = searchParams.get("trackId") || "";
  const jobTitle = searchParams.get("jobTitle") || "Job Title";
  const trackDescription = searchParams.get("description") || TRACK_DESCRIPTION_FALLBACK;

  const [activeLevel, setActiveLevel] = useState<Level>("Junior");
  const [careerDetailsByLevel, setCareerDetailsByLevel] = useState<Record<Level, LevelDetail | null>>(
    createEmptyLevelState,
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const activeLevelDetails = careerDetailsByLevel[activeLevel];
  const current = activeLevelDetails || EMPTY_LEVEL_CONTENT;

  useEffect(() => {
    setCareerDetailsByLevel(createEmptyLevelState());
    setDetailsError(null);
  }, [careerId]);

  useEffect(() => {
    if (!careerId) {
      setIsLoadingDetails(false);
      setDetailsError("No career track was selected.");
      return;
    }

    if (activeLevelDetails) {
      setIsLoadingDetails(false);
      return;
    }

    let alive = true;

    const loadCareerDetails = async () => {
      setIsLoadingDetails(true);
      setDetailsError(null);

      try {
        const response = await fetchCareerBlogDetails(careerId, activeLevel);
        if (!alive) {
          return;
        }

        if (!response.success || !response.data) {
          setDetailsError(response.message || "Unable to load career details right now.");
          return;
        }

        const incoming = response.data as Partial<CareerBlogDetails>;

        setCareerDetailsByLevel((previous) => {
          const next = { ...previous };

          for (const level of LEVELS) {
            if (incoming[level]) {
              next[level] = incoming[level];
            }
          }

          return next;
        });
      } catch (error) {
        if (!alive) {
          return;
        }

        console.error("Error loading career details:", error);
        setDetailsError("Unable to load career details right now.");
      } finally {
        if (alive) {
          setIsLoadingDetails(false);
        }
      }
    };

    void loadCareerDetails();

    return () => {
      alive = false;
    };
  }, [activeLevel, activeLevelDetails, careerId]);

  if (!careerId) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          color: "white",
          fontFamily: "var(--font-nova-square)",
        }}
      >
        <BlogBackButton onClick={() => router.back()} />

        <div
          style={{
            minHeight: "70vh",
            marginTop: BLOG_CONTENT_TOP_OFFSET,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <h1 style={{ marginBottom: "1rem" }}>No Career Selected</h1>
            <p style={{ color: "#C1CBE6", margin: 0 }}>
              Open this page from Career Exploration so we can load the correct blog details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingDetails && !activeLevelDetails) {
    return renderLoadingState(`Loading ${jobTitle} details...`);
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        color: "white",
        fontFamily: "var(--font-nova-square)",
      }}
    >
      <BlogBackButton onClick={() => router.back()} />

      <div
        style={{
          width: "100%",
          height: "100%",
          marginTop: BLOG_CONTENT_TOP_OFFSET,
          display: "grid",
          padding: "var(--space-xl)",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridTemplateRows: "auto 1fr",
          gridColumnGap: "var(--space-lg)",
          rowGap: "var(--space-md)",
          color: "white",
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            gridArea: "1 / 1 / 2 / 2",
            alignSelf: "stretch",
            gap: "var(--space-sm)",
          }}
        >
          <h1 style={{ fontSize: "var(--text-lg)", margin: 0 }}>{jobTitle}</h1>

          <p style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
            {trackDescription}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: "100%",
              gap: "var(--space-sm)",
            }}
          >
            {current.skills.length ? (
              current.skills.slice(0, 3).map((skill) => (
                <RectangularCard
                  key={skill}
                  theme="dark"
                  Title={skill.trim()}
                  style={{
                    flex: 1,
                    minWidth: "fit-content",
                    flexGrow: 1,
                  }}
                />
              ))
            ) : (
              <p style={{ color: "lightgrey", margin: 0, fontSize: "var(--text-base)" }}>
                Skills for this level are not available yet.
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "stretch",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            gridArea: "2 / 1 / 3 / 2",
            gap: "var(--space-sm)",
          }}
        >
          <h1 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Key Responsibilities</h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(1, 1fr)",
              width: "fit-content",
              gap: "var(--space-md)",
            }}
          >
            {current.responsibilities.length ? (
              current.responsibilities.map((item, index) => (
                <p
                  key={`${item}-${index}`}
                  style={{
                    fontSize: "var(--text-base)",
                    color: "lightgrey",
                    margin: 0,
                  }}
                >
                  {"•"} {item}
                </p>
              ))
            ) : (
              <p style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                No responsibilities are available for this level yet.
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            gap: "var(--space-lg)",
            gridArea: "1 / 2 / 2 / 3",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
            }}
          >
            {LEVELS.map((level) => (
              <RectangularCard
                key={level}
                font="jura"
                theme="light"
                Title={level === "Entry" ? "Entry Level" : level}
                selected={activeLevel === level}
                selectable
                onSelect={() => setActiveLevel(level)}
                style={{
                  flex: 1,
                  minWidth: "fit-content",
                  flexGrow: 1,
                  opacity: isLoadingDetails && activeLevel === level ? 0.75 : 1,
                }}
              />
            ))}
          </div>

          {isLoadingDetails ? (
            <p style={{ margin: 0, color: "#C1CBE6", fontSize: "var(--text-base)" }}>
              Loading level details...
            </p>
          ) : null}

          <div
            style={{
              width: "100%",
              height: "fit-content",
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "var(--space-xl)",
            }}
          >
            <div>
              <h1 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-xs)" }}>
                Salary Range
              </h1>
              <h1 style={{ fontSize: "var(--text-md)", color: "lightgrey", margin: 0 }}>
                {formatSalaryRange(current.salary)}
              </h1>
            </div>

            <div>
              <h1 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-xs)" }}>
                Market Demand
              </h1>
              <h1 style={{ fontSize: "var(--text-md)", color: current.demandColor, margin: 0 }}>
                {current.demand}
              </h1>
            </div>
          </div>

          {detailsError ? (
            <p style={{ margin: 0, color: "#FFD3D3" }}>
              {detailsError}
            </p>
          ) : null}
        </div>

        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--medium-blue)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-xl)",
            gridArea: "2 / 2 / 3 / 3",
          }}
        >
          <h1 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-md)" }}>
            This Would Fit You If
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(1, 1fr)",
              width: "fit-content",
              gap: "var(--space-md)",
            }}
          >
            {current.fitReason.length ? (
              current.fitReason.map((item, index) => (
                <p
                  key={`${item}-${index}`}
                  style={{
                    fontSize: "var(--text-base)",
                    color: "lightgrey",
                    margin: 0,
                  }}
                >
                  {"•"} {item}
                </p>
              ))
            ) : (
              <p style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                Fit guidance is not available for this level yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailsPage() {
  return (
    <Suspense fallback={<div style={{ color: "white" }}>Loading...</div>}>
      <BlogContent />
    </Suspense>
  );
}