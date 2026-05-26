"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ChoiceCard from "@/components/ui/choice-card-career";
import BookmarkReplacePopup from "@/components/ui/bookmarkReplacePopup";
import { useAuth } from "@/providers/auth-provider";
import { careerService, roadmapService } from "@/services";
import {
  buildCareerQuizSelectionHref,
  startCareerQuizSession,
} from "@/lib/career-quiz";
import {
  createCareerUnifiedBookmark,
  createRoadmapUnifiedBookmark,
} from "@/lib/bookmark-targets";
import { normalizeRoadmapListPayload, syncBackendRoadmapBookmarksToUnifiedList } from "@/lib/roadmap-bookmark-sync";
import {
  registerTrackRoadmapLink,
  resolveRoadmapLinkForTrack,
} from "@/lib/track-roadmap-links";
import { removeBookmarkEntryFromUnifiedList } from "@/lib/unified-bookmark-actions";
import {
  addOrMoveUnifiedBookmark,
  getUnifiedBookmarks,
  MAX_UNIFIED_BOOKMARKS,
} from "@/lib/unified-bookmarks";

import type {
  APICareerTrack,
  RoadmapListItem,
  UnifiedBookmarkDraft,
  UnifiedBookmarkEntry,
} from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import { CareerCardsContainer } from "@/components/ui/containers/career";
import TipCard from "@/components/ui/3ateyat";

const VISIBLE_TRACKS_COUNT = 4;
const TRACK_DESCRIPTION_FALLBACK =
  "Explore this path and see what the day-to-day work, opportunities, and growth can look like.";

function buildTrackBlogPath(track: APICareerTrack) {
  const params = new URLSearchParams({
    jobTitle: track.name,
    trackId: track.id,
  });

  return `/quiz-features/blog?${params.toString()}`;
}

