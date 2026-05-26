"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useResponsive } from "@/hooks/useResponsive";

type FolderProps = {
  children?: ReactNode;
};

const Folder = ({ children }: FolderProps) => {
  const pathname = usePathname();

  const { isLarge, isMedium, isSmall } = useResponsive();

  const pageConfig: Record<
    string,
    { title: string; subtitle: string; tabwidth: string }
  > = {
    "/features/home": {
      title: "Careeri's Journey",
      subtitle: "Welcome to CareeriCS",
      tabwidth: "27%",
    },
    "/features/career": {
      title: "Career Exploration",
      subtitle: "Find your path",
      tabwidth: "28%",
    },
    "/features/courses": {
      title: "Courses Hub",
      subtitle: "Expand your knowledge",
      tabwidth: "22%",
    },
    "/features/roadmap": {
      title: "Roadmaps",
      subtitle: "Discover where you stand",
      tabwidth: "19%",
    },
    "/features/skill": {
      title: "Skill Assessment",
      subtitle: "Discover where you stand",
      tabwidth: "26.5%",
    },
    "/features/cv": {
      title: "CV Crafting",
      subtitle: "Turn experience into impact",
      tabwidth: "20%",
    },
    "/features/interview": {
      title: "Interview Preparation",
      subtitle: "Practice makes perfect",
      tabwidth: "31%",
    },
    "/features/job": {
      title: "Job Search",
      subtitle: "Your next opportunity is waiting",
      tabwidth: "20%",
    },
  };

  const current =
    pageConfig[pathname] || {
      title: "CareeriCS",
      subtitle: "Loading...",
    };



  return (
    <div
      id="page-wrapper"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
        gap: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "fit-content",
          backgroundColor: "var(--bg-color)",
        }}
      >
        
        <div
          style={{
            height: "fit-content",
            width: "fit-content",
            display: "grid",
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr",
            alignItems: "end",
          }}
        >
          <div
            style={{
              height: "fit-content",
              width: "fit-content",
              backgroundColor: "var(--bg-grey)",
              borderTopRightRadius: "var(--radius-2xl)",
              borderTopLeftRadius: "var(--radius-2xl)",
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              paddingRight: "calc(var(--space-xl) * 2)",
              paddingLeft: isSmall?"calc((var(--space-xl) * 2) + var(--icon-lg))":"calc(var(--space-xl) * 2)",
              paddingBlock: "var(--space-xs)",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-jura)",
              fontWeight: "800",
              fontSize: "var(--text-lg)",
              gridArea: "1 / 1 / 2 / 2",
              zIndex: 2,
            }}
          >
            {current.title}
          </div>
          {!isSmall &&
          <div
          style={{
              height: "90%",
              borderTopLeftRadius: "var(--radius-2xl)",
              width: "100%",
              gridArea: "1 / 1 / 2 / 2",
              backgroundColor: "var(--medium-grey)",
              zIndex: 1,
              boxShadow: "inset 0 -12px 16px -10px rgba(0, 0, 0, 0.5)",
            }}
            />
          }
        </div>

        
        <div
        style={{
          height: "100%",
          minWidth: 0,
          flex:1,
            backgroundColor: "var(--bg-grey)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              backgroundColor: "var(--bg-color)",
              borderBottomLeftRadius: isLarge?"var(--radius-2xl)":"var(--radius-xl)",
              display: "flex",
              alignItems: "flex-end",
              overflow: "clip",
            }}
          >
            {!isSmall && (
              <div
                style={{
                  height: "90%",
                  width: "100%",
                  backgroundColor: "var(--medium-grey)",
                  
                  borderTopRightRadius: "var(--radius-xl)",
                  borderBottomRightRadius: 0,
                  borderTopLeftRadius: 0,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-nova-square)",
                  fontSize: "var(--text-lg)",
                  boxShadow: "inset 0 -12px 16px -10px rgba(0, 0, 0, 0.5)",

                }}
              >
                {current.subtitle}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        id="folder-body"
        style={{
          zIndex: 2,
          backgroundColor: "var(--medium-grey)",
          borderTopLeftRadius:  0,
          borderTopRightRadius: isSmall ? "var(--radius-xl)" : 0,
          borderBottomLeftRadius: "var(--radius-xl)",
          borderBottomRightRadius: "var(--radius-xl)",
          overflow: "hidden",
          width: "100%",
          height: "100%",
          boxShadow: "inset 0 12px 16px -10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          id="folder-body"
          style={{
            zIndex: 2,
            backgroundColor: "var(--bg-grey)",
            borderTopLeftRadius:  0,
            borderTopRightRadius: "var(--radius-xl)",
            borderBottomLeftRadius: "var(--radius-xl)",
            borderBottomRightRadius: "var(--radius-xl)",
            overflow: "hidden",
            width: "100%",
            height: "100%",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Folder;