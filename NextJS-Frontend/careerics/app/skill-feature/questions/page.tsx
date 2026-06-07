"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Interview from "@/components/ui/interview";
import { Button } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { skillAssessmentService } from "@/services";
import type {
  APIAssessmentQuestion,
  APIAssessmentQuestionResult,
  APIAssessmentSessionType,
  APISubmitAssessmentResponse,
} from "@/types";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "skill-assessment:";
const STATUS_STORAGE_PREFIX = "skill-assessment:status:";

type CachedAssessmentState = {
  sessionId: string;
  questions: APIAssessmentQuestion[];
  userAnswers: Record<string, string>;
  currentQuestion: number;
  unlockedStepId: number;
};

function getProficiencyLevel(score: number): "Advanced" | "Intermediate" | "Beginner" {
  if (score >= 80) return "Advanced";
  if (score >= 50) return "Intermediate";
  return "Beginner";
}

function normalizeSessionType(rawType: string | null): APIAssessmentSessionType {
  if (rawType === "roadmap" || rawType === "section" || rawType === "step") {
    return rawType;
  }

  return "skills";
}

function persistAssessmentState(
  nextSessionId: string,
  nextQuestions: APIAssessmentQuestion[],
  nextAnswers: Record<string, string>,
  nextCurrentQuestion: number,
  nextUnlockedStepId: number
) {
  const cacheKey = `${STORAGE_PREFIX}${nextSessionId}`;
  const payload: CachedAssessmentState = {
    sessionId: nextSessionId,
    questions: nextQuestions,
    userAnswers: nextAnswers,
    currentQuestion: nextCurrentQuestion,
    unlockedStepId: nextUnlockedStepId,
  };

  sessionStorage.setItem(cacheKey, JSON.stringify(payload));
}

type SkillNavButtonProps = {
  direction: "previous" | "next";
  disabled?: boolean;
  isLoading?: boolean;
  inactive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function SkillNavButton({
  direction,
  disabled,
  isLoading,
  inactive = false,
  onClick,
  children,
}: SkillNavButtonProps) {
  const isPrevious = direction === "previous";

  return (
    <Button
      variant={isPrevious ? "secondary-inverted" : "primary-inverted"}
      type="button"
      onClick={inactive ? undefined : onClick}
      disabled={disabled || inactive}
      isLoading={isLoading}
      aria-hidden={inactive}
      tabIndex={inactive ? -1 : undefined}
      className={cn(
        "relative min-h-[var(--button-height-md)] overflow-hidden rounded-full px-[var(--space-md)] font-normal sm:w-auto sm:min-w-[7.5rem]",
        isPrevious
          ? "pl-[2.55rem] pr-[var(--space-md)] hover:!bg-[var(--white)]"
          : "pl-[var(--space-md)] pr-[2.55rem] !bg-[var(--light-green)] hover:!bg-[var(--primary-green)]",
        inactive ? "pointer-events-none opacity-0" : ""
      )}
    >
      {!isLoading ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 flex h-[2rem] w-[2rem] -translate-y-1/2 items-center justify-center rounded-full bg-[var(--white)] text-[length:var(--text-sm)] leading-none text-[var(--dark-blue)]",
            isPrevious ? "left-[0.25rem]" : "right-[0.25rem]"
          )}
        >
          {isPrevious ? "↩" : "↪"}
        </span>
      ) : null}

      <span>{children}</span>
    </Button>
  );
}

