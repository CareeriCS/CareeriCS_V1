"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ChoiceCard from "@/components/ui/choice-card";
import CVPop from "@/components/ui/cvPopup";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/ui/activity-card";
import JourneyTree from "@/components/ui/journey-tree";
import { useJourneyPhase } from "@/hooks/use-journey-phase";
import { buildJourneyPhaseHref } from "@/lib/journey";
import { useAuth } from "@/providers/auth-provider";
import { cvService, reportsService } from "@/services";
import type { APIReport } from "@/types";
import { StackContainer } from "@/components/ui/containers/stack";
import JourneyTreeVertical from "@/components/ui/journey-tree-vertical";
import { useResponsive } from "@/hooks/useResponsive";
import ChoiceCardHorizontal from "@/components/ui/choice-card-horizontal";

function formatReportDate(dateIso: string): string {
  const parsedDate = new Date(dateIso);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return parsedDate.toLocaleDateString();
}

export default function JourneyDocumentItPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    selectedTrack,
    maxReached,
    isLoadingTracks,
    trackError,
  } = useJourneyPhase(3);

  const [isPopOpen, setIsPopOpen] = useState(false);
  const [reports, setReports] = useState<APIReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [extractorMessage, setExtractorMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);



  const refreshReports = async (): Promise<APIReport[]> => {
    if (!user?.id) {
      setReports([]);
      return [];
    }

    setIsLoadingReports(true);
    setReportsError(null);

    const response = await reportsService.listUserReports(user.id, "cv");
    if (!response.success) {
      setReportsError(response.message ?? "Failed to load CV history.");
      setReports([]);
      setIsLoadingReports(false);
      return [];
    }

    const fetchedReports = response.data ?? [];
    setReports(fetchedReports);
    setIsLoadingReports(false);
    return fetchedReports;
  };

  useEffect(() => {
    const refreshTimer = setTimeout(() => {
      void refreshReports();
    }, 0);

    return () => clearTimeout(refreshTimer);
    // refreshReports intentionally depends on latest user id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleFileSelection = async (file: File) => {
    if (isAuthLoading) {
      setExtractorMessage("Checking your session. Please try again in a moment.");
      return;
    }

    if (!user?.id) {
      setExtractorMessage("Please sign in first to extract your CV.");
      return;
    }

    setIsExtracting(true);
    setExtractorMessage("Uploading CV for extraction...");

    try {
      const response = await cvService.extractCV(user.id, file);

      if (!response.success) {
        setExtractorMessage(response.message ?? "Failed to extract CV.");
        return;
      }

      setExtractorMessage("CV extracted successfully. Your profile data has been saved.");
      const refreshedReports = await refreshReports();
      const newest = refreshedReports[0];

      if (newest) {
        setExtractorMessage(`CV extracted successfully. Latest report: ${newest.filename}`);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to extract CV. Please try again.";
      setExtractorMessage(message);
    } finally {
      setIsExtracting(false);
    }
  };

  const archiveItems = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        label: report.filename,
        date: formatReportDate(report.created_at),
      })),
    [reports],
  );

  const lastVersionLabel = reports[0]?.filename ?? "No extracted version";

  const handleDownloadReport = (item: { id: string; label?: string }) => {
    const downloadUrl = reportsService.getReportDownloadUrl(item.id);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = item.label ?? "cv-report.pdf";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const { isLarge, isMedium, isSmall } = useResponsive();
  const Orientation = isLarge ? JourneyTree : JourneyTreeVertical;

  // Delay render until all data is ready
  if (isLoadingTracks || isLoadingReports || !selectedTrack) {
    return (
      <Orientation
        current={3}
        maxReached={3}
        naturalMaxReached={3}
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
                Loading your CV tools...
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
        current={3}
        maxReached={3}
        naturalMaxReached={3}
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
              Choose a track from Home first, then continue your journey phases.
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

  const CardType = isLarge ? ChoiceCard : ChoiceCardHorizontal;

  return (
    <Orientation
      current={3}
      maxReached={nextPhase}
      naturalMaxReached={maxReached}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack?.id)}
      renderContent={() => (
        <>
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "var(--space-xl)",
              display: "grid",
              gridTemplateColumns: isLarge ? "repeat(2, 1fr) 1.2fr" : isMedium ? "1.5fr 1fr" : "1fr",
              gridTemplateRows: isLarge ? "2fr 1fr" : "repeat(3, 1fr)",
              gridColumnGap: "var(--space-lg)",
              gridRowGap: "var(--space-lg)",
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            <CardType
              key={1}
              title="CV Builder"
              description="Fill out our builder’s form and we will construct a tailored, professional, ATS-approved resume ready to download."
              icon="/cv/cv-builder.svg"
              buttonVariant="primary-inverted"
              route="/cv-feature/builder"
              style={{ gridArea: isLarge ? "1 / 1 / 2 / 2" : "1 / 1 / 2 / 2",backgroundColor: "var(--medium-blue)" }}
            />

            <CardType
              key={2}
              title="CV Enhancer"
              description="Elevate your existing resume with AI-driven insights that refine your language and highlight your achievements."
              icon="/cv/cv-enhancer.svg"
              buttonVariant="primary-inverted"
              route="/cv-feature/enhancer"
              style={{ gridArea: isLarge ? "1 / 2 / 2 / 3" : "2 / 1 / 3 / 2",backgroundColor: "var(--medium-blue)" }}
            />

            {!isSmall && (
              <StackContainer
                Title="Old Versions"
                style={{
                  gridArea: isLarge ? "1 / 3 / 3 / 4" : "1 / 2 / 4 / 3",
                  backgroundColor: "var(--bg-grey)",
                  color:"black",
                }}
                centerTitle
              >
                {archiveItems.length ? (
                  archiveItems.map((item) => (
                    <ActivityCard
                      key={item.id}
                      title={item.label}
                      date={item.date}
                      onClick={() => handleDownloadReport(item)}
                      variant="download"
                      theme="dark"
                    />
                  ))
                ) : (
                  <div
                    style={{
                      color: reportsError ? "#FFD3D3" : "#D7E3FF",
                      fontFamily: "var(--font-jura)",
                      textAlign: "center",
                      paddingInline: "20px",
                    }}
                  >
                    {isLoadingReports
                      ? "Loading your CV history..."
                      : reportsError || "No saved CV versions yet."}
                  </div>
                )}
              </StackContainer>
            )}

            <ChoiceCardHorizontal
              icon="/cv/cv-extractor.svg"
              title="CV Extractor"
              description="Update your data on our system to automate job application later on"
              buttonText="Upload CV"
              buttonLoadingText="Uploading..."
              isLoading={isExtracting}
              onButtonClick={() => setIsPopOpen(true)}
              style={{
                gridArea: isLarge ? "2 / 1 / 3 / 3" : "3 / 1 / 4 / 2",
                backgroundColor: "var(--medium-blue)"
              }}
            />

          </div>

          {isPopOpen ? (
            <CVPop
              onClose={() => setIsPopOpen(false)}
              lastVersion={lastVersionLabel}
              onFileSelect={handleFileSelection}
            />
          ) : null}
        </>
      )}
    />
  );
}
