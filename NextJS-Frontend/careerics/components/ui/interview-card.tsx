"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

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
      className="flex w-full max-w-[min(100%,56rem)] flex-col items-center gap-[var(--space-xl)]"
      style={style}
    >
      {questionTitle ? (
        <h2
          className="m-0 max-w-[52rem] text-center text-[length:var(--text-lg)] font-semibold leading-[var(--line-normal)] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
        >
          {questionTitle}
        </h2>
      ) : null}

      <div
        className={cn(
          "relative flex aspect-video w-full max-w-[min(100%,44rem)] items-center justify-center overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--bg-grey)]",
          "min-h-[14rem] max-h-[min(56vh,32rem)]"
        )}
        style={videoBoxStyle}
      >
        {videoContent}
      </div>

      {controlsContent ? (
        <div className="flex w-full max-w-[34rem] flex-wrap items-center justify-center gap-[var(--space-lg)]">
          {controlsContent}
        </div>
      ) : null}

      {actionButton ? (
        <div className="flex w-full justify-center px-[var(--space-sm)]">
          {actionButton}
        </div>
      ) : null}
    </section>
  );
}