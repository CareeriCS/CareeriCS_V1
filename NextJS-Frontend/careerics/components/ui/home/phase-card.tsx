"use client";
import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useResponsive } from "@/hooks/useResponsive";



type BaseProps = {
  style?: React.CSSProperties;
  phaseNumber: string;
  isLoading?: boolean;
};

type PhaseCardProps =
  | {
    type: "current";
  } & BaseProps
  | {
    type: "next";
    desc: string;
  } & BaseProps;

export const PhaseCard = (props: PhaseCardProps) => {
  const baseStyle: React.CSSProperties = {
    backgroundColor: "var(--dark-blue)",
    borderRadius: "var(--radius-lg)",
    color: "white",
  };
  const { isLarge, isMedium, isSmall, width } = useResponsive();

  // --- CURRENT PHASE ---
  if (props.type === "current") {
    const { style, phaseNumber, isLoading } = props;

    return (
      <div
        style={{
          ...baseStyle,
          paddingTop: isLarge ? "var(--space-md)" : "var(--space-lg)",
          gap: isLarge ? "var(--space-md)" : "var(--space-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          ...style,
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-md)",
            fontFamily: "var(--font-nova-square)",
          }}
        >
          {!isSmall ? "Current Phase" : "Next Phase"}
        </h3>


        <div
          style={{
            width: "100%",
            height: "100%",
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={`/home/next-phase/${phaseNumber}.svg`}
            alt="Current Phase"
            style={{
              width: "100%",
              objectFit: "fill",
              display: "block",
            }}
          />
        </div>
      </div>
    );
  }



  // --- NEXT PHASE ---
  const { style, phaseNumber, desc, isLoading } = props;

  return (
    <div
      style={{
        ...baseStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "stretch",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* LEFT SIDE */}
      <div
        style={{
          padding: "var(--space-md)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          gap: "var(--space-md)",
          flex: 1,
          minWidth: 0,
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-md)",
            fontFamily: "var(--font-nova-square)",
          }}
        >
          Next Phase
        </h3>

        <p
          style={{
            fontSize: "var(--text-base)",
            opacity: 0.7,
            margin: 0,
          }}
        >
          {desc}
        </p>
      </div>

      {/* RIGHT SIDE IMAGE */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems:
            phaseNumber === "2" || phaseNumber === "5"
              ? "flex-end"
              : phaseNumber === "4"
                ? "flex-start"
                : "center",
          overflow: "hidden",
          minWidth: 0,
          borderLeft: "1px solid white"
        }}
      >
        <img
          src={`/home/next-phase/${phaseNumber}.svg`}
          alt="Next Phase"
          style={{
            width: "100%",
            height: "auto",
            objectFit: "fill",
          }}
        />
      </div>
    </div>
  );
}