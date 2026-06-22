"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useAssessment } from "../context";
import Animation from "@/components/ui/animation";

const STORAGE_PREFIX = "skill-assessment:";

export default function QuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReviewing = searchParams.get("review") === "true";
  const { isLarge, isMedium, isSmall } = useResponsive();

  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);

  const sharedContext = useAssessment();

  const questions = sharedContext?.questions || [];
  const userAnswers = sharedContext?.userAnswers || {};
  const setUserAnswers = sharedContext?.setUserAnswers;

  const currentQuestion = sharedContext?.currentQuestion || 1;
  const setCurrentQuestion = sharedContext?.setCurrentQuestion;

  const setExpandedId = sharedContext?.setExpandedId;
  const setUnlockedStepId = sharedContext?.setUnlockedStepId;

  const resultsData = sharedContext?.resultsData;
  const sessionId = sharedContext?.sessionId;

  const currentQData = questions[currentQuestion - 1] || null;

  const selectedChoice = currentQData
    ? userAnswers[currentQData.id] || null
    : null;

  const isAnswered = Boolean(selectedChoice);

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => Boolean(userAnswers[q.id]));

  useEffect(() => {
    if (sessionId && questions.length > 0) {
      sessionStorage.setItem(
        `${STORAGE_PREFIX}${sessionId}`,
        JSON.stringify({
          sessionId,
          questions,
          userAnswers,
          currentQuestion,
          unlockedStepId: sharedContext?.unlockedStepId,
        })
      );
    }
  }, [
    currentQuestion,
    userAnswers,
    sharedContext?.unlockedStepId,
    sessionId,
    questions,
  ]);

  const resultByQuestionId = React.useMemo(() => {
    const map = new Map();

    for (const item of resultsData?.results || []) {
      map.set(item.question_id, item);
    }

    return map;
  }, [resultsData]);

  if (!sharedContext || !questions || questions.length === 0) {
    return (
      <section
        style={{
          marginLeft: "auto",
          marginRight: "auto",
          display: "flex",
          width: "100%",
          maxWidth: "var(--container-md)",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "var(--container-sm)" }}>
          <Animation message="Preparing your assessment questions..." />
        </div>
      </section>
    );
  }

  const handleChoiceClick = (choiceValue: string) => {
    if (isReviewing || !currentQData || !setUserAnswers) return;

    setUserAnswers((prev) => ({
      ...prev,
      [currentQData.id]: choiceValue,
    }));

    if (currentQuestion < questions.length && setUnlockedStepId) {
      setUnlockedStepId((prev) =>
        Math.max(prev, currentQuestion + 1)
      );
    }
  };

  const navigateTo = (idx: number) => {
    if (setCurrentQuestion && setExpandedId) {
      setCurrentQuestion(idx);
      setExpandedId(idx);
    }
  };

  const handleFinish = () => {
    router.push(`/skill-feature/results?${searchParams.toString()}`);
  };

  return (
    <div
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        display: "flex",
        width: isLarge ? "65vw" : isMedium ? "80vw" : "90vw",
        height: "100%",
        flexDirection: "column",
        alignItems: "center",
        gap: isSmall ? "var(--space-lg)" : "var(--space-xl)",
        justifyContent: "space-between",
      }}
    >
      <h2
        style={{
          margin: 0,
          width: "100%",
          textAlign: "center",
          fontSize: isSmall ? "16px" : "var(--text-lg)",
          fontFamily: "var(--font-nova-square), sans-serif",
          color: "white",
          lineHeight: "1.4",
        }}
      >
        {currentQData
          ? `${currentQuestion}. ${currentQData.question_text}`
          : "Question unavailable"}
      </h2>

      <div
        style={{
          marginTop: isSmall ? "var(--space-lg)" : "var(--space-xl)",
          display: "flex",
          width: "100%",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        {(currentQData?.options || []).map((choice: string) => {
          const isSelected = selectedChoice === choice;

          const qRes = resultByQuestionId.get(currentQData?.id);
          const isCorrect = qRes?.correct_answer === choice;

          const isWrongSelection =
            isReviewing &&
            isSelected &&
            !isCorrect;

          let bg = "var(--white)";
          let border = "transparent";

          if (isReviewing && isCorrect) {
            border = "var(--primary-green)";
            bg = "var(--light-green)";
          } else if (isWrongSelection) {
            border = "var(--light-red)";
            bg = "var(--light-red)";
          } else if (
            !isSelected &&
            hoveredChoice === choice
          ) {
            bg = "var(--light-blue)";
          }

          return (
            <button
              key={choice}
              type="button"
              disabled={isReviewing}
              onMouseEnter={() => setHoveredChoice(choice)}
              onMouseLeave={() => setHoveredChoice(null)}
              onClick={() => handleChoiceClick(choice)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: "var(--radius-lg)",
                padding: isSmall ? "12px 16px" : "var(--space-md) var(--space-lg)",
                color: "var(--dark-blue)",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                transition: "all 0.2s ease",
                cursor: isReviewing ? "default" : "pointer",
                textAlign: "left",
                gap: "12px",
              }}
            >
              <span style={{ flex: 1, wordBreak: "break-word" }}>{choice}</span>

              <span
                style={{
                  display: "flex",
                  height: "1.45rem",
                  width: "1.45rem",
                  minWidth: "1.45rem",
                  minHeight: "1.45rem",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: "2px solid var(--dark-blue)",
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {isReviewing && isCorrect ? (
                  "✓"
                ) : isWrongSelection ? (
                  "✕"
                ) : isSelected ? (
                  <span
                    style={{
                      height: "0.6rem",
                      width: "0.6rem",
                      borderRadius: "50%",
                      backgroundColor: "var(--dark-blue)",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          width: "100%",
          gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
          flexDirection: "column",
          flexShrink: 0,
          alignSelf: "center",
          height: "fit-content",
          marginTop: isSmall ? "var(--space-lg)" : "0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
            flexDirection: "row",
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
          <Button
            variant="secondary-inverted"
            type="button"
            onClick={() => navigateTo(currentQuestion - 1)}
            disabled={currentQuestion === 1}
            style={{
              paddingInline: isSmall ? "var(--space-lg)" : "var(--space-2xl)",
              paddingBlock: "0",
              paddingLeft: "0",
              gap: isSmall ? "var(--space-md)" : "var(--space-xl)",
              height: "fit-content",
              width: "fit-content",
              maxWidth: isSmall ? "100%" : "fit-content",
              flex: isSmall ? 1 : "none",
              justifyContent: "space-between",
              borderRadius: "999px",
              fontSize: isSmall ? "14px" : "inherit",
            }}
          >
            <img
              src={"/global/next.svg"}
              style={{
                height: "var(--icon-md)",
                transform: "rotate(180deg)",
                backgroundColor: "white",
                padding: "var(--space-xxs)",
                boxSizing: "content-box",
                borderRadius: "999px",
              }}
            />
            Previous
          </Button>

          <Button
            variant={"primary-inverted"}
            type="button"
            onClick={() => navigateTo(currentQuestion + 1)}
            disabled={!isAnswered || !(currentQuestion < questions.length)}
            style={{
              paddingInline: isSmall ? "var(--space-lg)" : "var(--space-2xl)",
              paddingBlock: "0",
              paddingRight: "0",
              gap: isSmall ? "var(--space-md)" : "var(--space-xl)",
              height: "fit-content",
              width: "fit-content",
              maxWidth: isSmall ? "100%" : "fit-content",
              flex: isSmall ? 1 : "none",
              justifyContent: "space-between",
              borderRadius: "999px",
              fontSize: isSmall ? "14px" : "inherit",
            }}
          >
            Next
            <img
              src={"/global/next.svg"}
              style={{
                height: "var(--icon-md)",
                backgroundColor: "white",
                padding: "var(--space-xxs)",
                boxSizing: "content-box",
                borderRadius: "999px",
              }}
            />
          </Button>
        </div>

        {!isReviewing && !(currentQuestion < questions.length) && (
          <Button
            variant="primary"
            type="button"
            onClick={handleFinish}
            disabled={!allAnswered}
            style={{
              paddingInline: "var(--space-2xl)",
              paddingBlock: "var(--space-xxs)",
              height: "fit-content",
              width: isSmall ? "100%" : "fit-content",
              marginLeft: isSmall ? 0 : "auto",
              flex: "none",
            }}
          >
            Finish Assessment
          </Button>
        )}
      </div>

      {isReviewing && (
        <Button
          variant="secondary"
          className="mt-[var(--space-lg)]"
          style={{
            width: isSmall ? "100%" : "auto",
            height: isSmall ? "auto" : "fit-content",
            paddingBlock: isSmall ? "0px" : "var(--space-xs)",
            fontSize: isSmall ? "13px" : "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() =>
            router.push(
              `/skill-feature/results?${searchParams.toString()}`
            )
          }
        >
          Back to Results
        </Button>
      )}
    </div>
  );
}