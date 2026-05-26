"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import React, { CSSProperties, ReactNode } from "react";
import Image from "next/image";
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
  disabled?: boolean;
  buttonLabel?: string;
  buttonVariant?: "primary" | "secondary" | "primary-inverted";
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
  disabled = false,
  buttonLabel = "Start",
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
        width: "100%",
        height: "100%",
        backgroundColor: "var(--dark-blue)",
        borderRadius: "var(--radius-xl)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent:"space-between",
        padding:"var(--space-xl)",
        overflow: "hidden",
        ...style
      }}
    >
      <div
        style={{
          display: "flex",
          width:"fit-content",
          alignItems: "center",
          justifyContent:"space-around",
          gap: "var(--space-xl)"
        }}
      >
        
          <img
            src={displayImage}
            alt={title || "career icon"}
            style={{
              height: "var(--icon-4xl)",
            }}
          />

        <div
          style={{
            height: "100%",
            backgroundColor: "white",
            width: "0.2rem",
            flexShrink: 0,
            flexGrow: 0,
            borderRadius: "999px",
          }}
        />

        <p
          style={{
            color: "white",
            fontSize: "var(--text-md)",
            fontFamily: "var(--font-nova-square)",
            width: "min-content",
          }}
        >
          {title}
        </p>
      </div>

      <p
        style={{
          color: "white",
          textAlign: "center",
          fontSize: "var(--text-base)",
        }}
      >
        {description}
      </p>

      <Button
        type="button"
        variant={buttonVariant}
        onClick={handleButtonClick}
        disabled={disabled}
        style={{
          alignSelf: "stretch",
        }}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
