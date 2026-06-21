"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import JourneyTree from "@/components/ui/journey-tree";
import { useAuth } from "@/providers/auth-provider";
import {
  buildJourneyFirstPhaseHref,
  buildJourneyPhaseHref,
  getJourneyPhaseStateFromSnapshot,
  loadJourneyProgressSnapshot,
  loadJourneyTrackCards,
  normalizeJourneyPhaseNumber,
  persistSelectedJourneyTrackId,
  readSelectedJourneyTrackId,
  syncSelectedJourneyTrackProgress,
} from "@/lib/journey";
import JourneyTreeVertical from "@/components/ui/journey-tree-vertical";
import { useResponsive } from "@/hooks/useResponsive";

export default function JourneyPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const redirectToTrackJourney = async () => {
      if (isAuthLoading) {
        return;
      }

      if (!userId) {
        if (!alive) {
          return;
        }

        setIsLoading(false);
        setError("Please sign in to continue your journey.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [tracks, journeySnapshot] = await Promise.all([
          loadJourneyTrackCards(userId),
          loadJourneyProgressSnapshot(userId),
        ]);

        if (!alive) {
          return;
        }

        if (!tracks.length) {
          setIsLoading(false);
          setError("No journey track found. Start with the career quiz from Home.");
          return;
        }

        const persistedTrackId = readSelectedJourneyTrackId(userId);
        const activeTrack =
          tracks.find((track) => track.id === persistedTrackId) || tracks[0];

        persistSelectedJourneyTrackId(activeTrack.id, userId);
        const phaseState = getJourneyPhaseStateFromSnapshot(
          journeySnapshot,
          activeTrack.id,
          userId,
        );
        const minimumPhase = activeTrack.roadmapId ? 2 : 1;
        const startPhase = normalizeJourneyPhaseNumber(
          Math.max(minimumPhase, phaseState.maxReached),
        );

        void syncSelectedJourneyTrackProgress({
          trackId: activeTrack.id,
          userId,
          roadmapId: activeTrack.roadmapId,
          maxReached: startPhase,
        });

        if (!alive) {
          return;
        }

        router.replace(buildJourneyPhaseHref(startPhase, activeTrack.id));
      } catch {
        if (!alive) {
          return;
        }

        setIsLoading(false);
        setError("Unable to load your journey right now.");
      }
    };

    void redirectToTrackJourney();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, router, userId]);

  const { isLarge, isMedium, isSmall } = useResponsive();
    const Orientation = isLarge ? JourneyTree : JourneyTreeVertical;
  if (isLoading) {


    return (
      <Orientation
        current={1}
        maxReached={1}
        renderContent={() => (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              fontFamily: "var(--font-nova-square)",
            }}
          >
            Loading your journey...
          </div>
        )}
      />
    );
  }

  return (
    <Orientation
      current={1}
      maxReached={1}
      resolvePhasePath={(phase) => buildJourneyPhaseHref(phase)}
      renderContent={() => (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            padding: "40px",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Journey Not Ready Yet</h1>
          <p style={{ margin: 0, color: "#C1CBE6", maxWidth: "60ch" }}>
            {error || "Start your journey from Home by selecting a career track."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/features/home")}
            style={{
              border: "none",
              borderRadius: "2vh",
              backgroundColor: "var(--light-green)",
              color: "black",
              padding: "0.9rem 1.6rem",
              fontFamily: "var(--font-nova-square)",
              cursor: "pointer",
            }}
          >
            Go To Home
          </button>
          <button
            type="button"
            onClick={() => router.push(buildJourneyFirstPhaseHref())}
            style={{
              border: "1px solid #C1CBE6",
              borderRadius: "2vh",
              backgroundColor: "transparent",
              color: "white",
              padding: "0.8rem 1.4rem",
              fontFamily: "var(--font-nova-square)",
              cursor: "pointer",
            }}
          >
            Open Empty Journey View
          </button>
        </div>
      )}
    />
  );
}
