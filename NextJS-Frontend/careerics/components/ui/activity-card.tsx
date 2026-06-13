import React from "react";

import { CircleScore } from "@/components/ui/circle-score";
import { useResponsive } from "@/hooks/useResponsive";

type Variant = "download" | "retake" | "progress";

type Props = {
  title: string;
  provider?: string;
  id?: string;
  date?: string;
  score?: number;
  skill?: string;
  variant: Variant;
  onClick?: () => void;
  style?: React.CSSProperties;
  theme?: "light" | "dark";
};

export const ActivityCard = ({
  title = "Unknown Title",
  provider = "unknown provider",
  id,
  skill = "unknown skill",
  date = "unknown date",
  score = 0,
  variant,
  onClick,
  style,
  theme = "light"
}: Props) => {
  const isDownload = variant === "download";
  const isRetake = variant === "retake";
  const isProgress = variant === "progress";

  const { isLarge, isMedium, isSmall } = useResponsive();

  return (
    <div
      style={{
        backgroundColor: theme == "light" ? "var(--light-blue)" : "var(--form-grey)",
        borderRadius: "var(--radius-lg)",
        paddingInline: "var(--space-sm)",
        paddingBlock: "var(--space-xs)",

        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",

        color: theme == "light" ? "black" : "white",
        fontFamily: "var(--font-nova-square)",

        width: "100%",
        gap: "var(--space-sm)",

        ...style,
      }}
    >
      {/* TEXT SECTION */}
      <div
        style={{
          flex: 1,
          minWidth: 0,

          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {/* TITLE */}
        <div
          title={title ?? id}
          style={{
            fontSize: "var(--text-sm)",

            overflow: "hidden",
            textOverflow: "ellipsis",

            whiteSpace: isSmall ? "nowrap" : "normal",

            display: "-webkit-box",
            WebkitBoxOrient: "vertical",

            ...(isSmall
              ? {
                WebkitLineClamp: 1,
              }
              : {
                WebkitLineClamp: 2,
              }),
          }}
        >
          {title ?? id}
        </div>

        {/* SUBTITLE */}
        <div
          style={{
            fontSize: "var(--text-xs)",

            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isProgress
            ? `on ${skill ?? "unknown skill"}`
            : isRetake
              ? `By ${provider ?? "unknown provider"}`
              : `Created on ${date}`}
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isProgress ? (
          <CircleScore score={score ?? 0} />
        ) : isDownload ? (
          <button
            type="button"
            onClick={onClick}
            style={{
              background: "none",
              border: "none",

              cursor: onClick ? "pointer" : "default",
              opacity: onClick ? 1 : 0.55,

              width: "var(--icon-sm)",
              height: "var(--icon-sm)",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              padding: 0,
              flexShrink: 0,
            }}
            disabled={!onClick}
            aria-label={`Download ${id}`}
          >
            <img
              src="/global/download.svg"
              alt=""
              style={{
                width: "100%",
                height: "100%",
                filter: "invert(1)",
                objectFit: "contain",
              }}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClick}
            style={{
              background: "none",
              border: "none",

              cursor: onClick ? "pointer" : "default",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              width: "var(--icon-sm)",
              height: "var(--icon-sm)",

              padding: 0,
              flexShrink: 0,
            }}
            disabled={!onClick}
            aria-label={`Retake ${title}`}
          >
            <img
              src="/interview/retake.svg"
              alt=""
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "brightness(1)",
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
};