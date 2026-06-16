"use client";

import type { CSSProperties, ReactNode } from "react";

interface InterviewContainerProps {
  questionTitle: string;
  videoContent: ReactNode;
  controlsContent?: ReactNode;
  actionButton?: ReactNode;
  style?: CSSProperties;
  videoBoxStyle?: CSSProperties;
}

export default function InterviewContainer({
  questionTitle,
  videoContent,
  controlsContent,
  actionButton,
  style,
  videoBoxStyle,
}: InterviewContainerProps) {
  return (
    <section
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-lg)",
      }}
    >
      

      <div
        style={{
          position: "relative",
          display: "flex",
          width: "var(--container-xm)",
          height: "var(--container-2xs)",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: "var(--radius-2xl)",
          backgroundColor: "var(--bg-grey)",
          ...videoBoxStyle,

        }}
      >
        {videoContent}
      </div>

      {controlsContent ? (
        <div
          style={{
            display: "flex",
            width: "100%",
            maxWidth: "34rem",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-lg)",
          }}
        >
          {controlsContent}
        </div>
      ) : null}

      {actionButton ? (
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "center",
          }}
        >
          {actionButton}
        </div>
      ) : null}
    </section>
  );
}