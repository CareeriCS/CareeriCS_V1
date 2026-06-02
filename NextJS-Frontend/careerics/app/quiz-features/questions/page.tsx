"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

interface QuestionGroup {
  groupId: string;
  title: string;
  cardType: "hobby" | "technical";
  questions: APICareerQuestionResponse[];
}

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
  const [pendingCareerBookmark, setPendingCareerBookmark] = useState<UnifiedBookmarkDraft | null>(null);
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
  }, [applyUnifiedBookmarks, getLatestUnifiedBookmarks, isAuthLoading, isResultsView, sessionId, userId]);

  const sidebarSteps = useMemo(() => {
    return questionGroups.map((group, index) => ({
      id: index + 1,
      title: group.title,
      text: `${group.questions.length} question${group.questions.length === 1 ? "" : "s"}`,
    }));
  }, [questionGroups]);

  const allQuestions = useMemo(() => {
    return questionGroups.flatMap((group) => group.questions);
  }, [questionGroups]);

  const currentGroup = questionGroups[currentStepId - 1] || null;
  const allAnswered = allQuestions.length > 0 && allQuestions.every((question) => Boolean(ratings[question.id]));
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

    // Fallback if evaluation already exists for this session.
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

  if (!isFinished) {
    return (
      <Interview
          questions={sidebarSteps.map(step => ({ ...step, text: "" }))}
          currentActiveId={currentStepId}
          unlockedStepId={currentStepId} 
          onQuestionClick={(id) => {
            if (id <= (unlockedStepId ?? 0)) {
              setCurrentStepId(id);
            }
          }}
          title="Career Quiz"
          label="Step"
        >
        <div
          style={{
            width: "100%",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            padding: "5vh 4vw",
            boxSizing: "border-box",
            gap: "3vh",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "2vh",
              justifyContent: "center",
              overflowY: "auto",
            }}
          >
            {isLoadingQuestions ? (
              <div style={{ color: "#E5E7EB", textAlign: "center", fontSize: "2.2vh" }}>
                Loading quiz questions...
              </div>
            ) : currentGroup ? (
              <>
                {currentGroup.questions.map((question) => (
                  <div
                    key={question.id}
                    style={{
                      backgroundColor: "#222939",
                      borderRadius: "4vh",
                      padding: "4vh 2vw",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2.5vh",
                      border: "0.1vh solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <p
                      style={{
                        color: "#D1D5DB",
                        fontSize: "2.2vh",
                        fontFamily: "var(--font-nova-square)",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {question.text}
                    </p>

                    <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2.5vw",
                          flexWrap: "wrap",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ color: "#FFB2B2", fontSize: "2.2vh", fontWeight: 600 }}>
                          Strongly Disagree
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: "1.8vw" }}>
                          {[1, 2, 3, 4, 5].map((value) => {
                            const sizes = ["5vh", "4vh", "2.8vh", "4vh", "5vh"];
                            const isSelected = ratings[question.id] === value;

                            const getCircleColor = (val: number, selected: boolean) => {
                              if (!selected) return "#6B7280"; 
                              
                              switch (val) {
                                case 1: return "#FF4D4D"; // Red
                                case 2: return "#FF8585"; // Light Red
                                case 3: return "#3B82F6"; // Blue
                                case 4: return "#D9FF8F"; // Light Neon
                                case 5: return "#B8EF46"; // Neon Green
                                default: return "#6B7280";
                              }
                            };

                            return (
                              <div
                                key={value}
                                onClick={() => handleRate(question.id, value)}
                                style={{
                                  width: sizes[value - 1],
                                  height: sizes[value - 1],
                                  borderRadius: "50%",
                                  backgroundColor: getCircleColor(value, isSelected),
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                  transform: isSelected ? "scale(1.15)" : "scale(1)",
                                 
                                }}
                              />
                            );
                          })}
                        </div>

                        <span style={{ color: "#E6FFB2", fontSize: "2.2vh", fontWeight: 600 }}>
                          Strongly Agree
                        </span>
                      </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: "#FFD3D3", textAlign: "center", fontSize: "2.2vh" }}>
                {error || "Questions are not available for this session."}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "1.2vh" }}>
            {error ? (
              <p style={{ color: "#FFD3D3", margin: 0, fontSize: "1.9vh" }}>
                {error}
              </p>
            ) : null}

<div style={{ 
  display: "flex", 
  justifyContent: "space-between", 
  width: "50%", 
  gap: "1.2vh",
  marginTop: "2vh",
  position:"relative",
  left:"31vw"
}}>
  
  {/* Previous Button */}
  <Button
  variant="primary-inverted"
    onClick={() => setCurrentStepId((prev) => Math.max(1, prev - 1))}
    disabled={currentStepId === 1 || isLoadingQuestions || isSubmitting}
    style={{

      color: "black",
      border: "1px solid #6B7280",
      padding: "1.5vh 4vw",
      borderRadius: "1.2vh",
      fontSize: "2vh",
      fontWeight: 600,
      height: "auto",
      minWidth: "12vw",
      cursor: currentStepId === 1 ? "not-allowed" : "pointer",
      opacity: currentStepId === 1 ? 0.4 : 1,
      visibility: currentStepId === 1 ? "hidden" : "visible", 
    }}
  >
    Back
  </Button>

  {/* Next/Finish Button */}
  <Button
  variant="primary"
    onClick={handleNext}
    disabled={isLoadingQuestions || isSubmitting || !currentGroup}
    style={{
      color: "#000",
      padding: "1.5vh 5vw",
      borderRadius: "1.2vh",
      fontSize: "2.2vh",
      fontWeight: 800,
      height: "auto",
      minWidth: "5vw",
      opacity: isLoadingQuestions || isSubmitting || !currentGroup ? 0.6 : 1,
    }}
  >
    {isSubmitting ? "Submitting..." : currentStepId === questionGroups.length ? "Finish" : "Next"}
  </Button>
</div>
          </div>
        </div>
      </Interview>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "5vh",
        padding: "2rem",
      }}
    >
      <h1 style={{ color: "#fff", fontSize: "5vh", fontFamily: "var(--font-nova-square)", margin: 0 }}>
        Your Best Matches Are
      </h1>

      {bookmarkError ? (
        <p style={{ margin: 0, color: "#FFD3D3", fontSize: "2vh", textAlign: "center" }}>
          {bookmarkError}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "1.3rem",
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
          maxWidth: "1200px",
        }}
      >
        {displayedTrackScores.map((track) => (
          <div
            key={track.track_id}
            style={{
              width: "min(320px, 90vw)",
              backgroundColor: "var(--medium-blue)",
              borderRadius: "3vh",
              padding: "4vh 1.3rem 3.2vh 1.3rem",
              display: "flex",
              flexDirection: "column",
              gap: "5vh",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => {
                void handleToggleBookmark(track.track_id);
              }}
              disabled={isReplacingBookmark || isAuthLoading || !userId}
              aria-label={
                bookmarkedTrackIds.includes(track.track_id) ||
                (track.roadmap_id ? bookmarkedTrackIds.includes(track.roadmap_id) : false)
                  ? "Remove bookmark"
                  : "Bookmark track"
              }
              style={{
                position: "absolute",
                top: "2.5vh",
                right: "1rem",
                width: "5vh",
                height: "5vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                cursor:
                  isReplacingBookmark || isAuthLoading || !userId ? "not-allowed" : "pointer",
                color:
                  bookmarkedTrackIds.includes(track.track_id) ||
                  (track.roadmap_id ? bookmarkedTrackIds.includes(track.roadmap_id) : false)
                    ? "#D4EF9F"
                    : "#EAF1FF",
                padding: 0,
                opacity: isReplacingBookmark || isAuthLoading || !userId ? 0.65 : 1,
              }}
            >
              <Bookmark
                size={20}
                strokeWidth={2.1}
                className={
                  bookmarkedTrackIds.includes(track.track_id) ||
                  (track.roadmap_id ? bookmarkedTrackIds.includes(track.roadmap_id) : false)
                    ? "fill-current"
                    : undefined
                }
              />
            </button>

            <img
              src="/landing/Rectangle.svg"
              alt={track.track_name}
              style={{ width: "15vh", height: "auto", alignSelf: "flex-start" }}
            />

            <h2 style={{ color: "#fff", fontSize: "3vh", margin: 0, fontFamily: "var(--font-nova-square)" }}>
              {track.track_name}
            </h2>

            <p style={{ margin: 0, color: "var(--light-green)", fontWeight: 700, fontSize: "2vh" }}>
              Match Score: {track.score}%
            </p>

            <p style={{ color: "#A0AEC0", fontSize: "1.9vh", margin: 0, lineHeight: "1.4" }}>
              {track.track_description || "This track aligns strongly with your selected cards and responses."}
            </p>

            <Link
              href={buildCareerTrackDetailsHref(track.track_name, track.track_id)}
              style={{ textDecoration: "none" }}
            >
              <Button
              variant="secondary"
                style={{
                  color: "#000000",
                  padding: "2vh 2vw",
                  height: "6vh",
                  width: "100%",
                  borderRadius: "1vh",
                  marginTop: "1vh",
                  fontSize: "2vh",
                  minHeight: "0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Learn More
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "2vw", flexWrap: "wrap", justifyContent: "center" }}>
        <Button
        variant="secondary"
          onClick={() => {
            if (sessionId) {
              router.push(buildCareerQuizSelectionHref(sessionId));
            } else {
              router.push("/features/career");
            }
          }}
          style={{
            color: "#000",
            padding: "1vh 4vw",
            borderRadius: "1.5vh",
            height: "auto",
            fontWeight: 800,
          }}
        >
          Redo Quiz
        </Button>

        <Link href="/features/home" style={{ textDecoration: "none" }}>
          <Button
          variant="primary"
            style={{
          
              color: "#000",
              padding: "0 3vw",
              height: "6vh",
              borderRadius: "1.5vh",
              fontSize: "2vh",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
              width: "fit-content",
            }}
          >
            Go Back Home
          </Button>
        </Link>
      </div>

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
    </div>
  );
}
