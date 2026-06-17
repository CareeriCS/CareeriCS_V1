"use client";

import React, { useEffect, useRef, useState } from "react";

import { useGoogleDriveUpload } from "@/hooks";
import {
  closeGoogleDriveWindow,
  navigateGoogleDriveWindow,
  openGoogleDriveLoadingWindow,
  renderGoogleDriveLoadingWindow,
} from "@/lib/google-drive-popup";
import { useAuth } from "@/providers/auth-provider";
import { cvService } from "@/services";
import { Button } from "@/components/ui/button";
import Animation from "@/components/ui/animation";
import InterviewContainer from "@/components/ui/interview-card";
import { PdfPreviewFrame } from "@/components/ui/pdf-preview-frame";

type AppStatus = "idle" | "enhancing" | "completed";

function toSafePdfFileName(label: string, fallback: string): string {
  const normalized = label
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return `${normalized || fallback}.pdf`;
}

export default function CV() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState("enhanced-cv.pdf");
  const { user } = useAuth();
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
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  useEffect(() => {
    return () => {
      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }
    };
  }, [selectedFilePreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }

      const nextFile = event.target.files[0];
      setSelectedFile(nextFile);
      setSelectedFilePreviewUrl(
        nextFile.type === "application/pdf" ? URL.createObjectURL(nextFile) : null,
      );
      setError(null);
    }
  };

  const handleAction = async () => {
    if (status === "idle") {
      if (!selectedFile) {
        fileInputRef.current?.click();
        return;
      }

      if (!user?.id) {
        setError("Please sign in first to enhance your CV.");
        return;
      }

      setError(null);
      setStatus("enhancing");
      const oldUrl = downloadUrl;

      try {
        const pdfBlob = await cvService.enhanceCV(user.id, selectedFile);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }

        const url = URL.createObjectURL(pdfBlob);
        setDownloadUrl(url);
        setDownloadBlob(pdfBlob);
        setDownloadName(
          toSafePdfFileName(
            `${selectedFile.name.replace(/\.[^.]+$/, "")}-enhanced`,
            "enhanced-cv",
          ),
        );
        resetUploadState();
        setStatus("completed");
      } catch (enhanceError) {
        const message =
          enhanceError instanceof Error
            ? enhanceError.message
            : "Failed to enhance CV. Please try again.";
        setError(message);
        setStatus("idle");
      }
    } else if (status === "completed") {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }

      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }

      setSelectedFile(null);
      setSelectedFilePreviewUrl(null);
      setError(null);
      setDownloadUrl(null);
      setDownloadBlob(null);
      setDownloadName("enhanced-cv.pdf");
      resetUploadState();
      setStatus("idle");
      fileInputRef.current?.click();
    }
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

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-center",
        alignItems: "flex-start",
        gap: "var(--space-lg)",
        padding: "var(--space-2xl)",
      }}
    >
      <h1
        style={{
          fontSize: "36px",
          fontWeight: "300",
          lineHeight: "1.1",
          fontFamily: "var(--font-nova-square)",
        }}
      >
        Upload your CV and we&apos;ll do the rest!
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2xl)",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2xl)",
            flexShrink: 0,
            height: "var(--container-2xs)",
            justifyContent: "space-between",
            flexGrow:0,
          }}
        >
          <div
            onClick={() => status === "idle" && fileInputRef.current?.click()}
            style={{
              width: "220px",
              minHeight:0,
              flex:1,
              backgroundColor: "white",
              borderRadius: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: status === "idle" ? "pointer" : "default",
              transition: "all 0.3s ease",
              overflow: "hidden",
            }}
          >
            {selectedFile && selectedFile.type === "application/pdf" && selectedFilePreviewUrl ? (
              <PdfPreviewFrame
                src={selectedFilePreviewUrl}
                title="Selected CV preview"
              />
            ) : selectedFile ? (
              <img
                src="/interview/analyzing.svg"
                alt="Selected CV file"
                style={{ width: "84px", height: "125px", objectFit: "contain" }}
              />
            ) : (
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgb(0, 0, 0)" strokeWidth="1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            )}
          </div>

          <Button
            onClick={() => void handleAction()}
            style={{
              width: "100%",
              flex: "none",
              border: "none",
              cursor: status === "enhancing" ? "default" : "pointer",
              transition: "all 0.3s ease",
            }}
            disabled={status === "enhancing"}
          >
            {status === "enhancing"
              ? "Enhancing..."
              : status === "completed"
                ? "Upload another CV"
                : selectedFile
                  ? "Enhance Now"
                  : "Open Files"}
          </Button>

          {error ? (
            <p style={{ color: "#ffb4b4", maxWidth: "220px", marginTop: "-8px" }}>{error}</p>
          ) : null}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
          accept=".pdf,.docx"
        />

        <div style={{ width: "1px", height: "300px", backgroundColor: "rgb(255, 255, 255)" }} />


        {status === "completed" ? (

          <InterviewContainer
            questionTitle=""
            videoBoxStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.41)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            videoContent={
              <div
              style={{
                display: "flex",
                height: "var(--container-xs)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "20px",
                  padding: "20px",
                  width: "var(--container-md)"
                }}
              >
                <div
                  style={{
                    width: "min(34vw, 180px)",
                    height: "min(46vw, 240px)",
                    minWidth: "130px",
                    minHeight: "170px",
                    borderRadius: "25px",
                    flexShrink: 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PdfPreviewFrame src={downloadUrl} title="CV preview" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <a
                    href={downloadUrl ?? "#"}
                    download={downloadName}
                    style={{
                      backgroundColor: "#d4ff47",
                      color: "#1a1a1a",
                      border: "none",
                      padding: "14px 40px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      width: "240px",
                      textAlign: "center",
                      textDecoration: "none",
                      pointerEvents: downloadUrl ? "auto" : "none",
                      opacity: downloadUrl ? 1 : 0.5,
                    }}
                  >
                    Download
                  </a>
                  <span style={{ color: "white", textAlign: "center", opacity: 0.6 }}>or</span>
                  <button
                    type="button"
                    onClick={() => void handleSaveToGoogleDrive()}
                    disabled={isSavingToDrive || !downloadBlob}
                    style={{
                      backgroundColor: "white",
                      color: "#1a1a1a",
                      border: "none",
                      padding: "12px 20px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "240px",
                      justifyContent: "center",
                      cursor: isSavingToDrive || !downloadBlob ? "default" : "pointer",
                      opacity: isSavingToDrive || !downloadBlob ? 0.7 : 1,
                    }}
                  >
                    <img src="/global/drive.svg" style={{ width: "18px" }} alt="Drive" />
                    {isSavingToDrive
                      ? "Opening Drive..."
                      : uploadedDriveFile
                        ? "Saved to Google Drive"
                        : "Save to Google Drive"}
                  </button>
                  {driveUploadError ? (
                    <p style={{ color: "#ffb4b4", width: "240px", margin: 0, textAlign: "center" }}>
                      {driveUploadError}
                    </p>
                  ) : null}
                  {uploadedDriveFile ? (
                    <p style={{ color: "#d4ff47", width: "240px", margin: 0, textAlign: "center" }}>
                      Saved to Google Drive.
                    </p>
                  ) : null}
                </div>
              </div>
            }
          />

        ) : null}
        {status === "enhancing" &&
        <div
        style={{
          width:"100%",
          display:"flex",
          justifyContent:"center",
        }}
        >
          <div style={{ maxWidth: "var(--container-sm)" }}>
            <Animation  />
          </div>
        </div>
        }
      </div>
    </div>
  );
}
