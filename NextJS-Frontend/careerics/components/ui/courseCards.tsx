"use client";

import type { CSSProperties } from "react";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";

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
  const backgroundColor = isCompleted
    ? "var(--dark-grey)"
    : isEnrolled
      ? "var(--light-green)"
      : "var(--light-blue)";
  const foregroundColor = isCompleted ? "var(--light-blue)" : "#0B0B0B";
  const dividerColor = isCompleted ? "rgba(193, 203, 230, 0.85)" : "rgba(11, 11, 11, 0.8)";
  const iconSrc = normalizeBackendAssetUrl(
    isCompleted ? "/courses/course-completed.svg" : "/courses/course-icon.svg",
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      style={{
        width: "var(--container-2xs)",
        height: "calc(var(--container-3xs) / 2)",
        backgroundColor,
        borderRadius: "calc(var(--radius-lg) * 2)",
        padding: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "var(--space-md)",
        position: "relative",
        textAlign: "left",
        border: "none",
        color: foregroundColor,
        cursor: onSelect ? "pointer" : "default",
        flexShrink: 0,
        ...style,
      }}
    >

      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "var(--icon-2xl)",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          width: "1.5px",
          backgroundColor: dividerColor,
          alignSelf: "stretch",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: "var(--space-md)",
          height: "100%"
        }}
      >
        <h4
          style={{
            color: foregroundColor,
            fontSize: "var(--text-sm)",
            fontWeight: "600",

            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",

            lineHeight: "1.4",
          }}
        >
          {title}
        </h4>

        <p
          style={{
            color: foregroundColor,
            fontSize: "var(--text-sm)",
            fontWeight: "500",
            opacity: isCompleted ? 0.92 : 1,
          }}
        >
          -by {provider}
        </p>
      </div>
    </button>
  );
};