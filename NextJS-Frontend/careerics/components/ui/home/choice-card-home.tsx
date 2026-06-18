"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import React, { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";
import { useResponsive } from "@/hooks/useResponsive";

interface ChoiceCardProps {
  icon?: string;
  image?: string;
  title?: string;
  description?: string;
  route?: string;
  style?: CSSProperties;
  children?: ReactNode;
  isWideCard?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  buttonLabel?: string;
  buttonVariant?: "primary" | "secondary" | "primary-inverted";
  isSelected?: boolean;
  blogPath?: string;
  type?: string;
  onAction?: () => void;
  onRemove?: () => void;
}

export default function ChoiceCard({
  icon,
  image,
  title,
  description,
  style,
  onClick,
  disabled = false,
  buttonLabel = "Start",
  isSelected,
  blogPath,
  type,
  onAction,
  onRemove,
}: ChoiceCardProps) {
  const router = useRouter();
  const [isRemoveHovered, setIsRemoveHovered] = React.useState(false);
  const [isRemoveFocused, setIsRemoveFocused] = React.useState(false);
  const displayImage = normalizeBackendAssetUrl(image || icon || "");


  const isBookmark = type === "bookmark";
  const effectiveSelected = isSelected || isBookmark;
  const {isMedium, isLarge} = useResponsive();

  return (
    <div
      style={{
        backgroundColor: effectiveSelected ? "var(--dark-blue)" : "#C1CBE6",
        fontWeight: effectiveSelected ? "normal" : "bold",
        color: effectiveSelected ? "white" : "black",
        fontFamily: "var(--font-nova-square)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-md)",
        gap: "var(--space-md)",
        ...style
      }}
    >
      {/* See stats and remove */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          height: "fit-content",
          marginLeft: "auto",
        }}
      >
        {!isBookmark && (
          <div
            style={{
              fontSize: "var(--text-sm)",
              position: "relative",
              color: effectiveSelected ? "var(--light-green)" : "black",
              cursor: effectiveSelected ? "default" : "pointer",
              fontFamily: "var(--font-nova-square)",
              height: "fit-content",
            }}
            onClick={onClick}
          >
            {effectiveSelected ? "selected" : "See stats"}
          </div>
        )}

        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${title || "career"}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            onMouseEnter={() => setIsRemoveHovered(true)}
            onMouseLeave={() => setIsRemoveHovered(false)}
            onFocus={() => setIsRemoveFocused(true)}
            onBlur={() => setIsRemoveFocused(false)}
            style={{
              width: "var(--icon-sm)",
              height: "var(--icon-sm)",
              borderRadius: "999px",
              border: "none",
              backgroundColor:
                isRemoveHovered || isRemoveFocused
                  ? effectiveSelected
                    ? "rgba(230, 255, 178, 0.18)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
              color: effectiveSelected ? "var(--light-green)" : "black",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              outline: "none",
              boxShadow: isRemoveFocused
                ? `0 0 0 2px ${effectiveSelected ? "rgba(230, 255, 178, 0.55)" : "rgba(0, 0, 0, 0.16)"}`
                : "none",
              transition: "background-color 0.18s ease, box-shadow 0.18s ease",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <X />
          </button>

        ) : null}

      </div>

      {/* img */}
      {( !isBookmark&& !isMedium) &&
        <img
          src={displayImage}
          alt={title || "career icon"}
          style={{
            width: "var(--icon-xl)",
            height: "auto",
            display: "block",
            marginRight: "auto",
            filter: effectiveSelected ? "none" : "invert(1)",
          }}
        />
      }

      {/* Title */}
      <p
        style={{
          fontSize: "var(--text-base)",
          textAlign: "left",
          marginRight: "auto",
        }}
      >
        {title}
      </p>

      {/* description */}
      <p
        style={{
          fontSize: "var(--text-sm)",
          textAlign: "left",
          marginRight: "auto",
        }}
      >
        {description}
      </p>

      {/* Continue button */}
      <Button
        type="button"
        variant={isSelected ? "primary-inverted" : "popup-inverted"}
        onClick={() => {
          if (disabled) {
            return;
          }

          if (onAction) {
            onAction();
            return;
          }

          router.push(blogPath || "/");
        }}
        disabled={disabled}
        style={{
          width: "100%",
          marginTop: "auto",
        }}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
