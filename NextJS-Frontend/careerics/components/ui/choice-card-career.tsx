"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import React, { CSSProperties, ReactNode } from "react";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";

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
  onBookmark?: () => void;
  disabled?: boolean;
  buttonLabel?: string;
  buttonVariant?: "primary" | "secondary" | "primary-inverted" | "popup-inverted";
  isBookmarked?: boolean;
}

export default function ChoiceCard({
  icon,
  image,
  title,
  description,
  route,
  style,
  buttonVariant,
  onClick,
  onBookmark,
  disabled = false,
  buttonLabel = "Learn More",
  isBookmarked = false,
}: ChoiceCardProps) {
  const router = useRouter();
  const displayImage = normalizeBackendAssetUrl(image || icon || "");

  const handleButtonClick = () => {
    if (onClick) {
      onClick();
    } else if (route) {
      router.push(route);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: "var(--dark-blue)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "var(--space-md)",
        gap: "var(--space-md)",
        width: "100%",
        height: "100%",
        maxHeight:"40vh",
        ...style
      }}
    >
      <div style={{width:"100%"}}>
      <img
        src={isBookmarked ? "/global/bookmark-filled.svg" : "/global/bookmark.svg"}
        alt={"bookmark"}
        onClick={onBookmark}
        style={{
          width: "var(--icon-sm)",
          height: "auto",
          display: "block",
          cursor:"pointer",
          marginLeft:"auto",
        }}
      />
      {/* 1. Icon Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        <img
          src={displayImage}
          alt={title || "career icon"}
          style={{
            width: "var(--icon-xl)",
            height: "auto",
            display: "block",
          }}
        />
      </div>
      </div>

      {/* 2. Title Section */}
      <h3
        style={{
          fontSize: "var(--text-base)",
          textAlign: "left",
          marginRight: "auto",
        }}
      >
        {title}
      </h3>

      {/* 3. Description Section */}
      <p
        style={{
          fontSize: "var(--text-sm)",
          textAlign: "left",
          marginRight: "auto",
          overflow:"hidden",
          textOverflow:"ellipsis",
        }}
      >
        {description}
      </p>

      {/* 4. Button Section */}
      <Button
        type="button"
        variant={buttonVariant}
        onClick={handleButtonClick}
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