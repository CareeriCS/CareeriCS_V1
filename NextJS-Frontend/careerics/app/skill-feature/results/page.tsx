"use client";

import React, { useEffect, useState, useMemo } from "react";
import Animation from "@/components/ui/animation";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { skillAssessmentService } from "@/services";
import { useResponsive } from "@/hooks/useResponsive";
import { useAssessment } from "../context";

const ASSESSMENT_STATUS_STORAGE_PREFIX = "skill-assessment:status:";

export default function ResultsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const { isMedium, isLarge } = useResponsive();

    const sharedContext = useAssessment();

    const [isCalculating, setIsCalculating] = useState(true);
    const [error, setError] = useState<string>("");

    const userId = sharedContext?.userId || "";
    const sessionId = sharedContext?.sessionId || "";
    const questions = sharedContext?.questions || [];
    const userAnswers = sharedContext?.userAnswers || {};
    const resultsData = sharedContext?.resultsData || null;
    const setResultsData = sharedContext?.setResultsData;
    const startNewSession = sharedContext?.startNewSession;

    useEffect(() => {
        const computeResults = async () => {
            if (resultsData || !setResultsData) {
                setIsCalculating(false);
                return;
            }

            const payload = questions
                .map((q) => ({
                    question_id: q.id,
                    selected_answer: userAnswers[q.id],
                }))
                .filter((a) => Boolean(a.selected_answer));

            try {
                const res = await skillAssessmentService.submitAnswers(
                    userId,
                    sessionId,
                    payload
                );

                if (!res.success) {
                    const errorMsg =
                        typeof res.message === "object"
                            ? JSON.stringify(res.message)
                            : res.message || "Submission failed.";

                    setError(errorMsg);
                    setIsCalculating(false);
                    return;
                }

                sessionStorage.setItem(
                    `${ASSESSMENT_STATUS_STORAGE_PREFIX}${sessionId}`,
                    "submitted"
                );

                const finalRes = await skillAssessmentService.getResults(
                    userId,
                    sessionId
                );

                setResultsData(
                    finalRes.success ? finalRes.data : res.data
                );
            } catch (err: any) {
                setError(
                    err?.message ||
                    "An unexpected error occurred processing your results."
                );
            } finally {
                setIsCalculating(false);
            }
        };

        if (userId && sessionId && questions.length > 0) {
            void computeResults();
        } else if (!sharedContext) {
            setIsCalculating(false);
        }
    }, [
        userId,
        sessionId,
        questions,
        userAnswers,
        resultsData,
        setResultsData,
        sharedContext,
    ]);

    const score = resultsData?.score || 0;
    const pct = Math.max(0, Math.min(100, Math.round(score)));

    const lvl =
        score >= 80
            ? "Advanced"
            : score >= 50
                ? "Intermediate"
                : "Beginner";

    if (!sharedContext) {
        return (
            <section
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "var(--container-sm)" }}>
                    <Animation message="Connecting to assessment stream..." />
                </div>
            </section>
        );
    }

    if (isCalculating) {
        return (
            <section
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "var(--container-sm)" }}>
                    <Animation message="Calculating your score..." />
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: "var(--space-md)",
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        color: "var(--light-red)",
                    }}
                >
                    An Error Occurred
                </h2>

                <p
                    style={{
                        maxWidth: "30rem",
                        color: "rgba(255,255,255,0.7)",
                    }}
                >
                    {error}
                </p>

                <Button
                    variant="primary"
                    size="md"
                    onClick={() => window.location.reload()}
                >
                    Try Again
                </Button>
            </section>
        );
    }

    if (!resultsData) return null;

    return (
        <section
            style={{
                display: "grid",
                width: "100%",
                maxWidth: "62rem",
                gap: "var(--space-2xl)",
                borderRadius: "var(--radius-2xl)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                padding: "var(--space-2xl)",
                gridTemplateColumns:
                    isMedium || isLarge
                        ? "1fr auto 1fr"
                        : "1fr",
                alignItems: "center",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    color: "white",
                    gap: "var(--space-lg)",
                    justifyContent: "space-around",
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        color: "white",
                        fontSize: "var(--space-xl)",
                    }}
                >
                    Your Score
                </h2>

                <div
                    style={{
                        position: "relative",
                        width: "10rem",
                        height: "10rem",
                    }}
                >
                    <svg
                        className="h-full w-full -rotate-90"
                        viewBox="0 0 200 200"
                    >
                        <circle
                            cx="100"
                            cy="100"
                            r="90"
                            fill="none"
                            stroke="rgba(255,255,255,0.12)"
                            strokeWidth="15"
                        />

                        <circle
                            cx="100"
                            cy="100"
                            r="90"
                            fill="none"
                            stroke="var(--primary-green)"
                            strokeWidth="15"
                            strokeDasharray={565.4}
                            strokeDashoffset={
                                565.4 - (565.4 * pct) / 100
                            }
                            strokeLinecap="round"
                        />
                    </svg>

                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--text-2xl)",
                            fontWeight: 800,
                        }}
                    >
                        {pct}%
                    </div>
                </div>

                <Button
                    variant="primary"
                    size="md"
                    onClick={() =>
                        router.push(
                            `/skill-feature/questions?${searchParams.toString()}&review=true`
                        )
                    }
                >
                    Review Answers
                </Button>
            </div>

            <div
                style={{
                    display:
                        isMedium || isLarge
                            ? "block"
                            : "none",
                    height: "18rem",
                    width: "1px",
                    backgroundColor: "var(--border-muted)",
                }}
            />

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-lg)",
                    justifyContent: "space-around",
                    alignItems:
                        isMedium || isLarge
                            ? "flex-start"
                            : "center",
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        color: "white",
                        fontSize: "var(--space-xl)",
                    }}
                >
                    Your Proficiency Level
                </h2>

                <p
                    style={{
                        color: "var(--primary-green)",
                        fontSize: "var(--text-3xl)",
                        fontWeight: 600,
                    }}
                >
                    {lvl}
                </p>

                {startNewSession && (
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={startNewSession}
                    >
                        Retake Assessment
                    </Button>
                )}
            </div>
        </section>
    );
}