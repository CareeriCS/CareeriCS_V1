import React from "react";
import { useResponsive } from "@/hooks/useResponsive";

interface JourneyProgressCardProps {
  percentage?: number;
  isLoading?: boolean;
  style?: React.CSSProperties;
}

export const JourneyProgressCard = ({
  percentage = 10,
  style,
}: JourneyProgressCardProps) => {

  const { isLarge } = useResponsive();

  return (
    <div
      style={{
        backgroundColor: "var(--dark-blue)",
        color: "white",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        gap: "var(--space-md)",
        ...style,
      }}
    >
      <h3
        style={{
          fontSize: "var(--text-md)",
          fontFamily: "var(--font-nova-square)",
        }}
      >
        Journey Progress
      </h3>

      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <img
          src={`/home/journey-progress/${percentage}.svg`}
          alt="Progress"
          style={{
            maxWidth: isLarge?"100%":"90%",
            maxHeight: isLarge?"100%":"90%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
