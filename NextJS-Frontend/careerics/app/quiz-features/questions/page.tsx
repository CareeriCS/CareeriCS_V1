"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Animation from "@/components/ui/animation";
import { Button } from "@/components/ui/button";
import Interview from "@/components/ui/interview";
import { buildCareerQuizResultsHref } from "@/lib/career-quiz";
import { registerTrackRoadmapLinksFromRecommendations } from "@/lib/track-roadmap-links";
import { careerService } from "@/services";
import type { APICareerQuestionResponse, APICareerSelectedCardRead } from "@/types";
import { cn } from "@/lib/utils";
import { useResponsive } from "@/hooks/useResponsive";

interface QuestionGroup {
  groupId: string;
  title: string;
  cardType: "hobby" | "technical";
  questions: APICareerQuestionResponse[];
}

type RatingValue = 1 | 2 | 3 | 4 | 5;

const ratingValues = [1, 2, 3, 4, 5] as const;

function getQuestionCardId(question: APICareerQuestionResponse): string {
  if (question.type === "hobby") {
    return question.hobby_id || "unknown-hobby";
  }

  return question.technical_skill_id || "unknown-technical";
}

function buildQuestionGroups(
  questions: APICareerQuestionResponse[],
  selectedCards: APICareerSelectedCardRead[],
): QuestionGroup[] {
  const selectedCardMap = new Map<string, APICareerSelectedCardRead>();

  for (const card of selectedCards) {
    selectedCardMap.set(card.id, card);
  }

  const grouped = new Map<string, QuestionGroup>();

  for (const question of questions) {
    const cardId = getQuestionCardId(question);
    const fallbackTitle = question.type === "hobby" ? "Hobby" : "Technical";
    const cardName = selectedCardMap.get(cardId)?.name || fallbackTitle;

    if (!grouped.has(cardId)) {
      grouped.set(cardId, {
        groupId: cardId,
        title: cardName,
        cardType: question.type,
        questions: [],
      });
    }

    grouped.get(cardId)?.questions.push(question);
  }

  const ordered: QuestionGroup[] = [];

  for (const selected of selectedCards) {
    const group = grouped.get(selected.id);

    if (!group) {
      continue;
    }

    group.title = selected.name;
    ordered.push(group);
    grouped.delete(selected.id);
  }

  for (const group of grouped.values()) {
    ordered.push(group);
  }

  return ordered;
}

function getRatingButtonClass(value: RatingValue, isSelected: boolean) {
  const sizeClass =
    value === 1 || value === 5
      ? "h-9 w-9 sm:h-10 sm:w-10"
      : value === 2 || value === 4
      ? "h-8 w-8 sm:h-9 sm:w-9"
      : "h-7 w-7 sm:h-8 sm:w-8";

  const selectedColorClass =
    value === 1
      ? "bg-[var(--light-red)]"
      : value === 2
      ? "bg-[#FFD0D0]"
      : value === 3
      ? "bg-[var(--light-blue)]"
      : value === 4
      ? "bg-[var(--light-green)]"
      : "bg-[var(--primary-green)]";

  const hoverColorClass =
    value === 1
      ? "hover:bg-[var(--light-red)]"
      : value === 2
      ? "hover:bg-[#FFD0D0]"
      : value === 3
      ? "hover:bg-[var(--light-blue)]"
      : value === 4
      ? "hover:bg-[var(--light-green)]"
      : "hover:bg-[var(--primary-green)]";

  return cn(
    sizeClass,
    "shrink-0 rounded-full border border-transparent transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card-soft)]",
    isSelected
      ? `${selectedColorClass} scale-110 shadow-sm`
      : `bg-[var(--bg-grey)] hover:scale-105 ${hoverColorClass}`
  );
}

