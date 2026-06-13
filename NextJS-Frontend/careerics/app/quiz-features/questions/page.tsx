"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookmarkReplacePopup from "@/components/ui/bookmarkReplacePopup";
import Interview from "@/components/ui/interview";
import { useAuth } from "@/providers/auth-provider";
import {
  buildCareerQuizSelectionHref,
  buildCareerTrackDetailsHref,
} from "@/lib/career-quiz";
import { createRoadmapUnifiedBookmark } from "@/lib/bookmark-targets";
import {
  normalizeRoadmapListPayload,
  syncBackendRoadmapBookmarksToUnifiedList,
} from "@/lib/roadmap-bookmark-sync";
import { registerTrackRoadmapLinksFromRecommendations } from "@/lib/track-roadmap-links";
import { removeBookmarkEntryFromUnifiedList } from "@/lib/unified-bookmark-actions";
import {
  addOrMoveUnifiedBookmark,
  getUnifiedBookmarks,
  MAX_UNIFIED_BOOKMARKS,
  UNIFIED_BOOKMARKS_UPDATED_EVENT,
} from "@/lib/unified-bookmarks";
import { careerService, roadmapService } from "@/services";
import type {
  APICareerEvaluationRead,
  APICareerQuestionResponse,
  APICareerSelectedCardRead,
  UnifiedBookmarkDraft,
  UnifiedBookmarkEntry,
} from "@/types";
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

type QuizNavButtonProps = {
  direction: "previous" | "next";
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};



