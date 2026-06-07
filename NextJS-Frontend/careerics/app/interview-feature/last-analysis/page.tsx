"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InterviewLayout from "@/components/ui/interview";
import InterviewContainer from "@/components/ui/interview-card";
import { useGoogleDriveUpload, useInterviewFlow } from "@/hooks";
import {
  closeGoogleDriveWindow,
  navigateGoogleDriveWindow,
  openGoogleDriveLoadingWindow,
  renderGoogleDriveLoadingWindow,
} from "@/lib/google-drive-popup";
import { interviewService } from "@/services/interview.service";
import { reportsService } from "@/services/reports.service";

type LastAnalysisButtonId = "download" | "drive" | "practice" | "home";
type LastAnalysisButtonVariant = "green" | "blue" | "drive";

const LIGHT_GREEN = "#e6ff86";
const PRIMARY_GREEN = "var(--primary-green)";
const LIGHT_BLUE = "#dbe7f3";
const WHITE = "#ffffff";

export default function LastAnalysisPage() {
  const router = useRouter();

  const { sessionId, currentQ, questions, questionsError } = useInterviewFlow();

  const [isPreparing, setIsPreparing] = useState(true);
  const [reportError, setReportError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState("interview-analysis.pdf");
  const [hoveredButton, setHoveredButton] = useState<LastAnalysisButtonId | null>(null);

  const {
    isUploading: isSavingToDrive,
    uploadError: driveUploadError,
    uploadedFile: uploadedDriveFile,
    ensureGoogleDriveAccess,
    resetUploadState,
    uploadToGoogleDrive,
  } = useGoogleDriveUpload();

  const driveOpenLink =
    uploadedDriveFile?.webViewLink ?? uploadedDriveFile?.webContentLink ?? null;

  const getButtonStyle = (
    buttonId: LastAnalysisButtonId,
    variant: LastAnalysisButtonVariant,
    disabled = false,
  ): React.CSSProperties => {
    const isHovered = hoveredButton === buttonId && !disabled;

    let backgroundColor = LIGHT_GREEN;

    if (variant === "green") {
      backgroundColor = isHovered ? PRIMARY_GREEN : LIGHT_GREEN;
    }

    if (variant === "blue") {
      backgroundColor = isHovered ? WHITE : LIGHT_BLUE;
    }

    if (variant === "drive") {
      backgroundColor = isHovered ? LIGHT_BLUE : WHITE;
    }

    return {
      backgroundColor,
      opacity: disabled ? 0.55 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transform: isHovered ? "translateY(-1px)" : "translateY(0)",
    };
  };

  const getHoverHandlers = (buttonId: LastAnalysisButtonId, disabled = false) => ({
    onMouseEnter: () => {
      if (!disabled) setHoveredButton(buttonId);
    },
    onMouseLeave: () => setHoveredButton(null),
    onFocus: () => {
      if (!disabled) setHoveredButton(buttonId);
    },
    onBlur: () => setHoveredButton(null),
  });

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

  const layoutQuestions = useMemo(
    () =>
      questions.map((q) => ({
        ...q,
        title: q.text,
      })),
    [questions],
  );

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
        onQuestionClick={() => {}}
        singleLineItems
        disableNavigation
      >
        <div className="last-analysis-page last-analysis-preparing">
          <h2 className="last-analysis-title">
            Our model is preparing your final analysis report,
            <br />
            give us a moment.
          </h2>

          <img
            src="/interview/analyzing.svg"
            alt="Preparing analysis"
            className="last-analysis-loading-image"
          />

          <style jsx>{styles}</style>
        </div>
      </InterviewLayout>
    );
  }

  const isDownloadDisabled = !downloadUrl;
  const isDriveDisabled = isSavingToDrive || !downloadBlob;

  return (
    <InterviewLayout
      title="Last Analysis"
      questions={layoutQuestions}
      currentActiveId={lastStep}
      unlockedStepId={lastStep}
      onQuestionClick={() => {}}
      singleLineItems
      disableNavigation
    >
      <div className="last-analysis-page">
        <header className="last-analysis-header">
          <h2 className="last-analysis-title">Ready to see your interview highlights?</h2>
          <p className="last-analysis-subtitle">Download the analysis below.</p>

          {reportError ? <p className="last-analysis-error">{reportError}</p> : null}
          {questionsError ? <p className="last-analysis-error">{questionsError}</p> : null}
        </header>

        <InterviewContainer
          questionTitle=""
          style={{ background: "transparent" }}
          videoBoxStyle={{
            background: "rgba(186, 186, 186, 0.5)",
            width: "min(76%, 740px)",
            height: "390px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}
          videoContent={
            <div className="last-analysis-card-content">
              <div className="last-analysis-pdf-frame" aria-label="Interview analysis preview">
                {downloadUrl ? (
                  <div className="last-analysis-pdf-clip">
                    <iframe
                      src={`${downloadUrl}#view=FitH&zoom=page-fit&pagemode=none&toolbar=0&navpanes=0&scrollbar=0`}
                      title="Interview analysis preview"
                      scrolling="no"
                      className="last-analysis-pdf"
                    />
                  </div>
                ) : (
                  <span className="last-analysis-preview-empty">Preview unavailable</span>
                )}
              </div>

              <div className="last-analysis-download-actions">
                <button
                  type="button"
                  onClick={onDownloadReport}
                  disabled={isDownloadDisabled}
                  className="last-analysis-button last-analysis-button-green"
                  style={getButtonStyle("download", "green", isDownloadDisabled)}
                  {...getHoverHandlers("download", isDownloadDisabled)}
                >
                  Download
                </button>

                <span className="last-analysis-or">or</span>

                <button
                  type="button"
                  onClick={() => void handleSaveToGoogleDrive()}
                  disabled={isDriveDisabled}
                  className="last-analysis-button last-analysis-button-drive"
                  style={getButtonStyle("drive", "drive", isDriveDisabled)}
                  {...getHoverHandlers("drive", isDriveDisabled)}
                >
                  <img src="/global/drive.svg" className="last-analysis-drive-icon" alt="Drive" />
                  {isSavingToDrive
                    ? "Opening Drive..."
                    : uploadedDriveFile
                      ? "Saved to Google Drive"
                      : "Save to Google Drive"}
                </button>

                {driveUploadError ? (
                  <p className="last-analysis-drive-message last-analysis-error">
                    {driveUploadError}
                  </p>
                ) : null}

                {uploadedDriveFile ? (
                  <p className="last-analysis-drive-message last-analysis-success">
                    Saved to Google Drive.
                  </p>
                ) : null}
              </div>
            </div>
          }
        />

        <div className="last-analysis-bottom-actions">
          <button
            type="button"
            onClick={() => router.push("/features/interview")}
            className="last-analysis-button last-analysis-button-blue last-analysis-bottom-button"
            style={getButtonStyle("practice", "blue")}
            {...getHoverHandlers("practice")}
          >
            Practice more
          </button>

          <button
            type="button"
            onClick={() => router.push("/features/home")}
            className="last-analysis-button last-analysis-button-green last-analysis-bottom-button"
            style={getButtonStyle("home", "green")}
            {...getHoverHandlers("home")}
          >
            Go back to home
          </button>
        </div>

        <style jsx>{styles}</style>
      </div>
    </InterviewLayout>
  );
}

const styles = `
  .last-analysis-page,
  .last-analysis-page * {
    box-sizing: border-box;
    font-family: var(--font-nova-square), sans-serif;
    font-weight: 400 !important;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .last-analysis-page::-webkit-scrollbar,
  .last-analysis-page *::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .last-analysis-page {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 34px;
    padding: 32px 24px 42px;
    text-align: center;
    overflow: hidden;
  }

  .last-analysis-preparing {
    gap: 70px;
  }

  .last-analysis-header {
    width: 100%;
    max-width: 850px;
    margin: 0 auto;
    text-align: center;
  }

  .last-analysis-title {
    margin: 0;
    color: white;
    font-size: clamp(22px, 2.4vw, 28px);
    line-height: 1.45;
    text-align: center;
  }

  .last-analysis-subtitle {
    margin: 12px 0 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 18px;
    line-height: 1.5;
    text-align: center;
  }

  .last-analysis-error {
    margin: 12px auto 0;
    color: #fca5a5;
    font-size: 14px;
    line-height: 1.5;
    text-align: center;
  }

  .last-analysis-success {
    margin: 0;
    color: var(--primary-green);
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
  }

  .last-analysis-loading-image {
    width: 300px;
    max-width: 80%;
    filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.4));
  }

  .last-analysis-card-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 60px;
    padding: 20px;
    background: transparent;
  }

  .last-analysis-pdf-frame {
    width: 180px;
    height: 240px;
    background: white;
    border-radius: 25px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .last-analysis-pdf-clip {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 25px;
    position: relative;
  }

  .last-analysis-pdf {
    width: calc(100% + 28px);
    height: 100%;
    border: none;
    display: block;
    margin-right: -28px;
    overflow: hidden;
  }

  .last-analysis-preview-empty {
    color: #6b7280;
    font-size: 12px;
    text-align: center;
    padding: 10px;
  }

  .last-analysis-download-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }

  .last-analysis-button {
    border: none;
    border-radius: 14px;
    min-height: 50px;
    padding: 14px 34px;
    font-size: 16px;
    line-height: 1;
    color: #1a1a1a;
    transition:
      background-color 0.22s ease,
      color 0.22s ease,
      opacity 0.22s ease,
      transform 0.22s ease;
  }

  .last-analysis-button-green,
  .last-analysis-button-blue {
    width: 260px;
  }

  .last-analysis-button-drive {
    width: 260px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 14px;
  }

  .last-analysis-drive-icon {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
  }

  .last-analysis-or {
    color: white;
    font-size: 14px;
    opacity: 0.8;
  }

  .last-analysis-drive-message {
    width: 260px;
    margin: 0;
    font-size: 13px;
    text-align: center;
  }

  .last-analysis-bottom-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .last-analysis-bottom-button {
    min-width: 245px;
  }

  @media (max-width: 900px) {
    .last-analysis-page {
      justify-content: flex-start;
      padding-top: 24px;
    }

    .last-analysis-card-content {
      flex-direction: column;
      gap: 28px;
      padding: 24px 16px;
    }

    .last-analysis-pdf-frame {
      width: 160px;
      height: 210px;
    }

    .last-analysis-bottom-actions {
      gap: 16px;
    }
  }
`;