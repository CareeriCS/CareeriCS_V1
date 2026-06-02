"use client";

import React from "react";
import { useRouter } from "next/navigation";

const PHASE_CONFIG = {
  1: {
    label: "The Crosspaths",
    path: "/journey/the-crosspaths",
    marginTop: "0",
  },
  2: {
    label: "Pave The Way",
    path: "/journey/pave-the-way",
    marginTop: "8rem",
  },
  3: {
    label: "Document It",
    path: "/journey/document-it",
    marginTop: "16rem",
  },
  4: {
    label: "Trial Round",
    path: "/journey/trial-round",
    marginTop: "20rem",
  },
  5: {
    label: "Job Hunt",
    path: "/journey/job-hunt",
    marginTop: "auto",
  },
} as const;

export default function JourneyFolder({
  phase = 2,
  children,
  primaryColor = "var(--dark-blue)",
  current = false,
  closed = false,
  path,
  locked = false,
}: {
  phase?: number;
  children?: React.ReactNode;
  primaryColor?: string;
  current?: boolean;
  closed?: boolean;
  path?: string;
  locked?: boolean;
}) {
  const router = useRouter();

  const config = PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG];

  if (!config) {
    throw new Error(`Invalid phase: ${phase}`);
  }

  const { label, path: defaultPath, marginTop } = config;
  const targetPath = path || defaultPath;

  const phaseColor = `var(--phase${phase}-color)`;

  const topRight = phase === 1 ? "0" : "10";
  const bottomRight = phase === 5 ? "100" : "90";

  const clipPath = `
  polygon(
    0% ${topRight}%,
    100% 0%,
    100% 100%,
    0% ${bottomRight}%
  )
`;

  const handleNavigation = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevents nested click conflicts
    if (locked) {
      return;
    }
    router.push(targetPath);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >

      {/* Label */}
      <div
        onClick={handleNavigation}
        style={{
          height: "100%",
          display: "flex",
          cursor: locked ? "not-allowed" : "pointer",
        }}
      >
        <div
          style={{
            marginTop,
            width: "fit-content",
            height: "fit-content",
            backgroundColor: current ? primaryColor : phaseColor,
            clipPath,
            borderTopLeftRadius: "5vh",
            borderBottomLeftRadius: "5vh",
            textAlign: "center",
            paddingBlock: "var(--space-xs)",
            paddingInline: "var(--space-2xl)",
            userSelect: "none",
            writingMode: "vertical-rl",
            cursor: locked ? "not-allowed" : "pointer",
          }}
          >
          <h1
          style={{
            fontFamily: "var(--font-nova-square)",
            fontSize: "var(--text-base)",
            color: !current ? primaryColor : phaseColor,
            whiteSpace: "nowrap",
            transform: "rotate(180deg)",
          }}
          >
            {locked ? `${label} (Locked)` : label}
          </h1>
        </div>
      </div>

      {/* Main panel */}
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: current ? primaryColor : phaseColor,
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          borderTopLeftRadius: phase === 1 ? "0" : "var(--radius-xl)",
          borderBottomLeftRadius: phase === 5 ? "0" : "var(--radius-xl)",
          paddingLeft: "0.5rem",
          boxShadow: "-10px 0 15px rgba(0, 0, 0, 0.66)",
          maxWidth: closed ? "12rem" : "100%",
          display: "flex",
        }}
      >
        {children}
      </div>
    </div>
  );
}
