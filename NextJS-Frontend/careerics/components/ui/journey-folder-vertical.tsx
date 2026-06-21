"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { syncSelectedJourneyTrackProgress } from "@/lib/journey";
import { useAuth } from "@/providers/auth-provider";

const PHASE_CONFIG = {
  1: {
    label: "The Crosspaths",
    path: "/journey/the-crosspaths",
    marginLeft: "0",
  },
  2: {
    label: "Pave The Way",
    path: "/journey/pave-the-way",
    marginLeft: "15vw",
  },
  3: {
    label: "Document It",
    path: "/journey/document-it",
    marginLeft: "30vw",
  },
  4: {
    label: "Trial Round",
    path: "/journey/trial-round",
    marginLeft: "45vw",
  },
  5: {
    label: "Job Hunt",
    path: "/journey/job-hunt",
    marginLeft: "60vw",
  },
} as const;

export default function JourneyFolderVertical({
  phase = 2,
  children,
  primaryColor = "var(--dark-blue)",
  current = false,
  closed = false,
  path,
  locked = false,
  currentPhase,
  naturalMaxReached,
}: {
  phase?: number;
  children?: React.ReactNode;
  primaryColor?: string;
  current?: boolean;
  closed?: boolean;
  path?: string;
  locked?: boolean;
  currentPhase?: number;
  naturalMaxReached?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const [canConfirmSkip, setCanConfirmSkip] = useState(false);
  const [isConfirmingSkip, setIsConfirmingSkip] = useState(false);

  const config = PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG];

  if (!config) {
    throw new Error(`Invalid phase: ${phase}`);
  }

  const { label, path: defaultPath, marginLeft } = config;
  const targetPath = path || defaultPath;
  const activeCurrentPhase = currentPhase ?? phase;
  const activeNaturalMaxReached = naturalMaxReached ?? activeCurrentPhase;

  const phaseColor = `var(--phase${phase}-color)`;

  const topLeft = phase === 1 ? "0" : "10";
  const topRight = phase === 5 ? "100" : "90";

  const clipPath = `
  polygon(
    0% 100%,
    ${topLeft} 0%,
    ${topRight} 0%,
    100% 100%
  )
`;

  const extractTrackIdFromPath = (candidatePath: string): string | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const absolute = new URL(candidatePath, window.location.origin);
      const trackId = absolute.searchParams.get("trackId") || "";
      return trackId.trim() || null;
    } catch {
      return null;
    }
  };

  const navigateToTarget = async () => {
    if (canConfirmSkip) {
      const trackId = extractTrackIdFromPath(targetPath);
      if (trackId) {
        await syncSelectedJourneyTrackProgress({
          trackId,
          userId: user?.id,
          maxReached: phase as 1 | 2 | 3 | 4 | 5,
        });
      }
    }

    router.push(targetPath);
  };

  const handleNavigation = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevents nested click conflicts
    if (locked) {
      return;
    }

    if (phase > activeCurrentPhase + 1) {
      setCanConfirmSkip(false);
      setSkipMessage("Please skip one phase at a time.");
      return;
    }

    if (phase > activeNaturalMaxReached) {
      setCanConfirmSkip(true);
      setSkipMessage("Do you want to skip this phase?");
      return;
    }

    setCanConfirmSkip(false);
    void navigateToTarget();
  };

  return (
    <div
    style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      >

      {/* Label */}
      <div
        onClick={handleNavigation}
        style={{
          height: "fit-content",
          width: "fit-content",
          display: "flex",
          cursor: locked ? "not-allowed" : "pointer",
        }}
      >
        <div
          style={{
            marginLeft,
            width: "fit-content",
            height: "fit-content",
            backgroundColor: current ? primaryColor : phaseColor,
            zIndex: 20,
            clipPath,
            borderTopLeftRadius: "5vh",
            borderTopRightRadius: "5vh",
            textAlign: "center",
            paddingBlock: "var(--space-xs)",
            paddingInline: "var(--space-2xl)",
            userSelect: "none",
            boxShadow: "-10px -1px 2px rgba(0, 0, 0, 0.3)",
            cursor: locked ? "not-allowed" : "pointer",
          }}
          >
          <h1
          style={{
            fontFamily: "var(--font-nova-square)",
            fontSize: "var(--text-base)",
            color: !current ? primaryColor : phaseColor,
            whiteSpace: "nowrap",
          }}
          >
            {locked ? `${label} (Locked)` : label}
          </h1>
        </div>
      </div>

      {/* Main panel */}
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: current ? primaryColor : phaseColor,
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          borderTopLeftRadius: phase === 1 ? "0" : "var(--radius-xl)",
          borderBottomLeftRadius: phase === 5 ? "0" : "var(--radius-xl)",
          paddingTop: "0.5rem",
          maxWidth: closed ? "12rem" : "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -10px 10px rgba(0, 0, 0, 0.66)",
          justifyContent: "center",
          zIndex: 0,
        }}
      >
        {children}
      </div>

      {skipMessage ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
          }}
          onClick={() => {
            if (!isConfirmingSkip) {
              setSkipMessage(null);
              setCanConfirmSkip(false);
            }
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(90vw, 24rem)",
              borderRadius: "var(--radius-xl)",
              backgroundColor: "var(--dark-blue)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              padding: "var(--space-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            <p style={{ margin: 0, fontFamily: "var(--font-jura)" }}>{skipMessage}</p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-sm)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSkipMessage(null);
                  setCanConfirmSkip(false);
                }}
                disabled={isConfirmingSkip}
                style={{
                  border: "1px solid rgba(255,255,255,0.32)",
                  background: "transparent",
                  color: "white",
                  borderRadius: "999px",
                  padding: "0.45rem 0.9rem",
                  cursor: isConfirmingSkip ? "not-allowed" : "pointer",
                  opacity: isConfirmingSkip ? 0.7 : 1,
                }}
              >
                {canConfirmSkip ? "No" : "OK"}
              </button>
              {canConfirmSkip ? (
                <button
                  type="button"
                  disabled={isConfirmingSkip}
                  onClick={() => {
                    setIsConfirmingSkip(true);
                    void navigateToTarget().finally(() => {
                      setIsConfirmingSkip(false);
                      setSkipMessage(null);
                      setCanConfirmSkip(false);
                    });
                  }}
                  style={{
                    border: "none",
                    background: "var(--light-green)",
                    color: "black",
                    borderRadius: "999px",
                    padding: "0.45rem 0.9rem",
                    cursor: isConfirmingSkip ? "not-allowed" : "pointer",
                    opacity: isConfirmingSkip ? 0.7 : 1,
                    fontWeight: 600,
                  }}
                >
                  Yes
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
