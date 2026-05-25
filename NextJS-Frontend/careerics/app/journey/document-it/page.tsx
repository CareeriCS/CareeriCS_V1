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

  // Delay render until all data is ready
  if (isLoadingTracks || isLoadingReports || !selectedTrack) {
    return (
      <JourneyTree
        current={3}
        maxReached={3}
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
      <JourneyTree
        current={3}
        maxReached={3}
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

  return (
    <JourneyTree
      current={3}
      maxReached={nextPhase}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase, selectedTrack?.id)}
      renderContent={() => (
        <>
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "40px",
              display: "grid",
              gridTemplateRows: "repeat(6, 1fr)",
              gridTemplateColumns: "repeat(6, 1fr)",
              gridColumnGap: "25px",
              gridRowGap: "20px",
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            <ChoiceCard
              title="CV Builder"
              description="Build your CV from scratch with a guided flow and generate recruiter-ready output."
              icon="/cv/cv-builder.svg"
              buttonVariant="primary-inverted"
              route="/cv-feature/builder"
              style={{ gridArea: "1 / 1 / 5 / 3", backgroundColor: "var(--medium-blue)" }}
            />

            <ChoiceCard
              title="CV Enhancer"
              description="Improve your existing CV with AI suggestions while preserving your original experience."
              icon="/cv/cv-enhancer.svg"
              buttonVariant="primary-inverted"
              route="/cv-feature/enhancer"
              style={{ gridArea: "1 / 3 / 5 / 5", backgroundColor: "var(--medium-blue)" }}
            />

            <StackContainer
              Title="Old Versions"
              style={{ gridArea: "1 / 5 / 7 / 7", backgroundColor: "var(--medium-blue)" }}
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

            <div
              style={{
                gridArea: "5 / 1 / 7 / 5",
                backgroundColor: "var(--medium-blue)",
                borderRadius: "4vh",
                padding: "25px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "25px", minWidth: 0 }}>
                <img src="/cv/cv-extractor.svg" alt="" style={{ height: "12vh" }} />
                <div style={{ height: "80px", width: "1.7px", backgroundColor: "white" }} />
                <div>
                  <h3
                    style={{
                      color: "white",
                      fontSize: "clamp(0.8rem,1.7vw,1.5rem)",
                      margin: 0,
                      fontFamily: "var(--font-nova-square)",
                      fontWeight: "200",
                    }}
                  >
                    CV Extractor
                  </h3>
                  <p style={{ color: "white", fontSize: "15px", marginTop: "5px", marginBottom: 0 }}>
                    Update your data on our system to automate job application later on.
                  </p>
                  {extractorMessage ? (
                    <p
                      style={{
                        color: extractorMessage.toLowerCase().includes("failed") ? "#FFD3D3" : "#D7E3FF",
                        fontFamily: "var(--font-jura)",
                        fontSize: "13px",
                        margin: "8px 0 0 0",
                      }}
                    >
                      {extractorMessage}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button
                variant="primary-inverted"
                onClick={() => setIsPopOpen(true)}
                disabled={isExtracting}
                style={{
                  flexGrow: 0,
                  flexShrink: 0,
                  paddingInline: "2vw",
                  marginTop: "auto",
                  paddingBlock: "2.5vh",
                  whiteSpace: "nowrap",
                }}
              >
                {isExtracting ? "Uploading..." : "Upload CV"}
              </Button>
            </div>

            {trackError ? (
              <p style={{ margin: 0, color: "#FFD3D3", gridArea: "6 / 1 / 7 / 5" }}>
                {trackError}
              </p>
            ) : null}
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
