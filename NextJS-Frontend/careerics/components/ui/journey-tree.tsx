"use client";

import React from "react";
import JourneyFolder from "@/components/ui/journey-folder";
import { useRouter } from "next/navigation";

type JourneyTreeProps = {
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
    <JourneyFolder
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
            height: "100%",
          }}
        >
          {renderContent?.()}
        </div>
      )}
      {rest.length > 0 &&
        (isCurrent ? (
          <div
            style={{
              width: isAheadOfMax ? `calc(3.25rem * ${maxReached - current})` : "100%",
              display: "flex",
              flexShrink: 0,
            }}
          >
            {renderChain(
              rest,
              current,
              maxReached,
              naturalMaxReached,
              resolvePhasePath,
              renderContent,
            )}
          </div>
        ) : (
          renderChain(rest, current, maxReached, naturalMaxReached, resolvePhasePath, renderContent)
        ))}

    </JourneyFolder>
  );
}

export default function JourneyTree({
  current,
  maxReached,
  naturalMaxReached,
  resolvePhasePath,
  renderContent,
  closeHref = "/features/home",
  onClose,
}: JourneyTreeProps) {
  const phases = Array.from({ length: maxReached }, (_, i) => i + 1);
  const router = useRouter();
  const effectiveNaturalMaxReached = naturalMaxReached ?? maxReached;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        paddingInline: "40px",
        paddingBlock: "20px",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom:"10px",
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
            width: "1.5rem",
            height: "1.5rem",
            cursor: "pointer",
          }}
        />
      </div>
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
          renderContent,
        )}
      </div>
    </div>
  );
}
