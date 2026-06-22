"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookmarkReplacePopup from "@/components/ui/bookmarkReplacePopup";
import { useAuth } from "@/providers/auth-provider";
import {
  buildCareerQuizSelectionHref,
  buildCareerTrackDetailsHref,
} from "@/lib/career-quiz";
import { buildJourneyPhaseHref, syncSelectedJourneyTrackProgress } from "@/lib/journey";
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
  UnifiedBookmarkDraft,
  UnifiedBookmarkEntry,
} from "@/types";

export default function CareerQuizResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const requestedTrackId = searchParams.get("trackId") || "";
  const origin = searchParams.get("origin") || "";
  const returnTo = searchParams.get("returnTo") || "";
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [results, setResults] = useState<APICareerEvaluationRead | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
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

    const loadResults = async () => {
      if (!sessionId) {
        setError("Missing sessionId. Restart the quiz from the career page.");
        setIsLoadingResults(false);
        return;
      }

      setIsLoadingResults(true);
      setError(null);
      setBookmarkError(null);
      setPendingCareerBookmark(null);
      setReplaceCandidates([]);
      setIsReplacingBookmark(false);

      const resultsResponse = await careerService.getCareerResults(sessionId);

      if (cancelled) {
        return;
      }

      if (!resultsResponse.success || !resultsResponse.data) {
        setError(resultsResponse.message || "Unable to load your saved career results.");
        setResults(null);
        setIsLoadingResults(false);
        return;
      }

      registerTrackRoadmapLinksFromRecommendations(resultsResponse.data.track_scores);
      setResults(resultsResponse.data);
      setIsLoadingResults(false);
    };

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const refreshUnifiedBookmarks = useCallback(() => {
    if (isAuthLoading || !userId) {
      return;
    }

    applyUnifiedBookmarks(getUnifiedBookmarks(userId));
  }, [applyUnifiedBookmarks, isAuthLoading, userId]);

  useEffect(() => {
    if (isAuthLoading || !userId || !results?.track_scores?.length) {
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
  }, [applyUnifiedBookmarks, getLatestUnifiedBookmarks, isAuthLoading, results, userId]);

  useEffect(() => {
    if (!results?.track_scores?.length) {
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
  }, [refreshUnifiedBookmarks, results]);

  const displayedTrackScores = useMemo(() => {
    const nextScores = results?.track_scores ? [...results.track_scores] : [];

    if (requestedTrackId) {
      nextScores.sort((left, right) => {
        if (left.track_id === requestedTrackId) {
          return -1;
        }

        if (right.track_id === requestedTrackId) {
          return 1;
        }

        return 0;
      });
    }

    return nextScores;
  }, [requestedTrackId, results]);

  const closeReplacePopup = useCallback(() => {
    if (isReplacingBookmark) {
      return;
    }

    setPendingCareerBookmark(null);
    setReplaceCandidates([]);
  }, [isReplacingBookmark]);

  const ensureTrackJourneyStartsAtPhaseTwo = useCallback(
    async (trackId: string, roadmapId?: string | null) => {
      if (!trackId) {
        return;
      }

      await syncSelectedJourneyTrackProgress({
        trackId,
        userId,
        roadmapId: roadmapId ?? null,
        maxReached: 2,
      });
    },
    [userId],
  );

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
    await ensureTrackJourneyStartsAtPhaseTwo(selectedTrack.track_id, selectedTrack.roadmap_id);
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
      await ensureTrackJourneyStartsAtPhaseTwo(
        pendingCareerBookmark.metadata?.track_id || "",
        pendingCareerBookmark.entity_id,
      );
      setPendingCareerBookmark(null);
      setReplaceCandidates([]);
      setIsReplacingBookmark(false);
    },
    [applyUnifiedBookmarks, ensureTrackJourneyStartsAtPhaseTwo, pendingCareerBookmark, userId],
  );

  if (isLoadingResults) {
    return (
      <section className="flex h-full min-h-0 w-full items-center justify-center px-[var(--space-xl)]">
        <div className="text-center text-[length:var(--text-md)] text-[var(--text-primary)]">
          Loading your career results...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex h-full min-h-0 w-full items-center justify-center px-[var(--space-xl)]">
        <div className="text-center text-[length:var(--text-md)] text-[var(--text-danger)]">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden px-[var(--space-xl)] pb-[var(--space-xl)] pt-[calc(var(--icon-lg)+var(--space-2xl))] sm:px-[var(--space-2xl)]">
      <header className="mx-auto flex w-full max-w-[72rem] shrink-0 flex-col items-center text-center">
        <h1
          className="m-0 text-center text-[length:var(--text-2xl)] leading-[var(--line-tight)] text-[var(--text-primary)]"
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
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "20rem",
                    width: "100%",
                    maxWidth: "17.5rem",
                    borderRadius: "var(--radius-2xl)",
                    backgroundColor: "var(--medium-blue)",
                    padding: "var(--space-lg)",
                  }}
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

                  <img
                    src={`/tracks/${track.track_id}.svg`}
                    alt=""
                    style={{
                      height: "var(--icon-2xl)",
                      marginRight: "auto",
                    }}
                  />


                  <h2
                    className="m-0 mt-[var(--space-md)] pr-[var(--space-xl)] text-[length:var(--text-lg)] leading-[var(--line-tight)] text-[var(--text-primary)]"
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
                    href={
                      isBookmarked
                        ? buildJourneyPhaseHref(2, track.track_id)
                        : buildCareerTrackDetailsHref(track.track_name, track.track_id)
                    }
                    className="mt-[var(--space-lg)] block"
                  >
                    <Button variant="secondary" size="md" className="w-full rounded-[var(--radius-lg)]">
                      {isBookmarked ? "Continue to Journey" : "Learn More"}
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
              router.push(
                buildCareerQuizSelectionHref(sessionId, {
                  origin,
                  returnTo,
                }),
              );
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
