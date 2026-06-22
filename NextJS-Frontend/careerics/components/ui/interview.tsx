"use client";

import React, { useState, type ReactNode } from "react";
import { useResponsive } from "@/hooks/useResponsive";

interface Question {
  id: number;
  title: string;
  text: string;
}

interface SidebarLogicProps {
  questions: Question[];
  currentActiveId: number;
  unlockedStepId?: number;
  onQuestionClick: (id: number) => void;
  label?: string;
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
}

export default function SidebarLogicOnly({
  questions,
  currentActiveId,
  unlockedStepId,
  onQuestionClick,
  label = "Question",
  title = "Skill Assessment",
  children,
  onClose,
}: SidebarLogicProps) {
  // Using your custom responsive hook
  const { isLarge, isMedium, isSmall } = useResponsive();

  // State to emulate :hover interactions dynamically
  const [hoveredButtonId, setHoveredButtonId] = useState<number | null>(null);

  return (
    <div
      style={{
        display: "grid",
        height: "100%",
        minHeight: 0,
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        backgroundColor: "transparent",
        gridTemplateRows: isLarge ? "1fr" : "auto minmax(0, 1fr)",
        gridTemplateColumns: isLarge ? "minmax(17rem, 20rem) minmax(0, 1fr)" : "none",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          minHeight: 0,
          maxHeight: isLarge ? "none" : "7.5rem",
          height: isLarge ? "100%" : "auto",
          width: "100%",
          minWidth: 0,
          flexShrink: 0,
          borderBottom: isLarge ? "0" : "1px solid var(--border-subtle)",
          borderRight: isLarge ? "1px solid var(--border-subtle)" : "0",
          backgroundColor: "var(--bg-grey)",
          padding: isLarge ? "var(--space-xl)" : "var(--space-md)",
          color: "var(--dark-blue)",
        }}
      >
        <div
          style={{
            display: "flex",
            height: "100%",
            minHeight: 0,
            flexDirection: "column",
            gap: isLarge ? "var(--space-lg)" : "var(--space-sm)",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-nova-square)",
              fontSize: "var(--text-lg)",
              color: "black",
              margin: 0,
            }}
          >
            {title}
          </h1>

          <div
            style={{
              height: "1px",
              flexShrink: 0,
              backgroundColor: "rgba(var(--dark-blue-rgb, 0, 0, 0), 0.35)",
            }}
          />

          <nav
            aria-label={`${title} navigation`}
            style={{
              display: "flex",
              minHeight: 0,
              minWidth: 0,
              flex: 1,
              gap: "var(--space-sm)",
              overflowX: isLarge ? "hidden" : "auto",
              overflowY: isLarge ? "auto" : "hidden",
              marginLeft: isLarge ? 0 : "-var(--space-xs)",
              marginRight: isLarge ? 0 : "-var(--space-xs)",
              paddingLeft: isLarge ? 0 : "var(--space-xs)",
              paddingRight: isLarge ? 0 : "var(--space-xs)",
              paddingBottom: isLarge ? 0 : "var(--space-xxs)",
              flexDirection: isLarge ? "column" : "row",
              scrollbarWidth: "none",
            }}
          >
            {questions.map((question) => {
              const isSelected = currentActiveId === question.id;
              const isLocked = unlockedStepId !== undefined ? question.id > unlockedStepId : false;
              const normalizedTitle = question.title?.trim() || "";
              const defaultTitle = label ? `${label} ${question.id}` : normalizedTitle || `Item ${question.id}`;
              const shouldShowTitle =
                Boolean(label) &&
                normalizedTitle.length > 0 &&
                normalizedTitle.toLowerCase() !== defaultTitle.toLowerCase();
              const normalizedText = question.text?.trim() || "";
              const isHovered = hoveredButtonId === question.id;

              return (
                <button
                  key={question.id}
                  type="button"
                  disabled={isLocked}
                  aria-current={isSelected ? "step" : undefined}
                  aria-label={`${defaultTitle}${shouldShowTitle ? `: ${normalizedTitle}` : ""}${isLocked ? " locked" : ""}`}
                  onClick={() => {
                    if (!isLocked) {
                      onQuestionClick(question.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredButtonId(question.id)}
                  onMouseLeave={() => setHoveredButtonId(null)}
                  style={{
                    flexShrink: 0,
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid transparent",
                    paddingLeft: "var(--space-md)",
                    paddingRight: "var(--space-md)",
                    paddingTop: isLarge ? "var(--space-md)" : "var(--space-sm)",
                    paddingBottom: isLarge ? "var(--space-md)" : "var(--space-sm)",
                    textAlign: "left",
                    transition: "background-color 0.2s, color 0.2s",
                    outline: "none",
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.45 : 1,
                    minWidth: isLarge ? "0" : "7rem",
                    fontFamily: "var(--font-nova-square), sans-serif",
                    backgroundColor: isSelected
                      ? "var(--primary-green)"
                      : isHovered
                        ? "rgba(10,10,10,0.1)"
                        : "rgba(10,10,10,0.06)",
                    color: "var(--dark-blue)",
                    boxShadow: isSelected ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--text-base)",
                      color: "var(--dark-blue)",
                    }}
                  >
                    {defaultTitle}
                  </span>

                  {shouldShowTitle && isLarge ? (
                    <span
                      style={{
                        marginTop: "var(--space-xxs)",
                        display: "block",
                        fontWeight: 600,
                        lineHeight: "var(--line-normal)",
                        opacity: 0.9,
                        fontSize: "var(--text-xs)",
                        whiteSpace: "normal",
                        overflow: "visible",
                        textOverflow: "clip",
                      }}
                    >
                      {normalizedTitle}
                    </span>
                  ) : shouldShowTitle ? (
                    <span style={{ display: "none" }}>{normalizedTitle}</span>
                  ) : null}

                 
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main
        style={{
          minHeight: 0,
          minWidth: 0,
          maxWidth: "100%",
          overflow: "auto",
          backgroundColor: "transparent",
          padding: isLarge ? "var(--space-2xl)" : isMedium ? "var(--space-lg)" : "var(--space-md)",
        }}
      >
        <div
          style={{
            marginLeft: "auto",
            marginRight: "auto",
            display: "flex",
            minHeight: "100%",
            width: "100%",
            height: "100%",
            minWidth: 0,
            maxWidth: "100%",
            alignItems: isLarge ? "center" : "flex-start",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      </main>
      
    </div>
  );
}