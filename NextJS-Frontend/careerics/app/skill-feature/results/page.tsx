"use client";

import React, { useEffect, useState } from "react";
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

    const {
        userId,
        sessionId,
        questions,
        userAnswers,
        resultsData,
        setResultsData,
        startNewSession,
    } = useAssessment();

    const [isCalculating, setIsCalculating] = useState(true);
    const [isRetaking, setIsRetaking] = useState(false);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const computeResults = async () => {
            if (resultsData) {
                setIsCalculating(false);
                return;
            }

            const localSessionStatus = sessionStorage.getItem(
                `${ASSESSMENT_STATUS_STORAGE_PREFIX}${sessionId}`,
            );
            const isAlreadySubmitted =
                localSessionStatus === "submitted" || localSessionStatus === "completed";

            if (isAlreadySubmitted) {
                try {
                    const existingResultsRes = await skillAssessmentService.getResults(userId, sessionId);
                    if (!existingResultsRes.success || !existingResultsRes.data) {
                        const existingError =
                            typeof existingResultsRes.message === "object"
                                ? JSON.stringify(existingResultsRes.message)
                                : existingResultsRes.message || "Unable to load submitted results.";
                        setError(existingError);
                        setIsCalculating(false);
                        return;
                    }

                    setResultsData(existingResultsRes.data);
                } catch (err: unknown) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "An unexpected error occurred while loading submitted results.",
                    );
                } finally {
                    setIsCalculating(false);
                }
                return;
            }

            if (!questions.length) {
                try {
                    const existingResultsRes = await skillAssessmentService.getResults(userId, sessionId);
                    if (existingResultsRes.success && existingResultsRes.data) {
                        setResultsData(existingResultsRes.data);
                        setIsCalculating(false);
                        return;
                    }
                } catch {
                    // Ignore and show standard missing-questions error below.
                }

                setError("Questions are missing for this assessment session.");
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

                    if (errorMsg.toLowerCase().includes("already submitted")) {
                        const existingResultsRes = await skillAssessmentService.getResults(userId, sessionId);
                        if (existingResultsRes.success && existingResultsRes.data) {
                            setResultsData(existingResultsRes.data);
                            setIsCalculating(false);
                            return;
                        }
                    }

                    setError(errorMsg);
                    setIsCalculating(false);
                    return;
                }

                sessionStorage.setItem(
                    `${ASSESSMENT_STATUS_STORAGE_PREFIX}${sessionId}`,
                    "submitted"
                );
                if (!res.data) {
                    setError("Submission completed but no results were returned.");
                    setIsCalculating(false);
                    return;
                }
                setResultsData(res.data);
            } catch (err: unknown) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "An unexpected error occurred processing your results."
                );
            } finally {
                setIsCalculating(false);
            }
        };

        if (userId && sessionId) {
            void computeResults();
        } else {
            setIsCalculating(false);
        }
    }, [
        userId,
        sessionId,
        questions,
        userAnswers,
        resultsData,
        setResultsData,
    ]);

    const score = resultsData?.score || 0;
    const pct = Math.max(0, Math.min(100, Math.round(score)));

    const lvl =
        score >= 80
            ? "Advanced"
            : score >= 50
                ? "Intermediate"
                : "Beginner";

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

    if (isRetaking) {
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
                    <Animation message="Preparing your assessment questions..." />
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
  className="m-0 mt-[var(--space-md)] text-[length:var(--text-xl)] font-normal leading-[var(--line-tight)] text-[var(--primary-green)]"
  style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
>
  {lvl}
</p>

<p style={{
                        maxWidth: "30rem",
                        color: "rgba(255,255,255,0.7)",
                    }}>
                    Assessment complete. You can review each question to see the correct answers, or
                    retake the assessment to generate a fresh session.
                </p>
                {startNewSession && (
                    <Button
                        variant="secondary"
                        size="md"
                        disabled={isRetaking}
                        onClick={() => {
                            if (!startNewSession || isRetaking) {
                                return;
                            }

                            setError("");
                            setIsRetaking(true);

                            void startNewSession({ forceNew: true })
                                .then(() => {
                                    setIsRetaking(false);
                                })
                                .catch((err) => {
                                    setError(
                                        err instanceof Error
                                            ? err.message
                                            : "Unable to retake assessment right now.",
                                    );
                                    setIsRetaking(false);
                                });
                        }}
                    >
                        Retake Assessment
                    </Button>
                )}
            </div>
        </section>
    );
}