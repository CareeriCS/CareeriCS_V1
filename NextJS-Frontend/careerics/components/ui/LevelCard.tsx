"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";

type LevelCardProps = {
  title?: string;
  iconSrc?: string;
  onClick?: () => void;
  style?: React.CSSProperties; // ✅ only this
};

const LevelCard: React.FC<LevelCardProps> = ({
  title = "Check Your Level",
  iconSrc = "/job/check.svg",
  onClick,
  style,
}) => {
  const displayIconSrc = normalizeBackendAssetUrl(iconSrc);

  return (
    <div
      style={{
        backgroundColor: "var(--dark-blue)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-xl)",
        height: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-md)",
        flexDirection: "column",

        ...style,
      }}
    >
      {/* Top Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <img
          src={displayIconSrc}
          alt="Level Icon"
          style={{ width: "var(--icon-xl)",}}
        />

        <div
          style={{
            width: "2px",
            height: "100%",
            backgroundColor: "#fff",
            flexShrink: 0,
          }}
        />

        <h3
          style={{
            color: "white",
            margin: 0,
            fontFamily: "Nova Square",
            fontWeight: "400",
            fontSize: "var(--text-md)",
            lineHeight: "1.5",
            maxWidth: "min-content",
            textTransform: "capitalize",
          }}
        >
          {title}
        </h3>
      </div>

      {/* Button */}
      <Button
        variant="primary-inverted"
        style={{
          width: "100%",
          whiteSpace: "nowrap",
        }}
        onClick={onClick}
      >
        Start Test
      </Button>
    </div>
  );
};

export default LevelCard;