export default function CareerQuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const requestedTrackId = searchParams.get("trackId") || "";
  const origin = searchParams.get("origin") || "";
  const returnTo = searchParams.get("returnTo") || "";
  const isLegacyResultsView = searchParams.get("view") === "results";

  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [currentStepId, setCurrentStepId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLegacyResultsView || !sessionId) {
      return;
    }

    router.replace(
      buildCareerQuizResultsHref(sessionId, requestedTrackId || null, {
        origin,
        returnTo,
      }),
    );
  }, [isLegacyResultsView, origin, requestedTrackId, returnTo, router, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!sessionId) {
        setError("Missing sessionId. Restart the quiz from the career page.");
        setIsLoadingQuestions(false);
        return;
      }

      if (isLegacyResultsView) {
        return;
      }

      setIsLoadingQuestions(true);
      setError(null);

      const [questionsResponse, selectedCardsResponse] = await Promise.all([
        careerService.getQuestionsForSession(sessionId),
        careerService.getSelectedCards(sessionId),
      ]);

      if (cancelled) {
        return;
      }

      if (!questionsResponse.success) {
        setError(questionsResponse.message || "Unable to load quiz questions.");
        setIsLoadingQuestions(false);
        return;
      }

      const loadedQuestions = questionsResponse.data || [];
      const selectedCards = selectedCardsResponse.success ? selectedCardsResponse.data || [] : [];
      const groupedQuestions = buildQuestionGroups(loadedQuestions, selectedCards);

      if (!groupedQuestions.length) {
        setError("No questions were found for this session. Re-select cards and try again.");
        setIsLoadingQuestions(false);
        return;
      }

      setQuestionGroups(groupedQuestions);
      setRatings({});
      setCurrentStepId(1);
      setUnlockedStepId(1);
      setIsLoadingQuestions(false);
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [isLegacyResultsView, sessionId]);

  const sidebarSteps = useMemo(() => {
    return questionGroups.map((group, index) => ({
      id: index + 1,
      title: group.title,
      text: "",
    }));
  }, [questionGroups]);

  const allQuestions = useMemo(() => {
    return questionGroups.flatMap((group) => group.questions);
  }, [questionGroups]);

  const currentGroup = questionGroups[currentStepId - 1] || null;
  const allAnswered =
    allQuestions.length > 0 && allQuestions.every((question) => Boolean(ratings[question.id]));

  const handleRate = (questionId: string, value: number) => {
    setRatings((prev) => {
      const next = { ...prev, [questionId]: value };

      if (
        currentGroup &&
        currentStepId === unlockedStepId &&
        currentStepId < questionGroups.length &&
        currentGroup.questions.every((question) => Boolean(next[question.id]))
      ) {
        setUnlockedStepId((prevUnlocked) => Math.min(questionGroups.length, prevUnlocked + 1));
      }

      return next;
    });
  };

  const finishQuiz = async () => {
    if (isSubmitting) {
      return;
    }

    if (!sessionId) {
      setError("Missing sessionId. Restart the quiz from the career page.");
      return;
    }

    if (!allAnswered) {
      setError("Please answer all questions before finishing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const answersPayload = allQuestions.map((question) => ({
        question_id: question.id,
        answer: ratings[question.id],
      }));

      const submitResponse = await careerService.submitAnswers(sessionId, answersPayload);

      if (!submitResponse.success) {
        setIsSubmitting(false);
        setError(submitResponse.message || "Unable to submit your answers.");
        return;
      }

      const evaluateResponse = await careerService.evaluateCareerQuiz(sessionId);

      if (evaluateResponse.success && evaluateResponse.data) {
        registerTrackRoadmapLinksFromRecommendations(evaluateResponse.data.track_scores);
        router.push(
          buildCareerQuizResultsHref(sessionId, requestedTrackId || null, {
            origin,
            returnTo,
          }),
        );
        return;
      }

      const cachedResponse = await careerService.getCareerResults(sessionId);

      if (cachedResponse.success && cachedResponse.data) {
        registerTrackRoadmapLinksFromRecommendations(cachedResponse.data.track_scores);
        router.push(
          buildCareerQuizResultsHref(sessionId, requestedTrackId || null, {
            origin,
            returnTo,
          }),
        );
        return;
      }

      setIsSubmitting(false);
      setError(
        evaluateResponse.message || cachedResponse.message || "Unable to evaluate your quiz right now.",
      );
    } catch {
      setIsSubmitting(false);
      setError("Unable to evaluate your quiz right now.");
    }
  };

  const handleNext = () => {
    if (!currentGroup) {
      return;
    }

    const unansweredQuestions = currentGroup.questions.filter((question) => !ratings[question.id]);

    if (unansweredQuestions.length) {
      setError(`Please answer all questions for ${currentGroup.title} first.`);
      return;
    }

    setError(null);

    if (currentStepId < questionGroups.length) {
      const nextStep = currentStepId + 1;
      setCurrentStepId(nextStep);

      if (nextStep > unlockedStepId) {
        setUnlockedStepId(nextStep);
      }

      return;
    }

    void finishQuiz();
  };

  const { isSmall } = useResponsive();

