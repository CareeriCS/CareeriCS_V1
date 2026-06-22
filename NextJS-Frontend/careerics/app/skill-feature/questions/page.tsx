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
        height: "auto",
        minHeight: "100%",
        flexDirection: "column",
        alignItems: "center",
        gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
        justifyContent: isSmall ? "flex-start" : "center", // Align to top on mobile for smooth scrolling flow
        paddingBlock: isSmall ? "var(--space-md)" : "var(--space-xl)",
        paddingBottom: isSmall ? "32px" : "var(--space-xl)", // Extra breathing room at the bottom for mobile
        overflowY: isSmall ? "auto" : "visible", // Triggers natural viewport scrolling on small viewports
      }}
    >
      {/* Question Title */}
      <h2
        style={{
          margin: 0,
          width: "100%",
          textAlign: "left", 
          fontSize: isSmall ? "15px" : isMedium ? "var(--text-md)" : "18px",
          fontFamily: "var(--font-nova-square)",
          color: "white",
          lineHeight: "1.4",
          fontWeight: 500,
          marginBottom: isSmall ? "8px" : "10px",
        }}
      >
        {currentQData
          ? `${currentQuestion}. ${currentQData.question_text}`
          : "Question unavailable"}
      </h2>

      {/* Choices Options Container */}
      <div
        style={{
          display: "flex",
          width: "100%",
          flexDirection: "column",
          gap: isSmall ? "10px" : "10px",
          marginBottom: isSmall ? "16px" : "10px",
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
                padding: isSmall 
                  ? "12px 16px" 
                  : isMedium 
                    ? "14px 20px" 
                    : "16px 24px",
                color: "var(--dark-blue)",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                transition: "all 0.15s ease",
                cursor: isReviewing ? "default" : "pointer",
                textAlign: "left",
                gap: "16px",
              }}
            >
              <span style={{ flex: 1, wordBreak: "break-word", fontSize: isSmall ? "13px" : "15px", fontWeight: 400 }}>
                {choice}
              </span>

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

      {/* Navigation and Bottom Control Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          gap: isSmall ? "12px" : "var(--space-md)",
          flexDirection: "column",
          marginTop: isSmall ? "16px" : "auto", // Flow naturally downwards right after the choices container on mobile
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            gap: isSmall ? "12px" : "16px",
            flexDirection: "row",
          }}
        >
          <Button
            variant="secondary-inverted"
            type="button"
            onClick={() => navigateTo(currentQuestion - 1)}
            disabled={currentQuestion === 1}
            style={{
              paddingInline: isSmall ? "var(--space-lg)" : "var(--space-2xl)",
              gap: isSmall ? "8px" : "12px",
              height: isSmall ? "36px" : "42px",
              width: "fit-content",
              maxWidth: isSmall ? "100%" : "fit-content",
              flex: isSmall ? 1 : "none",
              justifyContent: "space-between",
              borderRadius: "999px",
              fontSize: isSmall ? "13px" : "14px",
            }}
          >
            <img
              src={"/global/next.svg"}
              style={{
                height: isSmall ? "14px" : "16px",
                transform: "rotate(180deg)",
                backgroundColor: "white",
                padding: "4px",
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
              gap: isSmall ? "8px" : "12px",
              height: isSmall ? "36px" : "42px",
              width: "fit-content",
              maxWidth: isSmall ? "100%" : "fit-content",
              flex: isSmall ? 1 : "none",
              justifyContent: "space-between",
              borderRadius: "999px",
              fontSize: isSmall ? "13px" : "14px",
            }}
          >
            Next
            <img
              src={"/global/next.svg"}
              style={{
                height: isSmall ? "14px" : "16px",
                backgroundColor: "white",
                padding: "4px",
                boxSizing: "content-box",
                borderRadius: "999px",
              }}
            />
          </Button>
        </div>

        {/* Finish Assessment Button */}
        {!isReviewing && !(currentQuestion < questions.length) && (
          <Button
            variant="primary"
            type="button"
            onClick={handleFinish}
            disabled={!allAnswered}
            style={{
              paddingInline: "var(--space-2xl)",
              height: isSmall ? "32px" : "38px",
              fontSize: isSmall ? "13px" : "14px",
              width: isSmall ? "100%" : "auto",
              marginTop: isSmall ? "4px" : "8px",
            }}
          >
            Finish Assessment
          </Button>
        )}
      </div>

      {/* Back to Results (Review Mode Only) */}
      {isReviewing && (
        <Button
          variant="secondary"
          className="mt-[var(--space-md)]"
          style={{
            width: isSmall ? "100%" : "auto",
            height: isSmall ? "34px" : "40px",
            fontSize: isSmall ? "13px" : "14px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: isSmall ? "8px" : "16px",
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