"use client";

import type { CSSProperties } from "react";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";

export type CourseCardProps = {
  title: string;
  provider: string;
  status?: "default" | "enrolled" | "completed";
  onSelect?: () => void;
  style?: CSSProperties;
};

export const CourseCard = ({
  title,
  provider,
  status = "default",
  onSelect,
  style,
}: CourseCardProps) => {
  const isEnrolled = status === "enrolled";
  const isCompleted = status === "completed";
  const iconSrc = normalizeBackendAssetUrl(
    isCompleted ? "/courses/course-completed.svg" : "/courses/course-icon.svg",
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      style={style}
      className={cn(
        "relative flex w-full min-h-[5.5rem] min-w-0 items-center justify-start gap-[var(--space-md)] rounded-[var(--radius-xl)] p-[var(--space-lg)] text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-color)]",
        isCompleted
          ? "bg-[var(--dark-grey)] text-[var(--light-blue)]"
          : isEnrolled
            ? "bg-[var(--light-green)] text-[var(--text-inverted)]"
            : "bg-[var(--light-blue)] text-[var(--text-inverted)]",
        onSelect ? "cursor-pointer" : "cursor-default",
      )}
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        className="h-[var(--icon-2xl)] w-[var(--icon-2xl)] shrink-0 object-contain"
      />

      <div
        className={cn(
          "w-px shrink-0 self-stretch",
          isCompleted ? "bg-[rgba(193,203,230,0.85)]" : "bg-[rgba(11,11,11,0.8)]",
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--space-xs)]">
        <h4 className="m-0 line-clamp-3 break-words text-[length:var(--text-sm)] font-medium leading-[var(--line-normal)]">
          {title}
        </h4>

        <p
          className={cn(
            "m-0 break-words text-[length:var(--text-sm)] font-normal leading-[var(--line-normal)]",
            isCompleted ? "opacity-90" : "",
          )}
        >
          -by {provider}
        </p>
      </div>
    </button>
  );
};
