"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InterviewLayout from "@/components/ui/interview";
import InterviewContainer from "@/components/ui/interview-card";
import Animation from "@/components/ui/animation";
import { useGoogleDriveUpload, useInterviewFlow } from "@/hooks";
import {
  closeGoogleDriveWindow,
  navigateGoogleDriveWindow,
  openGoogleDriveLoadingWindow,
  renderGoogleDriveLoadingWindow,
} from "@/lib/google-drive-popup";
import { interviewService } from "@/services/interview.service";
import { reportsService } from "@/services/reports.service";
import { useResponsive } from "@/hooks/useResponsive";
import { Button } from "@/components/ui/button";

const PDF_SCROLLBAR_GUTTER_PX = 28;

export default function LastAnalysisPage() {
  const router = useRouter();
  const {
    sessionId,
    currentQ,
    questions,
    questionsError,
  } = useInterviewFlow();

  const { isLarge, isMedium, isSmall } = useResponsive();
  const [isPreparing, setIsPreparing] = useState(true);
  const [reportError, setReportError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState("interview-analysis.pdf");
  const {
    isUploading: isSavingToDrive,
    uploadError: driveUploadError,
    uploadedFile: uploadedDriveFile,
    ensureGoogleDriveAccess,
    resetUploadState,
    uploadToGoogleDrive,
  } = useGoogleDriveUpload();
  const driveOpenLink = uploadedDriveFile?.webViewLink ?? uploadedDriveFile?.webContentLink ?? null;

  useEffect(() => {
    let alive = true;

    const finalizeInterview = async () => {
      resetUploadState();
      setDownloadBlob(null);

      if (!sessionId) {
        if (alive) {
          setReportError("Session is missing. Please retry the interview flow.");
          setIsPreparing(false);
        }
        return;
      }

      const response = await interviewService.completeSession(sessionId);
      if (!alive) {
        return;
      }

      if (!response.success || !response.data?.report?.id) {
        setReportError(response.message || "Report is not ready yet. Please retry download below.");
        setDownloadUrl(null);
        setDownloadBlob(null);
        setIsPreparing(false);
        return;
      }

      const reportDownloadUrl = reportsService.getReportDownloadUrl(response.data.report.id);

      try {
        const reportResponse = await fetch(reportDownloadUrl);
        if (!alive) {
          return;
        }

        if (!reportResponse.ok) {
          setReportError("Completed report was saved, but preview download failed. Please retry.");
          setDownloadUrl(null);
          setDownloadBlob(null);
          setIsPreparing(false);
          return;
        }

        const blob = await reportResponse.blob();
        if (!alive) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        setDownloadName(response.data.report.filename || "interview-analysis.pdf");
        setDownloadBlob(blob);
        setDownloadUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }

          return objectUrl;
        });
        setReportError("");
        setIsPreparing(false);
      } catch {
        if (!alive) {
          return;
        }

        setReportError("Completed report was saved, but preview download failed. Please retry.");
        setDownloadUrl(null);
        setDownloadBlob(null);
        setIsPreparing(false);
      }
    };

    void finalizeInterview();

    return () => {
      alive = false;
    };
  }, [resetUploadState, sessionId]);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const layoutQuestions = questions.map((q) => ({
    ...q,
    title: q.text,
  }));

  const lastStep = questions.length || currentQ || 1;

  const onDownloadReport = () => {
    if (!downloadUrl) {
      setReportError("Report is not ready yet. Please retry in a moment.");
      return;
    }

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = downloadName;
    link.click();
  };

  const handleSaveToGoogleDrive = async () => {
    if (driveOpenLink) {
      window.open(driveOpenLink, "_blank", "noopener,noreferrer");
      return;
    }

    const driveTab = openGoogleDriveLoadingWindow();
    const hasDriveAccess = await ensureGoogleDriveAccess({
      popupWindow: driveTab,
    });
    if (!hasDriveAccess) {
      closeGoogleDriveWindow(driveTab);
      return;
    }

    renderGoogleDriveLoadingWindow(driveTab);
    const uploaded = await uploadToGoogleDrive(downloadBlob, {
      fileName: downloadName,
      mimeType: downloadBlob?.type || "application/pdf",
    });

    const nextDriveLink = uploaded?.webViewLink ?? uploaded?.webContentLink ?? null;
    if (nextDriveLink) {
      navigateGoogleDriveWindow(driveTab, nextDriveLink);
      return;
    }

    closeGoogleDriveWindow(driveTab);
  };

  if (isPreparing) {
    return (
      <InterviewLayout
        title="Last Analysis"
        questions={layoutQuestions}
        currentActiveId={lastStep}
        unlockedStepId={lastStep}
        onQuestionClick={() => { }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
          }}
        >
          <div style={{ maxWidth: "var(--container-sm)", }}>
            <Animation
              message={`Our model is preparing your final analysis report,\ngive us a moment.`}
            />
          </div>
        </div>
      </InterviewLayout>
    );
  }

  return (
    <InterviewLayout
      title="Last Analysis"
      questions={layoutQuestions}
      currentActiveId={lastStep}
      unlockedStepId={lastStep}
      onQuestionClick={() => { }}
    >
      <div
        style={{
          width: "",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          gap: "var(--space-lg)",
          justifyContent: "space-evenly",
          height: "100%"
        }}
      >
        <div
          style={{
            textAlign: "left",
            width: "100%",
          }}
        >
          <h2
            style={{
              color: "white",
              fontSize: "var(--text-lg)",
              fontFamily: "var(--font-nova-square)",
            }}
          >
            Ready to see your interview highlights?
          </h2>
          <p
            style={{
              color: "white",
              fontSize: "var(--text-base)",
              fontFamily: "var(--font-nova-square)",
              opacity: 0.9,
              margin: 0,
            }}
          >
            Download the analysis below.
          </p>
          {reportError && (
            <p
              style={{
                color: "#fca5a5",
                fontSize: "14px",
                marginTop: "12px",
                fontFamily: "var(--font-nova-square)",
              }}
            >
              {reportError}
            </p>
          )}
          {questionsError && (
            <p
              style={{
                color: "#fca5a5",
                fontSize: "14px",
                marginTop: "8px",
                fontFamily: "var(--font-nova-square)",
              }}
            >
              {questionsError}
            </p>
          )}
        </div>

        <InterviewContainer
          questionTitle=""
          videoBoxStyle={{
            background: "var(--medium-grey)",
            height: "fit-content",

          }}
          videoContent={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2xl)",
                padding: "var(--space-lg)",
                width: "fit-content",
                height: "fit-content",
                backgroundColor: "transparent",
                flexDirection: isLarge ? "row" : "column",
                aspectRatio: !isLarge ? "none" : "16 / 9",
              }}
            >
              <div
                style={{
                  position: "relative",
                  backgroundColor: "white",
                  borderRadius: "25px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                  overflow: "hidden",
                  height: "200px",
                  width: isLarge ? "166px" : "min(166px, 100%)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {downloadUrl ? (
                  <iframe
                    src={`${downloadUrl}#view=FitH&zoom=page-fit&pagemode=none&toolbar=0&navpanes=0&scrollbar=0`}
                    title="Interview analysis preview"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `calc(100% + ${PDF_SCROLLBAR_GUTTER_PX}px)`,
                      height: "100%",
                      border: "none",
                      backgroundColor: "white",
                      display: "block",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      textAlign: "center",
                      padding: "10px",
                    }}
                  >
                    Preview unavailable
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: isLarge ? "column" : "row",
                  alignItems: "center",
                  gap: "var(--space-lg)",
                  maxWidth: "100%"
                }}
              >
                <Button
                  onClick={onDownloadReport}
                  style={{
                    cursor: downloadUrl ? "pointer" : "default",
                    opacity: downloadUrl ? 1 : 0.55,
                    width: isLarge ? "100%" : "",
                  }}
                  disabled={!downloadUrl}
                >
                  Download
                </Button>

                <span
                  style={{
                    color: "white",
                    fontSize: "14px",
                    opacity: 0.8,
                    fontFamily: "var(--font-nova-square)",
                  }}
                >
                  or
                </span>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSaveToGoogleDrive()}
                  disabled={isSavingToDrive || !downloadBlob}
                  style={{
                    cursor: isSavingToDrive || !downloadBlob ? "default" : "pointer",
                    opacity: isSavingToDrive || !downloadBlob ? 0.7 : 1,
                    width: isLarge ? "100%" : "",
                  }}
                >
                  <img src="/global/drive.svg" style={{ width: "20px" }} alt="Drive" />
                  {isSavingToDrive
                    ? "Opening Drive..."
                    : uploadedDriveFile
                      ? "Saved to Google Drive"
                      : "Save to Google Drive"}
                </Button>
                {driveUploadError ? (
                  <p
                    style={{
                      color: "#fca5a5",
                      fontSize: "13px",
                      margin: 0,
                      width: "260px",
                      textAlign: "center",
                      fontFamily: "var(--font-nova-square)",
                    }}
                  >
                    {driveUploadError}
                  </p>
                ) : null}
                {uploadedDriveFile ? (
                  <p
                    style={{
                      color: "#d4ff47",
                      fontSize: "13px",
                      margin: 0,
                      width: "260px",
                      textAlign: "center",
                      fontFamily: "var(--font-nova-square)",
                    }}
                  >
                    Saved to Google Drive.
                  </p>
                ) : null}
              </div>
            </div>
          }
          style={{ background: "transparent" }}
        />

        <div style={{ display: "flex", gap: "40px", marginTop: "60px" }}>
          <Button
            variant="secondary-inverted"
            onClick={() => router.push("/features/home")}
          >
            Go back to home
          </Button>
          <Button
            variant="primary-inverted"
            onClick={() => router.push("/features/interview")}
          >
            Practice more
          </Button>
        </div>
      </div>
    </InterviewLayout>
  );
}