export default function AssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? "";

  const legacySkillId = searchParams.get("skillId") || "";
  const legacySkillName = searchParams.get("skillName") || "";
  const targetId = searchParams.get("targetId") || legacySkillId;
  const targetName = searchParams.get("targetName") || legacySkillName || "Skill Assessment";
  const sessionType = normalizeSessionType(searchParams.get("sessionType"));
  const resumeSessionId = searchParams.get("sessionId") || "";
  const parsedNumQuestions = Number(searchParams.get("numQuestions") || "7");
  const numQuestions =
    Number.isFinite(parsedNumQuestions) && parsedNumQuestions > 0
      ? Math.min(parsedNumQuestions, 20)
      : 7;

  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [expandedId, setExpandedId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);

  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<APIAssessmentQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  const [isInitializing, setIsInitializing] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [resultsData, setResultsData] = useState<APISubmitAssessmentResponse | null>(null);
  const [error, setError] = useState("");

  const initKeyRef = useRef("");

  const currentQData = questions[currentQuestion - 1] || null;
  const selectedChoice = currentQData ? userAnswers[currentQData.id] || null : null;
  const isAnswered = Boolean(selectedChoice);
  const allAnswered = questions.length > 0 && questions.every((q) => Boolean(userAnswers[q.id]));
  const isFinalQuestion = currentQuestion === questions.length;

  const resultByQuestionId = useMemo(() => {
    const map = new Map<string, APIAssessmentQuestionResult>();

    for (const item of resultsData?.results || []) {
      map.set(item.question_id, item);
    }

    return map;
  }, [resultsData]);

  const sidebarQuestions = useMemo(
    () =>
      questions.map((q, idx) => ({
        id: idx + 1,
        title: `Question ${idx + 1}`,
        text: q.question_text,
      })),
    [questions]
  );

  const startNewSession = useCallback(async () => {
    if (!userId || !targetId) {
      return;
    }

    setIsInitializing(true);
    setError("");
    setShowResult(false);
    setIsReviewing(false);
    setResultsData(null);

    const response = await skillAssessmentService.startSession(userId, {
      target_id: targetId,
      num_questions: numQuestions,
      session_type: sessionType,
    });

    if (!response.success || !response.data?.session_id || !response.data.questions?.length) {
      setError(response.message || "Unable to start skill assessment session.");
      setIsInitializing(false);
      return;
    }

    const nextSessionId = response.data.session_id;
    const nextQuestions = response.data.questions;

    setSessionId(nextSessionId);
    setQuestions(nextQuestions);
    setUserAnswers({});
    setCurrentQuestion(1);
    setExpandedId(1);
    setUnlockedStepId(1);

    persistAssessmentState(nextSessionId, nextQuestions, {}, 1, 1);
    sessionStorage.setItem(`${STATUS_STORAGE_PREFIX}${nextSessionId}`, "in_progress");

    const params = new URLSearchParams({
      targetId,
      targetName,
      sessionType,
      numQuestions: String(numQuestions),
      sessionId: nextSessionId,
    });

    if (sessionType === "skills") {
      params.set("skillId", targetId);
      params.set("skillName", targetName);
    }

    router.replace(`/skill-feature/questions?${params.toString()}`);
    setIsInitializing(false);
  }, [numQuestions, router, sessionType, targetId, targetName, userId]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const initKey = `${userId}:${sessionType}:${targetId}:${resumeSessionId}:${numQuestions}`;
    if (initKeyRef.current === initKey) {
      return;
    }

    initKeyRef.current = initKey;

    const initialize = async () => {
      if (!userId) {
        setIsInitializing(false);
        setError("Please sign in to start the assessment.");
        return;
      }

      if (!targetId) {
        setIsInitializing(false);
        setError("Missing assessment target. Please select a topic or skill first.");
        return;
      }

      if (resumeSessionId) {
        const cached = sessionStorage.getItem(`${STORAGE_PREFIX}${resumeSessionId}`);

        if (cached) {
          try {
            const parsed = JSON.parse(cached) as CachedAssessmentState;

            if (parsed.sessionId && parsed.questions?.length) {
              setSessionId(parsed.sessionId);
              setQuestions(parsed.questions);
              setUserAnswers(parsed.userAnswers || {});
              setCurrentQuestion(parsed.currentQuestion || 1);
              setExpandedId(parsed.currentQuestion || 1);
              setUnlockedStepId(parsed.unlockedStepId || 1);
              setIsInitializing(false);
              return;
            }
          } catch {
            // Ignore malformed cache and fall through to restart.
          }
        }
      }

      await startNewSession();
    };

    void initialize();
  }, [
    isAuthLoading,
    numQuestions,
    resumeSessionId,
    sessionType,
    startNewSession,
    targetId,
    userId,
  ]);

  useEffect(() => {
    if (!sessionId || !questions.length) {
      return;
    }

    persistAssessmentState(sessionId, questions, userAnswers, currentQuestion, unlockedStepId);
  }, [currentQuestion, questions, sessionId, unlockedStepId, userAnswers]);

  const handleChoiceClick = (choiceValue: string) => {
    if (!currentQData || isReviewing) {
      return;
    }

    setUserAnswers((prev) => ({
      ...prev,
      [currentQData.id]: choiceValue,
    }));

    if (currentQuestion < questions.length) {
      setUnlockedStepId((prev) => Math.max(prev, currentQuestion + 1));
    }
  };

  const handlePrevious = () => {
    const prevQ = currentQuestion - 1;

    if (prevQ >= 1) {
      setCurrentQuestion(prevQ);
      setExpandedId(prevQ);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length) {
      const nextQ = currentQuestion + 1;
      setCurrentQuestion(nextQ);
      setExpandedId(nextQ);

      if (nextQ > unlockedStepId) {
        setUnlockedStepId(nextQ);
      }
    }
  };

  const handleFinish = async () => {
    if (!userId || !sessionId || !allAnswered || isSubmitting || !questions.length) {
      return;
    }

    setIsCalculating(true);
    setIsSubmitting(true);
    setError("");

    const answersPayload = questions
      .map((question) => ({
        question_id: question.id,
        selected_answer: userAnswers[question.id],
      }))
      .filter((answer) => Boolean(answer.selected_answer));

    const submitResponse = await skillAssessmentService.submitAnswers(
      userId,
      sessionId,
      answersPayload
    );

    if (!submitResponse.success || !submitResponse.data) {
      setIsCalculating(false);
      setIsSubmitting(false);
      setError(submitResponse.message || "Unable to submit assessment answers.");
      return;
    }

    sessionStorage.setItem(`${STATUS_STORAGE_PREFIX}${sessionId}`, "submitted");

    const resultsResponse = await skillAssessmentService.getResults(userId, sessionId);
    const finalResults =
      resultsResponse.success && resultsResponse.data ? resultsResponse.data : submitResponse.data;

    setResultsData(finalResults);
    setShowResult(true);
    setIsReviewing(false);
    setUnlockedStepId(questions.length);
    setIsCalculating(false);
    setIsSubmitting(false);
  };

  const handleReviewAnswers = () => {
    setIsReviewing(true);
    setShowResult(false);
    setCurrentQuestion(1);
    setExpandedId(1);

    if (!resultsData) {
      return;
    }

    const answeredQuestionIds = new Set(resultsData.results.map((r) => r.question_id));
    let unlocked = 1;

    for (let i = 0; i < questions.length; i += 1) {
      if (answeredQuestionIds.has(questions[i].id)) {
        unlocked = i + 1;
      }
    }

    setUnlockedStepId(Math.max(1, unlocked));
  };

  const percentage = Math.max(0, Math.min(100, Math.round(resultsData?.score || 0)));
  const scoreRadius = 90;
  const scoreCircumference = 2 * Math.PI * scoreRadius;
  const proficiencyLevel = getProficiencyLevel(percentage);

  return (
    <Interview
      questions={sidebarQuestions}
      currentActiveId={expandedId}
      unlockedStepId={unlockedStepId}
      onQuestionClick={(id) => {
        setExpandedId(id);

        if (id <= unlockedStepId) {
          setCurrentQuestion(id);
        }
      }}
      title={targetName}
    >
      <div className="flex w-full min-w-0 max-w-full flex-col items-center justify-center">
        {isInitializing ? (
          <section className="mx-auto flex w-full max-w-[var(--container-md)] flex-col items-center justify-center text-center">
            <h2
              className="m-0 text-[length:var(--text-xl)] font-semibold leading-[var(--line-tight)] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
            >
              {isAuthLoading ? "Checking your session..." : "Preparing your assessment..."}
            </h2>

            {error ? (
              <p className="mt-[var(--space-lg)] text-[length:var(--text-base)] leading-[var(--line-normal)] text-[var(--text-danger)]">
                {error}
              </p>
            ) : null}
          </section>
        ) : showResult ? (
<section className="grid w-full max-w-[62rem] gap-x-[var(--space-2xl)] gap-y-[var(--space-xl)] rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-[var(--space-xl)] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:p-[var(--space-2xl)]">
  <div className="flex min-w-0 flex-col items-center text-center">
    <h2
      className="m-0 text-[length:var(--text-xl)] font-normal leading-[var(--line-tight)] text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
    >
      Your Score
    </h2>

    <div className="relative mt-[var(--space-xl)] h-[clamp(8rem,22vw,10.5rem)] w-[clamp(8rem,22vw,10.5rem)]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
        <circle
          cx="100"
          cy="100"
          r={scoreRadius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="15"
        />
        <circle
          cx="100"
          cy="100"
          r={scoreRadius}
          fill="none"
          stroke="var(--primary-green)"
          strokeWidth="15"
          strokeDasharray={scoreCircumference}
          strokeDashoffset={scoreCircumference - (scoreCircumference * percentage) / 100}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>

      <div
        className="absolute inset-0 flex items-center justify-center text-[length:var(--text-xl)] font-normal text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
      >
        {percentage}%
      </div>
    </div>
  </div>

  <div className="hidden h-full min-h-[18rem] w-px bg-[var(--border-muted)] md:row-span-2 md:block" />

  <div className="flex min-w-0 flex-col items-center text-center md:items-start md:text-left">
    <h2
      className="m-0 text-[length:var(--text-xl)] font-normal leading-[var(--line-tight)] text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
    >
      Your Proficiency Level
    </h2>

    <p
      className="m-0 mt-[var(--space-md)] text-[length:var(--text-xl)] font-normal leading-[var(--line-tight)] text-[var(--primary-green)]"
      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
    >
      {proficiencyLevel}
    </p>

    <p className="mt-[var(--space-lg)] max-w-[30rem] text-[length:var(--text-md)] font-normal leading-[var(--line-relaxed)] text-[var(--text-secondary)]">
      Assessment complete. You can review each question to see the correct answers, or
      retake the assessment to generate a fresh session.
    </p>
  </div>

  <div className="flex justify-center">
    <Button
      variant="primary"
      size="md"
      className="w-full font-normal sm:w-auto sm:min-w-[14rem]"
      onClick={handleReviewAnswers}
    >
      Review Answers
    </Button>
  </div>

  <div className="flex justify-center">
    <Button
      variant="secondary-inverted"
      size="md"
      className="w-full font-normal sm:w-auto sm:min-w-[14rem]"
      onClick={() => {
        void startNewSession();
      }}
    >
      Retake Assessment
    </Button>
  </div>
</section>
        ) : (
          <section className="mx-auto flex w-full min-w-0 max-w-[46rem] flex-col items-center px-0">
            <h2
              className="m-0 w-full max-w-full break-words text-center text-[length:var(--text-lg)] font-normal leading-[var(--line-normal)] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
            >
              {currentQData
                ? `${currentQuestion}. ${currentQData.question_text}`
                : "Question unavailable"}
            </h2>

            {error ? (
              <p className="mt-[var(--space-lg)] text-center text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-danger)]">
                {error}
              </p>
            ) : null}

            <div className="mt-[var(--space-xl)] flex w-full min-w-0 flex-col gap-[var(--space-md)]">
              {(currentQData?.options || []).map((choice) => {
                const isSelected = selectedChoice === choice;
                const questionResult = currentQData
                  ? resultByQuestionId.get(currentQData.id)
                  : undefined;
                const isCorrect = questionResult?.correct_answer === choice;
                const isWrongSelection = isReviewing && isSelected && !isCorrect;

                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={isReviewing}
                    aria-pressed={isSelected}
                    onClick={() => handleChoiceClick(choice)}
                    className={cn(
                      "group flex min-h-[var(--min-touch-target)] w-full min-w-0 max-w-full items-center justify-between gap-[var(--space-md)] rounded-[var(--radius-lg)] border px-[var(--space-lg)] py-[var(--space-md)] text-left text-[var(--dark-blue)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-color)] disabled:cursor-default",
                      isReviewing && isCorrect
                        ? "border-[var(--primary-green)] bg-[var(--light-green)]"
                        : isWrongSelection
                          ? "border-[var(--light-red)] bg-[var(--light-red)]"
                          : isSelected
                            ? "border-transparent bg-[var(--white)]"
                            : "border-transparent bg-[var(--white)] hover:bg-[var(--light-blue)]"
                    )}
                    style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                  >
                    <span className="min-w-0 flex-1 break-words text-[length:var(--text-base)] font-normal leading-[var(--line-normal)]">
                      {choice}
                    </span>

                    <span className="flex h-[1.45rem] w-[1.45rem] shrink-0 items-center justify-center rounded-full border-2 border-[var(--dark-blue)] text-[length:var(--text-xs)] font-extrabold">
                      {isReviewing && isCorrect ? (
                        "✓"
                      ) : isWrongSelection ? (
                        "✕"
                      ) : isSelected ? (
                        <span className="h-[0.6rem] w-[0.6rem] rounded-full bg-[var(--dark-blue)]" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <footer className="mt-[var(--space-xl)] grid w-full grid-cols-1 items-center gap-[var(--space-md)] sm:grid-cols-[1fr_auto_1fr]">
              <div />

              <div className="flex items-center justify-center gap-[var(--space-md)]">
                <SkillNavButton
                  direction="previous"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 1}
                >
                  Previous
                </SkillNavButton>

                <SkillNavButton
                  direction="next"
                  onClick={handleNext}
                  disabled={!isAnswered}
                  inactive={isFinalQuestion}
                >
                  Next
                </SkillNavButton>
              </div>

              <div className="flex justify-end">
                {isFinalQuestion && !isReviewing ? (
                  <SkillNavButton
                    direction="next"
                    onClick={() => {
                      void handleFinish();
                    }}
                    disabled={!allAnswered || isSubmitting}
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Finish Assessment"}
                  </SkillNavButton>
                ) : null}
              </div>
            </footer>

            {isReviewing && resultsData ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-[var(--space-lg)]"
                onClick={() => {
                  setIsReviewing(false);
                  setShowResult(true);
                }}
              >
                Back to Results
              </Button>
            ) : null}
          </section>
        )}
      </div>
    </Interview>
  );
}