export default function CareerDiscoveryPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [careerTracks, setCareerTracks] = useState<APICareerTrack[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [pendingCareerBookmark, setPendingCareerBookmark] = useState<UnifiedBookmarkDraft | null>(null);
  const [replaceCandidates, setReplaceCandidates] = useState<UnifiedBookmarkEntry[]>([]);
  const [isReplacingBookmark, setIsReplacingBookmark] = useState(false);
  const [unifiedBookmarks, setUnifiedBookmarks] = useState<UnifiedBookmarkEntry[]>([]);

  const [startIndex, setStartIndex] = useState(0);
  useEffect(() => {
    let alive = true;

    const loadBookmarks = async () => {
      if (isAuthLoading) {
        return;
      }

      let nextBookmarks: UnifiedBookmarkEntry[] = [];

      if (!userId) {
        nextBookmarks = getUnifiedBookmarks(userId);
      }

      if (userId && roadmaps.length) {
        const backendBookmarksResponse = await roadmapService.getUserRoadmapBookmarks(userId);
        if (backendBookmarksResponse.success && backendBookmarksResponse.data?.bookmarks) {
          nextBookmarks = syncBackendRoadmapBookmarksToUnifiedList({
            userId,
            backendBookmarks: backendBookmarksResponse.data.bookmarks,
            roadmaps,
          });
        }
      }

      if (!alive) {
        return;
      }

      setUnifiedBookmarks(nextBookmarks);
    };

    void loadBookmarks();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, roadmaps, userId]);

  const bookmarkedTrackIds = useMemo(() => {
    return unifiedBookmarks.flatMap((bookmark) => {
      if (bookmark.kind === "career") {
        return [bookmark.entity_id];
      }

      if (bookmark.kind === "roadmap") {
        return [bookmark.metadata?.track_id].filter((value): value is string => Boolean(value));
      }

      return [];
    });
  }, [unifiedBookmarks]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setIsLoadingTracks(true);

      const [tracksResponse, roadmapsResponse] = await Promise.all([
        careerService.listTracks(),
        roadmapService.listRoadmaps(),
      ]);
      if (!alive) return;

      if (!tracksResponse.success || !tracksResponse.data) {
        setCareerTracks([]);
        setTracksError(tracksResponse.message || "Failed to load tracks.");
        setRoadmaps([]);
        setIsLoadingTracks(false);
        return;
      }

      setCareerTracks(tracksResponse.data);
      setRoadmaps(
        roadmapsResponse.success ? normalizeRoadmapListPayload(roadmapsResponse.data) : [],
      );
      setTracksError(null);
      setIsLoadingTracks(false);
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const maxStartIndex = Math.max(0, careerTracks.length - VISIBLE_TRACKS_COUNT);
  const safeStartIndex = Math.min(startIndex, maxStartIndex);

  const visibleCards = useMemo(
    () => careerTracks,
    [careerTracks, safeStartIndex],
  );


  const closeReplacePopup = useCallback(() => {
    if (isReplacingBookmark) {
      return;
    }

    setPendingCareerBookmark(null);
    setReplaceCandidates([]);
  }, [isReplacingBookmark]);

  const handleToggleBookmark = async (track: APICareerTrack) => {
    if (isAuthLoading || isReplacingBookmark) {
      return;
    }

    setBookmarkError(null);

    const resolvedRoadmapLink = resolveRoadmapLinkForTrack({
      trackId: track.id,
      trackTitle: track.name,
      roadmaps,
    });
    const resolvedRoadmapId = resolvedRoadmapLink?.roadmapId?.trim() || "";

    if (resolvedRoadmapId) {
      registerTrackRoadmapLink({
        trackId: track.id,
        roadmapId: resolvedRoadmapId,
        trackName: track.name,
        roadmapTitle: resolvedRoadmapLink?.roadmapTitle || null,
      });
    }

    let latestBookmarks = unifiedBookmarks;
    let backendRoadmapIds = new Set<string>();
    let backendBookmarksLoaded = !userId;

    if (userId && roadmaps.length) {
      const backendBookmarksResponse = await roadmapService.getUserRoadmapBookmarks(userId);

      if (backendBookmarksResponse.success && backendBookmarksResponse.data?.bookmarks) {
        backendBookmarksLoaded = true;
        backendRoadmapIds = new Set(
          backendBookmarksResponse.data.bookmarks.map((bookmark) => String(bookmark.roadmap_id)),
        );
        latestBookmarks = syncBackendRoadmapBookmarksToUnifiedList({
          userId,
          backendBookmarks: backendBookmarksResponse.data.bookmarks,
          roadmaps,
        });
      }
    }

    const existingBookmark = latestBookmarks.find((bookmark) => {
      if (bookmark.kind === "career") {
        return (
          bookmark.entity_id === track.id ||
          (resolvedRoadmapId ? bookmark.metadata?.roadmap_id === resolvedRoadmapId : false)
        );
      }

      return bookmark.kind === "roadmap" && (
        bookmark.metadata?.track_id === track.id ||
        bookmark.entity_id === resolvedRoadmapId
      );
    });

    if (existingBookmark) {
      const removal = await removeBookmarkEntryFromUnifiedList(existingBookmark, userId);
      if (!removal.success) {
        setBookmarkError(removal.message || "Unable to update bookmark right now. Please try again.");
        return;
      }
      setUnifiedBookmarks(removal.bookmarks);
      return;
    }

    if (resolvedRoadmapId && userId && !backendBookmarksLoaded) {
      setBookmarkError("Unable to sync roadmap bookmarks right now. Please try again.");
      return;
    }

    const candidate = resolvedRoadmapId
      ? createRoadmapUnifiedBookmark({
        roadmapId: resolvedRoadmapId,
        title: resolvedRoadmapLink?.roadmapTitle || track.name,
        description: track.description ?? null,
        savedAt: new Date().toISOString(),
        trackId: track.id,
        trackName: track.name,
      })
      : createCareerUnifiedBookmark({
        trackId: track.id,
        title: track.name,
        description: track.description ?? null,
        savedAt: new Date().toISOString(),
      });

    if (latestBookmarks.length >= MAX_UNIFIED_BOOKMARKS) {
      setPendingCareerBookmark(candidate);
      setReplaceCandidates(latestBookmarks);
      return;
    }

    if (resolvedRoadmapId && userId && !backendRoadmapIds.has(resolvedRoadmapId)) {
      const addResponse = await roadmapService.toggleRoadmapBookmark(resolvedRoadmapId, userId);
      if (!addResponse.success || !addResponse.data?.bookmarked) {
        setBookmarkError(addResponse.message || "Unable to save bookmark right now. Please try again.");
        return;
      }
    }

    const next = addOrMoveUnifiedBookmark(candidate, userId);
    setUnifiedBookmarks(next);
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

      if (pendingCareerBookmark.kind === "roadmap" && userId) {
        const backendBookmarksResponse = await roadmapService.getUserRoadmapBookmarks(userId);
        if (!backendBookmarksResponse.success || !backendBookmarksResponse.data?.bookmarks) {
          if (bookmarkToReplace.kind === "roadmap") {
            await roadmapService.toggleRoadmapBookmark(bookmarkToReplace.entity_id, userId);
          }

          const restored = addOrMoveUnifiedBookmark(bookmarkToReplace, userId);
          setUnifiedBookmarks(restored);
          setBookmarkError("Unable to sync roadmap bookmarks right now. Please try again.");
          setIsReplacingBookmark(false);
          return;
        }

        const alreadyInBackend = backendBookmarksResponse.data.bookmarks.some((bookmark) => {
          return String(bookmark.roadmap_id) === pendingCareerBookmark.entity_id;
        });

        if (!alreadyInBackend) {
          const addResponse = await roadmapService.toggleRoadmapBookmark(
            pendingCareerBookmark.entity_id,
            userId,
          );
          if (!addResponse.success || !addResponse.data?.bookmarked) {
            if (bookmarkToReplace.kind === "roadmap") {
              await roadmapService.toggleRoadmapBookmark(bookmarkToReplace.entity_id, userId);
            }

            const restored = addOrMoveUnifiedBookmark(bookmarkToReplace, userId);
            setUnifiedBookmarks(restored);
            setBookmarkError(addResponse.message || "Unable to save the new bookmark right now.");
            setIsReplacingBookmark(false);
            return;
          }
        }
      }

      const next = addOrMoveUnifiedBookmark(pendingCareerBookmark, userId);
      setUnifiedBookmarks(next);
      setPendingCareerBookmark(null);
      setReplaceCandidates([]);
      setIsReplacingBookmark(false);
    },
    [pendingCareerBookmark, userId],
  );

  const handleStartQuiz = async () => {
    if (isStartingQuiz || isAuthLoading) return;

    if (!user?.id) {
      router.push("/auth/login?redirect=/features/career");
      return;
    }

    try {
      setStartError(null);
      setIsStartingQuiz(true);

      const sessionId = await startCareerQuizSession(user.id);

      router.push(buildCareerQuizSelectionHref(sessionId));
    } catch (e) {
      setIsStartingQuiz(false);
      setStartError(
        e instanceof Error
          ? e.message
          : "Failed to start quiz. Try again."
      );
    }
  };

  const { isLarge, isMedium, isSmall } = useResponsive();
  // ---------------- UI ----------------
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        padding: "var(--space-xl)",
        gridRowGap: "var(--space-lg)",
        gridColumnGap: "var(--space-lg)",
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: !isLarge ? "1fr 4fr" : "1fr 2fr",
        overflow: "hidden",
      }}
    >
      {/* HERO */}
      <TipCard
        variant="feature"
        onclick={handleStartQuiz}
        style={{
          gridArea: "1 / 1 / 2 / 2",
          backgroundColor: "var(--dark-blue)",
        }}
        icon="/tracks/career-quiz.svg"
        title="Start career quiz"
        description={
          "Choose your interests and answer a few questions. Get career matches instantly."
        }
      />


      {/* TRACKS */}
      <CareerCardsContainer
        type="career"
        columns={isSmall ? 2 : isMedium ? 3 : 4}
        isScrollable
        Title="Discover more career paths"
        style={{
          gridArea: "2 / 1 / 3 / 2",
          backgroundColor: "var(--medium-blue)",
        }}
      >
        {isLoadingTracks && (
          <div style={{ color: "#D7E3FF" }}>Loading tracks...</div>
        )}

        {!isLoadingTracks && tracksError && (
          <div style={{ color: "#FFD3D3" }}>{tracksError}</div>
        )}

        {!isLoadingTracks &&
          !tracksError &&
          visibleCards.length === 0 && (
            <div style={{ color: "#d7ffdd" }}>
              No career tracks available.
            </div>
          )}

        {!isLoadingTracks && !tracksError && !visibleCards.length ? (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d7ffdd",
              fontFamily: "var(--font-jura)",
              fontSize: "1rem",
            }}
          >
            No career tracks are available yet.
          </div>
        ) : null}

        {!isLoadingTracks && !tracksError
          ? visibleCards.map((track) => {
            const blogPath = buildTrackBlogPath(track);

            return (
              <ChoiceCard
                key={track.id}
                title={track.name}
                description={track.description || TRACK_DESCRIPTION_FALLBACK}
                image={`/tracks/${track.id}.svg`}
                buttonVariant="primary-inverted"
                buttonLabel="Learn More"
                onClick={() => router.push(blogPath)}
                onBookmark={() => {
                  void handleToggleBookmark(track);
                }}
                isBookmarked={bookmarkedTrackIds.includes(track.id)}
              />
            );
          })
          : null}


      </CareerCardsContainer>


      {
        pendingCareerBookmark ? (
          <BookmarkReplacePopup
            incomingTitle={pendingCareerBookmark.title}
            bookmarks={replaceCandidates}
            isLoading={isReplacingBookmark}
            onReplace={(bookmark) => {
              void handleReplaceBookmark(bookmark);
            }}
            onCancel={closeReplacePopup}
          />
        ) : null
      }
    </div >
  );
}
