"use client";

import React from "react";
import JourneyFolder from "@/components/ui/journey-folder";
import { useRouter } from "next/navigation";

type JourneyTreeProps = {
  current: number;
  maxReached: number;
  resolvePhasePath?: (phase: number) => string;
  renderContent?: () => React.ReactNode;
};

function renderChain(
  phases: number[],
  current: number,
  maxReached: number,
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
            {renderChain(rest, current, maxReached, resolvePhasePath, renderContent)}
          </div>
        ) : (
          renderChain(rest, current, maxReached, resolvePhasePath, renderContent)
        ))}

    </JourneyFolder>
  );
}

export default function JourneyTree({
  current,
  maxReached,
  resolvePhasePath,
  renderContent,
}: JourneyTreeProps) {
  const phases = Array.from({ length: maxReached }, (_, i) => i + 1);
  const router = useRouter();

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
          onClick={() => router.push("/features/home")}
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
        {renderChain(phases, current, maxReached, resolvePhasePath, renderContent)}
      </div>
    </div>
  );
}
