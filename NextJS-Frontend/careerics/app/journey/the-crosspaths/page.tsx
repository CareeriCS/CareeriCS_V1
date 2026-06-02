"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import JourneyTree from "@/components/ui/journey-tree";
import { RectangularCard } from "@/components/ui/rectangular-card";
import { fetchCareerBlogDetails, type CareerBlogDetails, type LevelDetail } from "@/lib/career-blog";
import { buildJourneyPhaseHref } from "@/lib/journey";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { careerService } from "@/services";

type Level = "Entry" | "Junior" | "Senior";

const LEVELS: Level[] = ["Entry", "Junior", "Senior"];
const FALLBACK_SKILLS = ["Learning Path", "Core Skills", "Career Growth"];
const MAX_SKILLS = 3;
const MAX_RESPONSIBILITIES = 6;
const MAX_FIT_REASONS = 5;

const DEFAULT_LEVEL_DATA: LevelDetail = {
  salary: "Not available yet",
  demand: "Unknown",
  demandColor: "#C1CBE6",
  responsibilities: [],
  fitReason: [],
  skills: [],
};

function splitSentences(value: string): string[] {
  return value
    .split(/[.\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/roadmap$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeItems(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLevelData(value: LevelDetail | null | undefined): LevelDetail {
  return {
    salary: value?.salary?.trim() || DEFAULT_LEVEL_DATA.salary,
    demand: value?.demand?.trim() || DEFAULT_LEVEL_DATA.demand,
    demandColor: value?.demandColor?.trim() || DEFAULT_LEVEL_DATA.demandColor,
    responsibilities: normalizeItems(value?.responsibilities),
    fitReason: normalizeItems(value?.fitReason),
    skills: normalizeItems(value?.skills),
  };
}

function buildFallbackResponsibilities(trackTitle: string): string[] {
  return [
    `Build practical ${trackTitle.toLowerCase()} foundations.`,
    `Ship hands-on projects that demonstrate your progress.`,
    "Collaborate clearly and improve your work through feedback.",
    "Keep up with the tools, workflows, and trends used in the field.",
  ];
}

function buildFallbackFitReasons(trackTitle: string, description?: string | null): string[] {
  const fromDescription = splitSentences(description || "").slice(0, 5);
  if (fromDescription.length) {
    return fromDescription;
  }

  return [
    `You enjoy solving real ${trackTitle.toLowerCase()} problems.`,
    "You like structured learning paths and visible progress.",
    "You want to learn through practical work, not theory alone.",
    "You are comfortable improving through feedback and iteration.",
  ];
}

function renderLoadingState() {
  return (
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
            fontSize: "var(--text-md)",
            marginBottom: "var(--space-md)",
            opacity: 0.8,
          }}
        >
          Loading your career path...
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
  );
}

export default function JourneyCrosspathsPage() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<Level>("Entry");
  const [careerDetails, setCareerDetails] = useState<CareerBlogDetails | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [resolvedCareerTrackId, setResolvedCareerTrackId] = useState<string | null>(null);

  const { selectedTrack, maxReached, isLoadingTracks, trackError } = useJourneyPhase(1);

  useEffect(() => {
    let alive = true;

    const resolveCareerTrackId = async () => {
      if (!selectedTrack) {
        setResolvedCareerTrackId(null);
        return;
      }

      const response = await careerService.listTracks();
      if (!alive) {
        return;
      }

      if (!response.success || !response.data?.length) {
        setResolvedCareerTrackId(selectedTrack.id);
        return;
      }

      const exactIdMatch = response.data.find((track) => track.id === selectedTrack.id);
      if (exactIdMatch) {
        setResolvedCareerTrackId(exactIdMatch.id);
        return;
      }

      const normalizedSelectedTitle = normalizeLabel(selectedTrack.title || "");
      const matchedByTitle = response.data.find((track) => {
        return normalizeLabel(track.name || "") === normalizedSelectedTitle;
      });

      if (matchedByTitle) {
        setResolvedCareerTrackId(matchedByTitle.id);
        return;
      }

      const partialTitleMatch = response.data.find((track) => {
        const normalizedTrackName = normalizeLabel(track.name || "");
        return (
          normalizedSelectedTitle.includes(normalizedTrackName) ||
          normalizedTrackName.includes(normalizedSelectedTitle)
        );
      });

      setResolvedCareerTrackId(partialTitleMatch?.id || selectedTrack.id);
    };

    void resolveCareerTrackId();

    return () => {
      alive = false;
    };
  }, [selectedTrack]);

  useEffect(() => {
    let alive = true;

    const loadTrackDetails = async () => {
      if (!selectedTrack?.id || !resolvedCareerTrackId) {
        setCareerDetails(null);
        setDataError(null);
        setIsLoadingData(Boolean(selectedTrack?.id && !resolvedCareerTrackId));
        return;
      }

      setIsLoadingData(true);
      setDataError(null);

      const response = await fetchCareerBlogDetails(resolvedCareerTrackId, selectedLevel);
      if (!alive) {
        return;
      }

      if (!response.success || !response.data) {
        setCareerDetails(null);
        setDataError(response.message || "Unable to load career details for this track.");
        setIsLoadingData(false);
        return;
      }

      setCareerDetails(response.data);
      setDataError(null);
      setIsLoadingData(false);
    };

    void loadTrackDetails();

    return () => {
      alive = false;
    };
  }, [resolvedCareerTrackId, selectedLevel, selectedTrack?.id]);

  const currentLevelData = useMemo(() => {
    return normalizeLevelData(careerDetails?.[selectedLevel]);
  }, [careerDetails, selectedLevel]);

  const displaySkills = useMemo(() => {
    const skills = currentLevelData.skills.length ? currentLevelData.skills : FALLBACK_SKILLS;
    return skills.slice(0, MAX_SKILLS);
  }, [currentLevelData.skills]);

  const displayResponsibilities = useMemo(() => {
    if (currentLevelData.responsibilities.length) {
      return currentLevelData.responsibilities.slice(0, MAX_RESPONSIBILITIES);
    }

    return buildFallbackResponsibilities(selectedTrack?.title || "this career").slice(0, MAX_RESPONSIBILITIES);
  }, [currentLevelData.responsibilities, selectedTrack?.title]);

  const displayFitReasons = useMemo(() => {
    if (currentLevelData.fitReason.length) {
      return currentLevelData.fitReason.slice(0, MAX_FIT_REASONS);
    }

    return buildFallbackFitReasons(
      selectedTrack?.title || "this career",
      selectedTrack?.description,
    ).slice(0, MAX_FIT_REASONS);
  }, [currentLevelData.fitReason, selectedTrack?.description, selectedTrack?.title]);

  if (isLoadingTracks || (isLoadingData && !careerDetails && Boolean(selectedTrack))) {
    return (
      <JourneyTree
        current={1}
        maxReached={1}
        renderContent={renderLoadingState}
      />
    );
  }

  if (!selectedTrack) {
    return (
      <JourneyTree
        current={1}
        maxReached={1}
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
              padding: "var(--space-xl)",
              gap: "var(--space-lg)",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "1.6rem", margin: 0 }}>No Career Track Selected</h1>
            <p style={{ margin: 0, color: "#C1CBE6", maxWidth: "60ch" }}>
              Start by taking the career quiz or selecting a saved track from Home, then continue your Journey.
            </p>
            <button
              type="button"
              onClick={() => router.push("/features/career")}
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
              Go To Career Exploration
            </button>
          </div>
        )}
      />
    );
  }

  const nextPhase = maxReached < 5 ? maxReached + 1 : maxReached;
  const activeError = dataError || trackError;

  return (
    <JourneyTree
      current={1}
      maxReached={nextPhase}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack.id)}
      renderContent={() => (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            padding: "var(--space-xl)",
            gridTemplateColumns: "1.2fr 1fr",
            gridTemplateRows: "1fr",
            gridColumnGap: "var(--space-lg)",
            color: "white",
            textAlign: "left",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "2rem",
              gridArea: "1 / 1 / 2 / 2",
              maxWidth: "100%",
            }}
          >
            <div>
              <h1 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>
                {selectedTrack.title || "Career Track"}
              </h1>
              <p style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                {selectedTrack.description || "Track details are loading..."}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                width: "100%",
                gap: "var(--space-sm)",
              }}
            >
              {displaySkills.map((skill) => (
                <RectangularCard
                  key={skill}
                  theme="dark"
                  Title={skill}
                  style={{
                    flex:1,
                    minWidth: "fit-content",
                    flexGrow: 1,
                  }}
                />
              ))}
            </div>

            <div>
              <h1 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>
                Key Responsibilities
              </h1>

              {isLoadingData && !careerDetails ? (
                <p style={{ color: "lightgrey" }}>Loading track responsibilities...</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(1, 1fr)",
                    width: "fit-content",
                    gap: "var(--space-md)",
                  }}
                >
                  {displayResponsibilities.length ? (
                    displayResponsibilities.map((responsibility, index) => (
                      <p key={`${responsibility}-${index}`} style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                        {"\u2022"} {responsibility}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                      No detailed responsibilities are available for this track yet.
                    </p>
                  )}
                </div>
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
              gap: "2rem",
              gridArea: "1 / 2 / 2 / 3",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "100%",
                gap: "var(--space-sm)",
              }}
            >
              {LEVELS.map((level) => (
                <RectangularCard
                  key={level}
                  font="jura"
                  theme="light"
                  Title={level === "Entry" ? "Entry Level" : level}
                  selected={selectedLevel === level}
                  selectable
                  onSelect={() => setSelectedLevel(level)}
                  style={{
                    flex:1,
                    minWidth: "fit-content",
                    flexGrow: 1,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                width: "100%",
                height: "fit-content",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "var(--space-xl)",
              }}
            >
              <div>
                <h1 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-xs)" }}>Salary Range</h1>
                <h1 style={{ fontSize: "var(--text-md)", color: "lightgrey", margin: 0 }}>
                  {currentLevelData.salary}
                </h1>
              </div>

              <div>
                <h1 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-xs)" }}>Market Demand</h1>
                <h1 style={{ fontSize: "var(--text-md)", color: currentLevelData.demandColor, margin: 0 }}>
                  {currentLevelData.demand}
                </h1>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "var(--medium-blue)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-xl)",
              }}
            >
              <h1 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-md)" }}>
                This Would Fit You If
              </h1>

              {isLoadingData && !careerDetails ? (
                <p style={{ color: "lightgrey" }}>Loading fit profile...</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(1, 1fr)",
                    width: "fit-content",
                    gap: "var(--space-md)",
                  }}
                >
                  {displayFitReasons.map((fitReason, index) => (
                    <p key={`${fitReason}-${index}`} style={{fontSize: "var(--text-base)", color: "lightgrey", margin: 0 }}>
                      {"\u2022"} {fitReason}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {activeError ? (
              <p style={{ margin: 0, color: "#FFD3D3" }}>
                {activeError}
              </p>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
