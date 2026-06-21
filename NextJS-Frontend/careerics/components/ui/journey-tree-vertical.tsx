"use client";

import React from "react";
import JourneyFolderVertical from "@/components/ui/journey-folder-vertical";
import { useRouter } from "next/navigation";

type JourneyTreeVerticalProps = {
  current: number;
  maxReached: number;
  naturalMaxReached?: number;
  resolvePhasePath?: (phase: number) => string;
  renderContent?: () => React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
};

function renderChain(
  phases: number[],
  current: number,
  maxReached: number,
  naturalMaxReached: number,
  resolvePhasePath?: (phase: number) => string,
  renderContent?: () => React.ReactNode
): React.ReactNode {
  if (phases.length === 0) return null;

  const [first, ...rest] = phases;

  const isCurrent = first === current;
  const isAheadOfMax = current < maxReached;
  const isLocked = first > maxReached;
  const targetPath = resolvePhasePath?.(first);

  return (
    <JourneyFolderVertical
      phase={first}
      current={isCurrent}
      locked={isLocked}
      path={targetPath}
      currentPhase={current}
      naturalMaxReached={naturalMaxReached}
    >
      {isCurrent && (
        <div
          style={{
            width: "100%",
            minHeight: 0,
            flex: 1,
          }}
        >
          {renderContent?.()}
        </div>
      )}

      {rest.length > 0 &&
        (isCurrent ? (
          <div
            style={{
              width: "100%",
              height: isAheadOfMax
                ? "5vh"
                : "100%",
              display: "flex",
              flexShrink: 0,
              flexDirection: "column",
            }}
          >
            {renderChain(
              rest,
              current,
              maxReached,
              naturalMaxReached,
              resolvePhasePath,
              renderContent
            )}
          </div>
        ) : (
          renderChain(
            rest,
            current,
            maxReached,
            naturalMaxReached,
            resolvePhasePath,
            renderContent
          )
        ))}
    </JourneyFolderVertical>
  );
}

export default function JourneyTreeVertical({
  current,
  maxReached,
  naturalMaxReached,
  resolvePhasePath,
  renderContent,
  closeHref = "/features/home",
  onClose,
}: JourneyTreeVerticalProps) {
  const router = useRouter();
  const effectiveNaturalMaxReached = naturalMaxReached ?? maxReached;

  // ONLY: previous + current + all next
  const phases: number[] = [];

  if (current - 1 >= 1) {
    phases.push(current - 1);
  }

  phases.push(current);

  if (current + 1 <= maxReached) {
    phases.push(current + 1);
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-md)",
        overflow: "hidden",
        boxSizing: "border-box",
        gap: "var(--space-md)",
        maxHeight: "100%",
      }}
      >

      <img
        src={"/global/close.svg"}
        alt="Close journey"
        onClick={() => {
          if (onClose) {
            onClose();
            return;
          }
          router.push(closeHref);
        }}
        style={{
          position: "absolute",
          width: "var(--icon-lg)",
          cursor: "pointer",
          top: "var(--space-md)",
          right: "var(--space-md)",
        }}
      />
      
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
        {renderChain(
          phases,
          current,
          maxReached,
          effectiveNaturalMaxReached,
          resolvePhasePath,
          renderContent
        )}
      </div>
      
    </div>
  );
}