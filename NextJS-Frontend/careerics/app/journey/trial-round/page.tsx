"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import JourneyTree from "@/components/ui/journey-tree";
import ChoiceCard from "@/components/ui/choice-card";
import TipCard from "@/components/ui/3ateyat";
import CustomizeInterviewPopup from "@/components/ui/popup";
import { StackContainer } from "@/components/ui/containers/stack";
import { ActivityCard } from "@/components/ui/activity-card";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { buildJourneyPhaseHref } from "@/lib/journey";
import {
  buildInterviewRecordingRoute,
  buildInterviewSessionName,
  formatInterviewArchiveDate,
  getTechnicalInterviewTypes,
  normalizeInterviewType,
} from "@/lib/interview";
import { interviewService } from "@/services/interview.service";
import { reportsService } from "@/services/reports.service";
import { useAuth } from "@/providers/auth-provider";
import type { APIInterviewArchiveItem } from "@/types";

export default function JourneyTrialRoundPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const {
    selectedTrack,
    maxReached,
    isLoadingTracks,
    trackError,
  } = useJourneyPhase(4);

  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [archiveItems, setArchiveItems] = useState<APIInterviewArchiveItem[]>([]);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [technicalTypes, setTechnicalTypes] = useState<string[]>([]);
  const [isLoadingTechnicalTypes, setIsLoadingTechnicalTypes] = useState(false);
  const [technicalPopupError, setTechnicalPopupError] = useState<string | null>(null);
  const [isTechnicalPopupOpen, setIsTechnicalPopupOpen] = useState(false);
  const [selectedTechnicalType, setSelectedTechnicalType] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let alive = true;

    const loadArchive = async () => {
      if (!user?.id) {
        setArchiveItems([]);
        setArchiveError(null);
        setIsArchiveLoading(false);
        return;
      }

      setIsArchiveLoading(true);

      const response = await interviewService.getUserArchive(user.id);
      if (!alive) {
        return;
      }

      if (!response.success) {
        setArchiveItems([]);
        setArchiveError(response.message || "Unable to load completed interview reports.");
        setIsArchiveLoading(false);
        return;
      }

      setArchiveItems(response.data ?? []);
      setArchiveError(null);
      setIsArchiveLoading(false);
    };

    void loadArchive();

    return () => {
      alive = false;
    };
  }, [isLoading, user?.id]);

  const loadTechnicalTypes = useCallback(async () => {
    if (technicalTypes.length || isLoadingTechnicalTypes) {
      return;
    }

    setIsLoadingTechnicalTypes(true);
    setTechnicalPopupError(null);

    const response = await interviewService.listQuestionTypes();
    if (!response.success) {
      setTechnicalPopupError(response.message || "Unable to load technical interview types.");
      setIsLoadingTechnicalTypes(false);
      return;
    }

    const availableTypes = getTechnicalInterviewTypes(response.data ?? []);
    setTechnicalTypes(availableTypes);
    if (!availableTypes.length) {
      setTechnicalPopupError("No technical interview types are available yet.");
    }
    setIsLoadingTechnicalTypes(false);
  }, [isLoadingTechnicalTypes, technicalTypes.length]);

  const handleStartInterview = useCallback(async (interviewType: string) => {
    if (isStartingInterview) {
      return false;
    }

    setIsStartingInterview(true);
    setTechnicalPopupError(null);
    setStartError(null);

    try {
      if (!isLoading && !user?.id) {
        router.push("/auth/login");
        return false;
      }

      if (!user?.id) {
        return false;
      }

      const normalizedType = normalizeInterviewType(interviewType);
      const response = await interviewService.createSession({
        name: buildInterviewSessionName(normalizedType),
        type: normalizedType,
        status: "in_progress",
        user_id: user.id,
      });

      if (!response.success || !response.data?.id) {
        const message = response.message || "Failed to start interview session.";
        setTechnicalPopupError(message);
        setStartError(message);
        return false;
      }

      router.push(buildInterviewRecordingRoute(normalizedType, response.data.id));
      return true;
    } finally {
      setIsStartingInterview(false);
    }
  }, [isLoading, isStartingInterview, router, user?.id]);

  const startButtonLabel = useMemo(() => {
    if (isStartingInterview) {
      return "Starting...";
    }

    if (isLoading) {
      return "Loading...";
    }

    return "Start";
  }, [isLoading, isStartingInterview]);

  const isStartDisabled = isLoading || isStartingInterview;

  const handleOpenTechnicalPopup = useCallback(() => {
    if (!isLoading && !user?.id) {
      router.push("/auth/login");
      return;
    }

    setIsTechnicalPopupOpen(true);
    void loadTechnicalTypes();
  }, [isLoading, loadTechnicalTypes, router, user?.id]);

  const handleStartTechnical = useCallback(async (technicalType: string) => {
    setSelectedTechnicalType(technicalType);
    const started = await handleStartInterview(technicalType);
    if (started) {
      setIsTechnicalPopupOpen(false);
    }
  }, [handleStartInterview]);

  const handleDownloadArchiveItem = useCallback((item: APIInterviewArchiveItem) => {
    const downloadUrl = reportsService.getReportDownloadUrl(item.report_id);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = item.report_filename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  // Delay render until all data is ready
  const isInitializing = isLoadingTracks || isLoading;
  if (isInitializing && !selectedTrack) {
    return (
      <JourneyTree
        current={4}
        maxReached={4}
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
                Loading interview sessions...
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
        current={4}
        maxReached={4}
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

  const nextPhase = maxReached < 5
    ? maxReached + 1
    : maxReached;

  return (
    <JourneyTree
      current={4}
      maxReached={nextPhase}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack?.id)}
      renderContent={() => (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
            gridColumnGap: "25px",
            gridRowGap: "20px",
            width: "100%",
            height: "100%",
            padding: "40px",
          }}
        >
          <ChoiceCard
            title="Behavioral Mock Interview"
            description="Practice common interview questions and improve how you present your skills and experience."
            buttonVariant="primary-inverted"
            onClick={() => {
              void handleStartInterview("HR");
            }}
            disabled={isStartDisabled}
            buttonLabel={startButtonLabel}
            icon="/interview/hr.svg"
            style={{ gridArea: "1 / 1 / 3 / 2", backgroundColor: "var(--medium-blue)" }}
          />

          <ChoiceCard
            title="Technical Mock Interview"
            description="Choose the technical career you want to practice, then we will load the matching technical question bank."
            buttonVariant="primary-inverted"
            onClick={handleOpenTechnicalPopup}
            disabled={isStartDisabled}
            buttonLabel={startButtonLabel}
            icon="/interview/tech.svg"
            style={{ gridArea: "1 / 2 / 3 / 3", backgroundColor: "var(--medium-blue)" }}
          />

          <StackContainer
            Title="Interviews Archive"
            centerTitle
            style={{ gridArea: "1 / 3 / 3 / 4" }}
          >
            {archiveItems.length ? (
              archiveItems.map((item) => (
                <ActivityCard
                  key={item.report_id}
                  title={item.session_name}
                  date={formatInterviewArchiveDate(item.report_created_at || item.session_created_at)}
                  variant="download"
                  onClick={() => handleDownloadArchiveItem(item)}
                />
              ))
            ) : (
              <div
                style={{
                  color: archiveError ? "#FFD3D3" : "#D7E3FF",
                  fontFamily: "var(--font-jura)",
                  textAlign: "center",
                  paddingInline: "10px",
                }}
              >
                {isArchiveLoading
                  ? "Loading completed interview reports..."
                  : archiveError || "No completed interview reports yet."}
              </div>
            )}
          </StackContainer>

          <TipCard
            title="Tip of the day"
            description="Research the company and role before each mock. Your answers become stronger when they are contextual."
            icon="/global/tip.svg"
            style={{ gridArea: "3 / 1 / 4 / 4" }}
          />

          {trackError ? (
            <p style={{ margin: 0, color: "#FFD3D3", gridArea: "3 / 1 / 4 / 4", alignSelf: "end" }}>
              {trackError}
            </p>
          ) : null}

          {startError ? (
            <p
              style={{
                margin: 0,
                color: "#FFD3D3",
                gridArea: "3 / 1 / 4 / 4",
                alignSelf: "end",
                justifySelf: "center",
                fontFamily: "var(--font-jura)",
              }}
            >
              {startError}
            </p>
          ) : null}

          {isTechnicalPopupOpen ? (
            <CustomizeInterviewPopup
              onClose={() => {
                if (isStartingInterview) {
                  return;
                }

                setIsTechnicalPopupOpen(false);
              }}
              onStart={(technicalType) => {
                void handleStartTechnical(technicalType);
              }}
              options={technicalTypes}
              isSubmitting={isStartingInterview}
              isLoadingOptions={isLoadingTechnicalTypes}
              errorMessage={technicalPopupError}
              initialValue={selectedTechnicalType}
            />
          ) : null}
        </div>
      )}
    />
  );
}
