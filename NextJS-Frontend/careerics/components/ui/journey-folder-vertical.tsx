"use client";

import React from "react";
import { useRouter } from "next/navigation";

const PHASE_CONFIG = {
  1: {
    label: "The Crosspaths",
    path: "/journey/the-crosspaths",
    marginLeft: "0",
  },
  2: {
    label: "Pave The Way",
    path: "/journey/pave-the-way",
    marginLeft: "15vw",
  },
  3: {
    label: "Document It",
    path: "/journey/document-it",
    marginLeft: "30vw",
  },
  4: {
    label: "Trial Round",
    path: "/journey/trial-round",
    marginLeft: "45vw",
  },
  5: {
    label: "Job Hunt",
    path: "/journey/job-hunt",
    marginLeft: "60vw",
  },
} as const;

export default function JourneyFolderVertical({
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

  const { label, path: defaultPath, marginLeft } = config;
  const targetPath = path || defaultPath;

  const phaseColor = `var(--phase${phase}-color)`;

  const topLeft = phase === 1 ? "0" : "10";
  const topRight = phase === 5 ? "100" : "90";

  const clipPath = `
  polygon(
    0% 100%,
    ${topLeft} 0%,
    ${topRight} 0%,
    100% 100%
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
        flexDirection: "column",
      }}
      >

      {/* Label */}
      <div
        onClick={handleNavigation}
        style={{
          height: "fit-content",
          width: "fit-content",
          display: "flex",
          cursor: locked ? "not-allowed" : "pointer",
        }}
      >
        <div
          style={{
            marginLeft,
            width: "fit-content",
            height: "fit-content",
            backgroundColor: current ? primaryColor : phaseColor,
            zIndex: 20,
            clipPath,
            borderTopLeftRadius: "5vh",
            borderTopRightRadius: "5vh",
            textAlign: "center",
            paddingBlock: "var(--space-xs)",
            paddingInline: "var(--space-2xl)",
            userSelect: "none",
            boxShadow: "-10px -1px 2px rgba(0, 0, 0, 0.3)",
            cursor: locked ? "not-allowed" : "pointer",
          }}
          >
          <h1
          style={{
            fontFamily: "var(--font-nova-square)",
            fontSize: "var(--text-base)",
            color: !current ? primaryColor : phaseColor,
            whiteSpace: "nowrap",
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
          paddingTop: "0.5rem",
          maxWidth: closed ? "12rem" : "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -10px 10px rgba(0, 0, 0, 0.66)",
          justifyContent: "center",
          zIndex: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
