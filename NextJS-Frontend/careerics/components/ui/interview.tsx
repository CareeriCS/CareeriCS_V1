"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}

export default function SidebarLogicOnly({
  questions,
  currentActiveId,
  unlockedStepId,
  onQuestionClick,
  label = "Question",
  title = "Skill Assessment",
  children,
}: SidebarLogicProps) {
  return (
    <div className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)] bg-transparent max-lg:overflow-x-hidden lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:grid-rows-1 lg:overflow-hidden">
      <aside className="min-h-0 max-h-[7.5rem] w-full min-w-0 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-grey)] px-[var(--space-md)] py-[var(--space-sm)] text-[var(--dark-blue)] lg:max-h-none lg:h-full lg:border-b-0 lg:border-r lg:px-[var(--space-xl)] lg:py-[var(--space-2xl)]">
        <div className="flex h-full min-h-0 flex-col gap-[var(--space-sm)] lg:gap-[var(--space-lg)]">
          <h1
            className="m-0 shrink-0 truncate text-[length:var(--text-lg)] font-bold leading-[var(--line-tight)] text-[var(--dark-blue)]"
            style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
            title={title}
          >
            {title}
          </h1>

          <div className="h-px shrink-0 bg-[var(--dark-blue)]/35" />

          <nav
            aria-label={`${title} navigation`}
            className="no-scrollbar -mx-[var(--space-xs)] flex min-h-0 min-w-0 flex-1 gap-[var(--space-sm)] overflow-x-auto overflow-y-hidden px-[var(--space-xs)] pb-[var(--space-xxs)] lg:mx-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:px-0 lg:pb-0"
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

              return (
                <button
                  key={question.id}
                  type="button"
                  disabled={isLocked}
                  aria-current={isSelected ? "step" : undefined}
                  aria-label={`${defaultTitle}${shouldShowTitle ? `: ${normalizedTitle}` : ""}${
                    isLocked ? " locked" : ""
                  }`}
                  onClick={() => {
                    if (!isLocked) {
                      onQuestionClick(question.id);
                    }
                  }}
                  className={cn(
                    "shrink-0 rounded-[var(--radius-lg)] border border-transparent px-[var(--space-md)] py-[var(--space-sm)] text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-grey)] disabled:cursor-not-allowed disabled:opacity-45 max-lg:min-w-[7rem] lg:min-w-0 lg:px-[var(--space-md)] lg:py-[var(--space-md)]",
                    isSelected
                      ? "bg-[var(--primary-green)] text-[var(--dark-blue)] shadow-sm"
                      : "bg-[rgba(10,10,10,0.06)] text-[var(--dark-blue)] hover:bg-[rgba(10,10,10,0.1)]"
                  )}
                  style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                >
                  <span
                    className={cn(
                      "block text-[length:var(--text-sm)] font-semibold leading-[var(--line-tight)]",
                      isLocked ? "opacity-70" : ""
                    )}
                  >
                    {defaultTitle}
                  </span>

                  {shouldShowTitle ? (
                    <span className="mt-[var(--space-xxs)] hidden truncate text-[length:var(--text-xs)] font-semibold leading-[var(--line-normal)] opacity-90 lg:block lg:whitespace-normal">
                      {normalizedTitle}
                    </span>
                  ) : null}

                  {isSelected && normalizedText ? (
                    <span className="mt-[var(--space-sm)] hidden text-[length:var(--text-xs)] leading-[var(--line-normal)] opacity-80 lg:block lg:line-clamp-3">
                      {normalizedText}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden bg-transparent px-[var(--space-md)] py-[var(--space-lg)] sm:px-[var(--space-lg)] sm:py-[var(--space-xl)] lg:px-[var(--space-2xl)] lg:py-[var(--space-2xl)]">
        <div className="mx-auto flex min-h-full w-full min-w-0 max-w-full items-start justify-center lg:items-center">
          {children}
        </div>
      </main>
    </div>
  );
}
