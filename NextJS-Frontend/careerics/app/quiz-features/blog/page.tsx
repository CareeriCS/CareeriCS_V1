"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { fetchCareerBlogDetails, type CareerBlogDetails, type LevelDetail } from "@/lib/career-blog";

type Level = "Entry" | "Junior" | "Senior";

const LEVELS: Level[] = ["Entry", "Junior", "Senior"];

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
        top: "var(--space-xl)",
        left: "var(--space-xl)",
        zIndex: 20,
        width: "var(--icon-lg)",
        height: "var(--icon-lg)",
        borderRadius: "999px",
        border: "none",
        backgroundColor: "transparent",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <img
        src="/global/next.svg"
        alt=""
        aria-hidden="true"
        style={{
          width: "100%",
          height: "100%",
          transform: "rotate(180deg)",
          backgroundColor: "white",
          padding: "var(--space-xxs)",
          boxSizing: "border-box",
          borderRadius: "999px",
        }}
      />
    </button>
  );
}

function BlogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const careerId = searchParams.get("trackId") || "";
  const jobTitle = searchParams.get("jobTitle") || "Job Title";

  const [activeLevel, setActiveLevel] = useState<Level>("Junior");
  const [careerDetailsByLevel, setCareerDetailsByLevel] = useState<Record<Level, LevelDetail | null>>(
    createEmptyLevelState,
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const activeLevelDetails = careerDetailsByLevel[activeLevel];

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

  const current = activeLevelDetails || EMPTY_LEVEL_CONTENT;

  if (!careerId) {
    return (
      <div style={{ width: "100%", color: "#fff", fontFamily: "var(--font-nova-square)", padding: "8vh 3vw 10vh" }}>
        <BlogBackButton onClick={() => router.back()} />
        <div
          style={{
            minHeight: "70vh",
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
    <div style={{ width: "100%", color: "#fff", fontFamily: "var(--font-nova-square)", padding: "8vh 3vw 10vh" }}>
      <BlogBackButton onClick={() => router.back()} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div>
          <h1 style={{ fontSize: "4.8vh", margin: 0 }}>{jobTitle}</h1>
          <p style={{ color: "#9CA3AF", fontSize: "2.2vh", marginTop: "1vh" }}>Career Path Details</p>
          <div style={{ display: "flex", gap: "1vw", marginTop: "3vh", flexWrap: "wrap" }}>
            {current.skills.map((skill, index) => (
              <div
                key={`${skill}-${index}`}
                style={{
                  backgroundColor: "#1E3A8A",
                  color: "#fafbfd",
                  padding: "1.2vh 2.5vw",
                  borderRadius: "1.2vh",
                  fontSize: "1.8vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  minWidth: "fit-content",
                }}
              >
                {skill.trim()}
              </div>
            ))}

            {!current.skills.length ? (
              <p style={{ color: "#9CA3AF", margin: 0, fontSize: "1.8vh" }}>
                Skills for this level are not available yet.
              </p>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5vh", marginRight: "2vw", paddingLeft: "20vw" }}>
          <div style={{ display: "flex", gap: "3vw", padding: "1vh", borderRadius: "4vh" }}>
            {LEVELS.map((level) => (
              <Button
              variant="secondary"
                key={level}
                onClick={() => setActiveLevel(level)}
                disabled={isLoadingDetails && activeLevel === level}
                style={{
                  color: "#142143",
                  borderRadius: "3vh",
                  padding: "2vh 2vw",
                  fontSize: "2vh",
                  fontWeight: "bold",
                  height: "6vh",
                  width: "10vw",
                  border: "none",
                  opacity: isLoadingDetails && activeLevel === level ? 0.75 : 1,
                }}
              >
                {level === "Entry" ? "Entry Level" : level}
              </Button>
            ))}
          </div>

          {isLoadingDetails ? (
            <p style={{ margin: 0, color: "#C1CBE6", fontSize: "1.8vh" }}>
              Loading level details...
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "5vw", marginRight: "9vw" }}>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: "2.9vh", margin: 0 }}>Salary Range</p>
              <p style={{ fontSize: "2.9vh", fontWeight: "bold", margin: 0 }}>{current.salary}</p>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: "2.2vh", margin: 0 }}>Market Demand</p>
              <p style={{ fontSize: "3.8vh", fontWeight: "bold", color: current.demandColor, margin: 0 }}>{current.demand}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "5vw", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "3.5vh", marginBottom: "4vh" }}>Key Responsibilities</h2>
          {current.responsibilities.length ? (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {current.responsibilities.map((item, index) => (
                <li key={`${item}-${index}`} style={{ color: "#D1D5DB", fontSize: "2.4vh", marginBottom: "2vh", display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ color: "#ffffff", fontSize: "2vh" }}>•</span> {item}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#9CA3AF", fontSize: "2.2vh", margin: 0 }}>
              No responsibilities are available for this level yet.
            </p>
          )}
        </div>

        <div
          style={{
            flex: 0.6,
            backgroundColor: "#1C427B",
            borderRadius: "4vh",
            padding: "6vh 2vw",
            minHeight: "45vh",
          }}
        >
          <h2 style={{ fontSize: "3.5vh", marginBottom: "4vh" }}>This Would fit you if</h2>
          {current.fitReason.length ? (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {current.fitReason.map((item, index) => (
                <li key={`${item}-${index}`} style={{ color: "#D1D5DB", fontSize: "2.4vh", marginBottom: "2vh", display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ color: "#ffffff", fontSize: "2vh" }}>•</span> {item}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#D1D5DB", fontSize: "2.2vh", margin: 0 }}>
              Fit guidance is not available for this level yet.
            </p>
          )}
        </div>
      </div>

      {detailsError ? (
        <p style={{ color: "#FFD3D3", marginTop: "3vh", fontSize: "1.8vh" }}>
          {detailsError}
        </p>
      ) : null}
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
