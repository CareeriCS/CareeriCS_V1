"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { buildAuthRedirectHref } from "@/lib/auth/post-auth-redirect";
import {
  buildCareerQuizSelectionHref,
  buildCareerQuizStartHref,
  startCareerQuizSession,
} from "@/lib/career-quiz";

export default function StartCareerQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const hasStartedRef = useRef(false);
  const origin = searchParams.get("origin") || "home";
  const returnTo = searchParams.get("returnTo") || "/features/home";

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useCallback(async () => {
    if (!userId || hasStartedRef.current) return;

    hasStartedRef.current = true;
    setError(null);
    setIsStarting(true);

    try {
      const sessionId = await startCareerQuizSession(userId);
      router.replace(
        buildCareerQuizSelectionHref(sessionId, {
          origin,
          returnTo,
        }),
      );
    } catch (err) {
      hasStartedRef.current = false;
      setError(err instanceof Error ? err.message : "Unable to start the career quiz right now. Please try again.");
      setIsStarting(false);
    }
  }, [origin, returnTo, router, userId]);

  useEffect(() => {
    if (isAuthLoading) return;

    const timeoutId = window.setTimeout(() => {
      if (!userId) {
        const startHref = buildCareerQuizStartHref({ origin, returnTo });
        router.replace(buildAuthRedirectHref("/auth/login", startHref));
        return;
      }

      void startQuiz();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthLoading, origin, returnTo, router, startQuiz, userId]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-color)",
        color: "#fff",
        fontFamily: "var(--font-jura)",
        padding: "var(--space-xl)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-md)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-md)",
          }}
        >
          {error ? "We could not start your career quiz." : "Starting your career quiz..."}
        </p>

        {error && (
          <>
            <p
              style={{
                margin: 0,
                maxWidth: "42rem",
                color: "#FFD3D3",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </p>
            <Button
              type="button"
              variant="primary"
              disabled={isStarting}
              onClick={() => {
                void startQuiz();
              }}
            >
              {isStarting ? "Starting..." : "Retry"}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