return (
    <Interview
      questions={sidebarSteps}
      currentActiveId={currentStepId}
      unlockedStepId={unlockedStepId}
      onQuestionClick={(id) => {
        if (id <= unlockedStepId) {
          setCurrentStepId(id);
          setError(null);
        }
      }}
      title="Career Quiz"
      label=""
    >

      <section 
        className="mx-auto flex w-full min-w-0 max-w-[52rem] flex-col items-center gap-[var(--space-md)] md:gap-[var(--space-xl)]"
        style={{
          height: "auto",
          minHeight: "100%",
          overflowY: isSmall ? "auto" : "visible",
          paddingBottom: isSmall ? "40px" : "0px", // Gives breathing room at the very bottom on mobile
        }}
      >
        {isSubmitting ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div style={{ maxWidth: "var(--container-sm)" }}>
              <Animation message="Finding your best career matches..." />
            </div>
          </div>
        ) : isLoadingQuestions ? (
          <div className="text-center text-[length:var(--text-md)] text-[var(--text-primary)]">
            Loading quiz questions...
          </div>
        ) : currentGroup ? (
          <>
            {/* Questions wrapper block */}
            <div className="flex w-full min-w-0 flex-col gap-[var(--space-md)] md:gap-[var(--space-lg)]">
              {currentGroup.questions.map((question) => (
                <article
                  key={question.id}
                  className="flex w-full min-w-0 flex-col items-center gap-[var(--space-md)] rounded-[var(--radius-2xl)] border border-[rgba(255,255,255,0.12)] bg-[rgba(61,67,84,0.68)] px-[var(--space-md)] py-[var(--space-lg)] shadow-sm backdrop-blur-sm sm:px-[var(--space-xl)] md:gap-[var(--space-lg)] md:py-[var(--space-xl)]"
                >
                  <p
                    className="m-0 w-full break-words text-center text-[length:var(--text-sm)] font-medium leading-[var(--line-normal)] text-[var(--text-primary)] md:text-[length:var(--text-base)]"
                    style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                  >
                    {question.text}
                  </p>

                  <div className="flex w-full flex-col items-center justify-center gap-[var(--space-sm)] md:flex-row md:gap-[var(--space-lg)]">
                    <span
                      className="text-center text-[length:12px] font-medium text-[var(--light-red)] md:text-[length:var(--text-sm)]"
                      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                    >
                      Strongly Disagree
                    </span>

                    <div className="flex flex-wrap items-center justify-center gap-[var(--space-xs)] md:gap-[var(--space-md)]">
                      {ratingValues.map((value) => {
                        const isSelected = ratings[question.id] === value;

                        return (
                          <button
                            key={value}
                            type="button"
                            aria-label={`Rate ${value} out of 5`}
                            aria-pressed={isSelected}
                            onClick={() => handleRate(question.id, value)}
                            className={`${getRatingButtonClass(value, isSelected)} scale-90 md:scale-100`}
                          />
                        );
                      })}
                    </div>

                    <span
                      className="text-center text-[length:12px] font-medium text-[var(--light-green)] md:text-[length:var(--text-sm)]"
                      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                    >
                      Strongly Agree
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {error ? (
              <p className="m-0 text-center text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-danger)]">
                {error}
              </p>
            ) : null}

            {/* Controller Action Buttons flowing perfectly below content */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                gap: isSmall ? "10px" : "var(--space-md)",
                flexDirection: "column",
                marginTop: isSmall ? "24px" : "32px",
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
                  onClick={() => {
                    setCurrentStepId((prev) => Math.max(1, prev - 1));
                    setError(null);
                  }}
                  disabled={currentStepId === 1 || isLoadingQuestions || isSubmitting}
                  style={{
                    paddingInline: isSmall ? "var(--space-lg)" : "var(--space-2xl)",
                    paddingBlock: "0",
                    paddingLeft: "0",
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
                    alt=""
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
                  onClick={handleNext}
                  disabled={
                    isLoadingQuestions ||
                    isSubmitting ||
                    !currentGroup ||
                    currentStepId === questionGroups.length
                  }
                  style={{
                    paddingInline: isSmall ? "var(--space-lg)" : "var(--space-2xl)",
                    paddingBlock: "0",
                    paddingRight: "0",
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
                    alt=""
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

              {currentStepId === questionGroups.length ? (
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting || !currentGroup}
                  isLoading={isSubmitting}
                  style={{
                    paddingInline: "var(--space-2xl)",
                    height: isSmall ? "36px" : "42px",
                    fontSize: isSmall ? "13px" : "14px",
                    width: isSmall ? "100%" : "fit-content",
                    marginLeft: isSmall ? 0 : "auto",
                    flex: "none",
                    opacity: !currentGroup || isSubmitting ? 0.55 : 1,
                    marginTop: isSmall ? "8px" : "12px",
                  }}
                >
                  {isSubmitting ? "Finding matches..." : "Finish"}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-center text-[length:var(--text-md)] text-[var(--text-danger)]">
            {error || "Questions are not available for this session."}
          </div>
        )}
      </section>
    </Interview>
  );
}