"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import type { APIReport } from "@/types";
import { cvService, reportsService } from "@/services";
import { ActivityCard } from "@/components/ui/activity-card";
import { Button } from "@/components/ui/button";
import ChoiceCard from "@/components/ui/choice-card";
import CVPop from "@/components/ui/cvPopup";
import { StackContainer } from "@/components/ui/containers/stack";

function formatReportDate(dateIso: string): string {
  const parsedDate = new Date(dateIso);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return parsedDate.toLocaleDateString();
}

export default function CVCrafting() {
  const { user, isLoading: isAuthLoading } = useAuth();

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
    // refreshReports intentionally follows the latest user id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleFileSelection = async (file: File) => {
    if (isAuthLoading) {
      throw new Error("Checking your session. Please try again in a moment.");
    }

    if (!user?.id) {
      throw new Error("Please sign in first to extract your CV.");
    }

    setIsExtracting(true);
    setExtractorMessage("Uploading CV for extraction...");

    try {
      const response = await cvService.extractCV(user.id, file);

      if (!response.success) {
        throw new Error(response.message ?? "Failed to extract CV.");
      }

      setExtractorMessage("CV extracted successfully. Your profile data has been saved.");
      const refreshedReports = await refreshReports();
      const newest = refreshedReports[0];

      if (newest) {
        setExtractorMessage(`CV extracted successfully. Latest version: ${newest.filename}`);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to extract CV. Please try again.";
      setExtractorMessage(message);
      throw error;
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

  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: "var(--space-xl)",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr) 1.2fr",
          gridTemplateRows: "2fr 1fr",
          gridColumnGap: "var(--space-lg)",
          gridRowGap: "var(--space-lg)",
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <ChoiceCard
          key={1}
          title="CV Builder"
          description="Fill out our builder’s form and we will construct a tailored, professional, ATS-approved resume ready to download."
          icon="/cv/cv-builder.svg"
          buttonVariant="primary-inverted"
          route="/cv-feature/builder"
          style={{ gridArea: "1 / 1 / 2 / 2" }}
        />

        <ChoiceCard
          key={2}
          title="CV Enhancer"
          description="Elevate your existing resume with AI-driven insights that refine your language and highlight your achievements."
          icon="/cv/cv-enhancer.svg"
          buttonVariant="primary-inverted"
          route="/cv-feature/enhancer"
          style={{ gridArea: "1 / 2 / 2 / 3" }}
        />

        <StackContainer
          Title="Old Versions"
          style={{ gridArea: "1 / 3 / 3 / 4", backgroundColor: "var(--medium-blue)" }}
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
            gridArea: "2 / 1 / 3 / 3",
            backgroundColor: "#16203d",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-lg)",
              minWidth: 0,
              flex: 1,
              height: "100%",
            }}
          >
            <img
              src="/cv/cv-extractor.svg"
              alt=""
              style={{
                height: "var(--icon-4xl)"
              }}
            />
            <div
              style={{
                height: "80%",
                width: "0.2rem",
                backgroundColor: "white",
                flexShrink: 0,
                flexGrow: 0,
                alignItems: "center",
                display: "flex",
                borderRadius: "999px",
              }}
            />
            <div>
              <h3
                style={{
                  color: "white",
                  fontSize: "var(--text-md)",
                  fontFamily: "var(--font-nova-square)",
                  fontWeight: "200"
                }}
              >
                CV Extractor
              </h3>
              <p
                style={{
                  color: "white",
                  fontSize: "var(--text-base)",
                }}
              >
                Update your data on our system to automate job application later on
              </p>
            </div>
          </div>

          <Button
            variant="primary-inverted"
            onClick={() => setIsPopOpen(true)}
            disabled={isExtracting}
            style={{
              marginTop: "auto",
            }}
          >
            {isExtracting ? "Uploading..." : "Upload CV"}
          </Button>
        </div>
      </div>

      {isPopOpen ? (
        <CVPop
          onClose={() => setIsPopOpen(false)}
          lastVersion={lastVersionLabel}
          onFileSelect={handleFileSelection}
        />
      ) : null}
    </>
  );
}
