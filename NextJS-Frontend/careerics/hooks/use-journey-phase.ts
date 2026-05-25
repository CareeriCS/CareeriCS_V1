"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";
import { UNIFIED_BOOKMARKS_UPDATED_EVENT } from "@/lib/unified-bookmarks";
import {
  JOURNEY_PHASE_STATE_UPDATED_EVENT,
  getJourneyPhaseStateFromSnapshot,
  loadJourneyProgressSnapshot,
  type JourneyProgressSnapshot,
  type JourneyPhaseNumber,
  type JourneyPhaseState,
  type JourneyTrackCard,
  getTrackById,
  invalidateJourneyTrackCardsCache,
  loadJourneyTrackCards,
  persistSelectedJourneyTrackId,
  readSelectedJourneyTrackId,
  syncSelectedJourneyTrackProgress,
  visitJourneyPhase,
} from "@/lib/journey";

type UseJourneyPhaseState = {
  tracks: JourneyTrackCard[];
  selectedTrack: JourneyTrackCard | null;
  selectedTrackId: string | null;
  phaseState: JourneyPhaseState;
  maxReached: JourneyPhaseNumber;
  isLoadingTracks: boolean;
  trackError: string | null;
  queryTrackId: string | null;
};

function normalizeTrackId(value: string | null): string | null {
  const normalized = (value || "").trim();
  return normalized.length ? normalized : null;
}

export function useJourneyPhase(
  currentPhase: JourneyPhaseNumber,
): UseJourneyPhaseState {
  const searchParams = useSearchParams();
  const queryTrackId = normalizeTrackId(searchParams.get("trackId"));

  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [tracks, setTracks] = useState<JourneyTrackCard[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [journeyProgressSnapshot, setJourneyProgressSnapshot] = useState<JourneyProgressSnapshot>({
    byTrackId: new Map(),
    selectedTrackId: null,
  });

  // -------------------------
  // Load tracks
  // -------------------------
  useEffect(() => {
    let alive = true;

    const loadTracks = async () => {
      if (isAuthLoading) return;

      setIsLoadingTracks(true);
      setTrackError(null);

      try {
        const [nextTracks, nextSnapshot] = await Promise.all([
          loadJourneyTrackCards(userId),
          userId
            ? loadJourneyProgressSnapshot(userId)
            : Promise.resolve<JourneyProgressSnapshot>({
                byTrackId: new Map(),
                selectedTrackId: null,
              }),
        ]);

        if (!alive) return;

        setTracks(nextTracks);
        setJourneyProgressSnapshot(nextSnapshot);
        setIsLoadingTracks(false);
      } catch {
        if (!alive) return;

        setTracks([]);
        setJourneyProgressSnapshot({
          byTrackId: new Map(),
          selectedTrackId: null,
        });
        setTrackError("Unable to load your journey tracks right now.");
        setIsLoadingTracks(false);
      }
    };

    void loadTracks();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, refreshToken, userId]);

  // -------------------------
  // Select track (query → storage → fallback)
  // -------------------------
  const selectedTrack = useMemo(() => {
    if (!tracks.length) return null;

    const fromQuery = queryTrackId
      ? getTrackById(tracks, queryTrackId)
      : null;
    if (fromQuery) return fromQuery;

    const fromSnapshot = journeyProgressSnapshot.selectedTrackId
      ? getTrackById(tracks, journeyProgressSnapshot.selectedTrackId)
      : null;
    if (fromSnapshot) return fromSnapshot;

    const stored = readSelectedJourneyTrackId(userId);
    const fromStorage = stored ? getTrackById(tracks, stored) : null;
    if (fromStorage) return fromStorage;

    return tracks[0] || null;
  }, [journeyProgressSnapshot.selectedTrackId, queryTrackId, tracks, userId]);

  const selectedTrackId = selectedTrack?.id ?? null;
  const selectedPhaseState = selectedTrackId
    ? getJourneyPhaseStateFromSnapshot(
        journeyProgressSnapshot,
        selectedTrackId,
        userId,
      )
    : { maxReached: 1 as JourneyPhaseNumber, hasStarted: false };

  // -------------------------
  // Persist selected track
  // -------------------------
  useEffect(() => {
    persistSelectedJourneyTrackId(selectedTrackId, userId);
    if (!selectedTrackId || !selectedTrack) {
      return;
    }

    void syncSelectedJourneyTrackProgress({
      trackId: selectedTrackId,
      userId,
      roadmapId: selectedTrack.roadmapId,
      maxReached: selectedPhaseState.maxReached,
    });
  }, [selectedPhaseState.maxReached, selectedTrack, selectedTrackId, userId]);

  // -------------------------
  // Visit tracking (IMPORTANT)
  // -------------------------
  useEffect(() => {
    if (!selectedTrackId || !selectedTrack) return;

    void visitJourneyPhase(
      selectedTrackId,
      currentPhase,
      userId,
      selectedTrack.roadmapId,
    );
  }, [currentPhase, selectedTrack, selectedTrackId, userId]);

  // -------------------------
  // React to storage updates
  // -------------------------
  useEffect(() => {
    const handlePhaseUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        trackId?: string;
        userId?: string;
        state?: JourneyPhaseState;
      }>;
      const eventUserId = customEvent.detail?.userId;

      if (eventUserId && userId && eventUserId !== userId && eventUserId !== "guest") {
        return;
      }

      const trackId = customEvent.detail?.trackId;
      const state = customEvent.detail?.state;

      if (!trackId || !state) {
        setRefreshToken((previous) => previous + 1);
        return;
      }

        setJourneyProgressSnapshot((previous) => {
          const nextMap = new Map(previous.byTrackId);
          const existing = nextMap.get(trackId);
          nextMap.set(trackId, {
            currentPhase: existing?.currentPhase || state.maxReached,
            maxReached: state.maxReached,
            hasStarted: state.hasStarted,
            isSelected: existing?.isSelected || false,
            roadmapId: existing?.roadmapId || null,
            updatedAt: new Date().toISOString(),
          });

        return {
          ...previous,
          byTrackId: nextMap,
        };
      });
    };
    const handleBookmarksUpdated = () => {
      invalidateJourneyTrackCardsCache(userId);
      setRefreshToken((previous) => previous + 1);
    };

    window.addEventListener(
      JOURNEY_PHASE_STATE_UPDATED_EVENT,
      handlePhaseUpdate as EventListener,
    );
    window.addEventListener(
      UNIFIED_BOOKMARKS_UPDATED_EVENT,
      handleBookmarksUpdated as EventListener,
    );
    window.addEventListener("storage", handleBookmarksUpdated);

    return () => {
      window.removeEventListener(
        JOURNEY_PHASE_STATE_UPDATED_EVENT,
        handlePhaseUpdate as EventListener,
      );
      window.removeEventListener(
        UNIFIED_BOOKMARKS_UPDATED_EVENT,
        handleBookmarksUpdated as EventListener,
      );
      window.removeEventListener("storage", handleBookmarksUpdated);
    };
  }, [userId]);

  // -------------------------
  // Phase state
  // -------------------------
  const phaseState: JourneyPhaseState = selectedPhaseState;

  // -------------------------
  // Return
  // -------------------------
  return {
    tracks,
    selectedTrack,
    selectedTrackId,
    phaseState,
    maxReached: phaseState.maxReached,
    isLoadingTracks,
    trackError,
    queryTrackId,
  };
}