export default function CareerQuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const requestedTrackId = searchParams.get("trackId") || "";
  const isResultsView = searchParams.get("view") === "results";
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [currentStepId, setCurrentStepId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [results, setResults] = useState<APICareerEvaluationRead | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [bookmarkedTrackIds, setBookmarkedTrackIds] = useState<string[]>([]);
  const [replaceCandidates, setReplaceCandidates] = useState<UnifiedBookmarkEntry[]>([]);
  const [pendingCareerBookmark, setPendingCareerBookmark] =
    useState<UnifiedBookmarkDraft | null>(null);
  const [isReplacingBookmark, setIsReplacingBookmark] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyUnifiedBookmarks = useCallback((bookmarks: UnifiedBookmarkEntry[]) => {
    setBookmarkedTrackIds(
      bookmarks.flatMap((bookmark) => {
        if (bookmark.kind === "career") {
          return [bookmark.entity_id];
        }

        if (bookmark.kind === "roadmap") {
          return [bookmark.entity_id, bookmark.metadata?.track_id].filter(
            (value): value is string => Boolean(value),
          );
        }

        return [];
      }),
    );
  }, []);

  const getLatestUnifiedBookmarks = useCallback(async (): Promise<UnifiedBookmarkEntry[]> => {
    if (!userId) {
      return getUnifiedBookmarks(userId);
    }

    const [roadmapBookmarksResponse, roadmapListResponse] = await Promise.all([
      roadmapService.getUserRoadmapBookmarks(userId),
      roadmapService.listRoadmaps(),
    ]);

    if (
      !roadmapBookmarksResponse.success ||
      !roadmapBookmarksResponse.data?.bookmarks ||
      !roadmapListResponse.success
    ) {
      return getUnifiedBookmarks(userId);
    }

    return syncBackendRoadmapBookmarksToUnifiedList({
      userId,
      backendBookmarks: roadmapBookmarksResponse.data.bookmarks,
      roadmaps: normalizeRoadmapListPayload(roadmapListResponse.data),
    });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!sessionId) {
        setError("Missing sessionId. Restart the quiz from the career page.");
        setIsLoadingQuestions(false);
        return;
      }

      setIsLoadingQuestions(true);
      setError(null);
      setBookmarkError(null);
      setPendingCareerBookmark(null);
      setReplaceCandidates([]);
      setIsReplacingBookmark(false);

      if (isResultsView) {
        const resultsResponse = await careerService.getCareerResults(sessionId);

        if (cancelled) {
          return;
        }

        if (!resultsResponse.success || !resultsResponse.data) {
          setError(resultsResponse.message || "Unable to load your saved career results.");
          setResults(null);
          setIsFinished(false);
          setIsLoadingQuestions(false);
          return;
        }

        registerTrackRoadmapLinksFromRecommendations(resultsResponse.data.track_scores);
        setResults(resultsResponse.data);
        setQuestionGroups([]);
        setRatings({});
        setCurrentStepId(1);
        setUnlockedStepId(1);
        setIsFinished(true);

        if (!isAuthLoading && userId) {
          const nextBookmarks = await getLatestUnifiedBookmarks();

          if (cancelled) {
            return;
          }

          applyUnifiedBookmarks(nextBookmarks);
        }

        setIsLoadingQuestions(false);
        return;
      }

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
      setResults(null);
      setIsFinished(false);
      setIsLoadingQuestions(false);
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    applyUnifiedBookmarks,
    getLatestUnifiedBookmarks,
    isAuthLoading,
    isResultsView,
    sessionId,
    userId,
  ]);

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

  const displayedTrackScores = results?.track_scores ? [...results.track_scores] : [];

  if (requestedTrackId) {
    displayedTrackScores.sort((left, right) => {
      if (left.track_id === requestedTrackId) {
        return -1;
      }

      if (right.track_id === requestedTrackId) {
        return 1;
      }

      return 0;
    });
  }

  const refreshUnifiedBookmarks = useCallback(() => {
    if (isAuthLoading || !isFinished || !userId) {
      return;
    }

    applyUnifiedBookmarks(getUnifiedBookmarks(userId));
  }, [applyUnifiedBookmarks, isAuthLoading, isFinished, userId]);

  useEffect(() => {
    if (isAuthLoading || !isFinished || !userId || !results?.track_scores?.length) {
      return;
    }

    let cancelled = false;

    const loadBookmarksForResults = async () => {
      const nextBookmarks = await getLatestUnifiedBookmarks();

      if (cancelled) {
        return;
      }

      applyUnifiedBookmarks(nextBookmarks);
    };

    void loadBookmarksForResults();

    return () => {
      cancelled = true;
    };
  }, [applyUnifiedBookmarks, getLatestUnifiedBookmarks, isAuthLoading, isFinished, results, userId]);

  useEffect(() => {
    if (!isFinished) {
      return;
    }

    const handleBookmarksUpdated = () => {
      refreshUnifiedBookmarks();
    };

    window.addEventListener(UNIFIED_BOOKMARKS_UPDATED_EVENT, handleBookmarksUpdated as EventListener);
    window.addEventListener("storage", handleBookmarksUpdated);

    return () => {
      window.removeEventListener(
        UNIFIED_BOOKMARKS_UPDATED_EVENT,
        handleBookmarksUpdated as EventListener,
      );
      window.removeEventListener("storage", handleBookmarksUpdated);
    };
  }, [isFinished, refreshUnifiedBookmarks]);

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
      setResults(evaluateResponse.data);
      setIsFinished(true);
      setIsSubmitting(false);
      return;
    }

    const cachedResponse = await careerService.getCareerResults(sessionId);

    if (cachedResponse.success && cachedResponse.data) {
      registerTrackRoadmapLinksFromRecommendations(cachedResponse.data.track_scores);
      setResults(cachedResponse.data);
      setIsFinished(true);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setError(evaluateResponse.message || cachedResponse.message || "Unable to evaluate your quiz right now.");
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

  const closeReplacePopup = useCallback(() => {
    if (isReplacingBookmark) {
      return;
    }

    setPendingCareerBookmark(null);
    setReplaceCandidates([]);
  }, [isReplacingBookmark]);

  const handleToggleBookmark = async (trackId: string) => {
    const selectedTrack = results?.track_scores.find((item) => item.track_id === trackId);

    if (!selectedTrack) {
      return;
    }

    if (isAuthLoading || !userId) {
      setBookmarkError("Please wait a moment while we load your bookmark list.");
      return;
    }

    setBookmarkError(null);
    const latestBookmarks = await getLatestUnifiedBookmarks();

    const existingBookmark = latestBookmarks.find((bookmark) => {
      if (bookmark.kind === "career") {
        return bookmark.entity_id === trackId;
      }

      return (
        bookmark.kind === "roadmap" &&
        (bookmark.entity_id === selectedTrack.roadmap_id || bookmark.metadata?.track_id === trackId)
      );
    });

    if (existingBookmark) {
      const removal = await removeBookmarkEntryFromUnifiedList(existingBookmark, userId);

      if (!removal.success) {
        setBookmarkError(removal.message || "Unable to remove bookmark right now. Please try again.");
        return;
      }

      applyUnifiedBookmarks(removal.bookmarks);
      return;
    }

    if (!selectedTrack.roadmap_id) {
      setBookmarkError("Unable to resolve a roadmap for this result right now.");
      return;
    }

    const candidate: UnifiedBookmarkDraft = createRoadmapUnifiedBookmark({
      roadmapId: selectedTrack.roadmap_id,
      title: selectedTrack.track_name,
      description: selectedTrack.track_description ?? null,
      savedAt: new Date().toISOString(),
      trackId: selectedTrack.track_id,
      trackName: selectedTrack.track_name,
    });

    if (latestBookmarks.length >= MAX_UNIFIED_BOOKMARKS) {
      setPendingCareerBookmark(candidate);
      setReplaceCandidates(latestBookmarks);
      return;
    }

    const addResponse = await roadmapService.toggleRoadmapBookmark(selectedTrack.roadmap_id, userId);

    if (!addResponse.success || !addResponse.data?.bookmarked) {
      setBookmarkError(addResponse.message || "Unable to save your bookmark right now.");
      return;
    }

    const next = addOrMoveUnifiedBookmark(candidate, userId);
    applyUnifiedBookmarks(next);
  };

  const handleReplaceBookmark = useCallback(
    async (bookmarkToReplace: UnifiedBookmarkEntry) => {
      if (!pendingCareerBookmark) {
        return;
      }

      setBookmarkError(null);
      setIsReplacingBookmark(true);

      const removal = await removeBookmarkEntryFromUnifiedList(bookmarkToReplace, userId);

      if (!removal.success) {
        setBookmarkError(removal.message || "Unable to replace bookmark right now. Please try again.");
        setIsReplacingBookmark(false);
        return;
      }

      if (userId) {
        const addResponse = await roadmapService.toggleRoadmapBookmark(
          pendingCareerBookmark.entity_id,
          userId,
        );

        if (!addResponse.success || !addResponse.data?.bookmarked) {
          if (bookmarkToReplace.kind === "roadmap") {
            await roadmapService.toggleRoadmapBookmark(bookmarkToReplace.entity_id, userId);
          }

          addOrMoveUnifiedBookmark(bookmarkToReplace, userId);
          setBookmarkError(addResponse.message || "Unable to save the new bookmark right now.");
          setIsReplacingBookmark(false);
          return;
        }
      }

      const next = addOrMoveUnifiedBookmark(pendingCareerBookmark, userId);
      applyUnifiedBookmarks(next);
      setPendingCareerBookmark(null);
      setReplaceCandidates([]);
      setIsReplacingBookmark(false);
    },
    [applyUnifiedBookmarks, pendingCareerBookmark, userId],
  );

  const { isSmall, isLarge, isMedium } = useResponsive();

  if (!isFinished) {
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
        <section className="mx-auto flex w-full min-w-0 max-w-[52rem] flex-col items-center gap-[var(--space-xl)]">
          {isLoadingQuestions ? (
            <div className="text-center text-[length:var(--text-md)] text-[var(--text-primary)]">
              Loading quiz questions...
            </div>
          ) : currentGroup ? (
            <>
              <div className="flex w-full min-w-0 flex-col gap-[var(--space-lg)]">
                {currentGroup.questions.map((question) => (
                  <article
                    key={question.id}
                    className="flex w-full min-w-0 flex-col items-center gap-[var(--space-lg)] rounded-[var(--radius-2xl)] border border-[rgba(255,255,255,0.12)] bg-[rgba(61,67,84,0.68)] px-[var(--space-lg)] py-[var(--space-xl)] shadow-sm backdrop-blur-sm sm:px-[var(--space-xl)]"
                  >
                    <p
                      className="m-0 w-full break-words text-center text-[length:var(--text-base)] font-medium leading-[var(--line-normal)] text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                    >
                      {question.text}
                    </p>

                    <div className="flex w-full flex-col items-center justify-center gap-[var(--space-md)] md:flex-row md:gap-[var(--space-lg)]">
                      <span
                        className="text-center text-[length:var(--text-sm)] font-medium text-[var(--light-red)]"
                        style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                      >
                        Strongly Disagree
                      </span>

                      <div className="flex flex-wrap items-center justify-center gap-[var(--space-md)]">
                        {ratingValues.map((value) => {
                          const isSelected = ratings[question.id] === value;

                          return (
                            <button
                              key={value}
                              type="button"
                              aria-label={`Rate ${value} out of 5`}
                              aria-pressed={isSelected}
                              onClick={() => handleRate(question.id, value)}
                              className={getRatingButtonClass(value, isSelected)}
                            />
                          );
                        })}
                      </div>

                      <span
                        className="text-center text-[length:var(--text-sm)] font-medium text-[var(--light-green)]"
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
                    onClick={() => {
                      setCurrentStepId((prev) => Math.max(1, prev - 1));
                      setError(null);
                    }}
                    disabled={currentStepId === 1 || isLoadingQuestions || isSubmitting}
                    style={{
                      paddingInline: "var(--space-2xl)",
                      paddingBlock: "0",
                      paddingLeft: "0",
                      gap: "var(--space-xl)",
                      height: "fit-content",
                      width: "fit-content",
                      maxWidth: isSmall ? "100%" : "fit-content",
                      flex: isSmall ? 1 : "none",
                      justifyContent: "space-between",
                      borderRadius: "999px",
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
                    onClick={handleNext}
                    disabled={isLoadingQuestions || isSubmitting || !currentGroup || (currentStepId === questionGroups.length)}
                    
                    style={{
                      paddingInline: "var(--space-2xl)",
                      paddingBlock: "0",
                      paddingRight: "0",
                      gap: "var(--space-xl)",
                      height: "fit-content",
                      width: "fit-content",
                      maxWidth: isSmall ? "100%" : "fit-content",
                      flex: isSmall ? 1 : "none",
                      justifyContent: "space-between",
                      borderRadius: "999px",
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
                {(currentStepId === questionGroups.length) &&
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting || !currentGroup}
                    isLoading={isSubmitting}
                    style={{
                      paddingInline: "var(--space-2xl)",
                      paddingBlock: "var(--space-xxs)",
                      height: "fit-content",
                      width: isSmall ? "100%" : "fit-content",
                      marginLeft: isSmall ? 0 : "auto",
                      flex: "none",
                      opacity: !currentGroup || isSubmitting ? 0.55 : 1,
                    }}
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : "Finish"
                    }
                  </Button>
                }
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

  return (
    <section className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden px-[var(--space-xl)] pb-[var(--space-xl)] pt-[calc(var(--icon-lg)+var(--space-2xl))] sm:px-[var(--space-2xl)]">
      <header className="mx-auto flex w-full max-w-[72rem] shrink-0 flex-col items-center text-center">
        <h1
          className="m-0 text-center text-[length:var(--text-2xl)] font-semibold leading-[var(--line-tight)] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
        >
          Your Best Matches Are
        </h1>

        {bookmarkError ? (
          <p className="m-0 mt-[var(--space-sm)] max-w-[42rem] text-center text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-danger)]">
            {bookmarkError}
          </p>
        ) : null}
      </header>

      <main className="flex min-h-0 w-full items-start justify-center overflow-y-auto px-[var(--space-xs)] py-[var(--space-lg)] sm:items-center sm:px-0 sm:py-[var(--space-2xl)]">
        {displayedTrackScores.length ? (
          <div className="grid w-full max-w-[72rem] grid-cols-1 justify-items-center gap-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-3">
            {displayedTrackScores.slice(0, 3).map((track) => {
              const isBookmarked =
                bookmarkedTrackIds.includes(track.track_id) ||
                (track.roadmap_id ? bookmarkedTrackIds.includes(track.roadmap_id) : false);

              return (
                <article
                  key={track.track_id}
                  className="relative flex min-h-[20rem] w-full max-w-[19.5rem] flex-col rounded-[var(--radius-2xl)] bg-[var(--medium-blue)] px-[var(--space-lg)] py-[var(--space-lg)] shadow-sm sm:min-h-[23rem] sm:max-w-[20rem] sm:px-[var(--space-xl)] sm:py-[var(--space-xl)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleBookmark(track.track_id);
                    }}
                    disabled={isReplacingBookmark || isAuthLoading || !userId}
                    aria-label={isBookmarked ? "Remove bookmark" : "Bookmark track"}
                    className="absolute right-[var(--space-lg)] top-[var(--space-lg)] flex h-[var(--min-touch-target)] w-[var(--min-touch-target)] items-center justify-center rounded-full bg-transparent text-[var(--text-primary)] transition hover:bg-[rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Bookmark
                      size={22}
                      strokeWidth={2.1}
                      className={isBookmarked ? "fill-current text-[var(--light-green)]" : undefined}
                    />
                  </button>

                  <Image
                    src="/landing/Rectangle.svg"
                    alt=""
                    width={118}
                    height={118}
                    className="h-auto w-[7.4rem] shrink-0"
                  />

                  <h2
                    className="m-0 mt-[var(--space-md)] pr-[var(--space-xl)] text-[length:var(--text-lg)] font-semibold leading-[var(--line-tight)] text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
                  >
                    {track.track_name}
                  </h2>

                  <p className="m-0 mt-[var(--space-md)] text-[length:var(--text-sm)] font-bold text-[var(--light-green)]">
                    Match Score: {track.score}%
                  </p>

                  <p className="m-0 mt-[var(--space-md)] line-clamp-3 flex-1 text-[length:var(--text-sm)] leading-[var(--line-relaxed)] text-[var(--text-secondary)]">
                    {track.track_description ||
                      "This track aligns strongly with your selected cards and responses."}
                  </p>

                  <Link
                    href={buildCareerTrackDetailsHref(track.track_name, track.track_id)}
                    className="mt-[var(--space-lg)] block"
                  >
                    <Button variant="secondary" size="md" className="w-full rounded-[var(--radius-lg)]">
                      Learn More
                    </Button>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[length:var(--text-base)] text-[var(--text-primary)]">
            No career matches were found for this quiz.
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-[32rem] shrink-0 flex-col items-stretch justify-center gap-[var(--space-md)] sm:flex-row sm:items-center">
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            if (sessionId) {
              router.push(buildCareerQuizSelectionHref(sessionId));
            } else {
              router.push("/features/career");
            }
          }}
          className="w-full rounded-[var(--radius-lg)] sm:w-auto sm:min-w-[10rem]"
        >
          Retake Quiz
        </Button>

        <Link href="/features/home" className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="md"
            className="w-full rounded-[var(--radius-lg)] sm:min-w-[10rem]"
          >
            Back to Home
          </Button>
        </Link>
      </footer>

      {pendingCareerBookmark ? (
        <BookmarkReplacePopup
          incomingTitle={pendingCareerBookmark.title}
          bookmarks={replaceCandidates}
          isLoading={isReplacingBookmark}
          onReplace={(bookmark) => {
            void handleReplaceBookmark(bookmark);
          }}
          onCancel={closeReplacePopup}
        />
      ) : null}
    </section>
  );
}