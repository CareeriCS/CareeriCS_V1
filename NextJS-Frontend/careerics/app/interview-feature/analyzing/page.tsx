"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Animation from "@/components/ui/animation";
import InterviewLayout from "@/components/ui/interview";
import { interviewService } from "@/services/interview.service";
import { buildInterviewAudioCandidates, normalizeInterviewAudioUrl } from "@/lib/interview-media";
import type { APIFollowup } from "@/types";
import { useInterviewFlow } from "@/hooks";
import { Button } from "@/components/ui/button";

const ANALYSIS_DELAY_MS = 2500;

function normalizeFollowupAudio(followup: APIFollowup | null | undefined): APIFollowup | null {
  if (!followup) {
    return null;
  }

  return {
    ...followup,
    audio: normalizeInterviewAudioUrl(followup.audio, "followups"),
  };
}

function resetAnalysisUiState(
  setIsFinished: React.Dispatch<React.SetStateAction<boolean>>,
  setIsEvaluating: React.Dispatch<React.SetStateAction<boolean>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>,
  setFollowup: React.Dispatch<React.SetStateAction<APIFollowup | null>>,
) {
  setIsFinished(false);
  setIsEvaluating(true);
  setErrorMessage("");
  setFollowup(null);
}

export default function AnalyzingPage() {
  const router = useRouter();
  const {
    interviewType,
    sessionId,
    questionId,
    answerId,
    followupMode,
    questionCount,
    currentQ,
    questions,
    buildRecordingUrl,
  } = useInterviewFlow();

  const [isFinished, setIsFinished] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [followup, setFollowup] = useState<APIFollowup | null>(null);
  const [isReplayingFollowup, setIsReplayingFollowup] = useState(false);
  const [isFollowupAutoplayBlocked, setIsFollowupAutoplayBlocked] = useState(false);

  const followupAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const followupCandidateIndexRef = useRef(0);

  const followupAudioCandidates = useMemo(
    () => buildInterviewAudioCandidates(followup?.audio || "", "followups"),
    [followup?.audio],
  );

  const missingContext = !sessionId || !questionId;
  const isActionReady = missingContext || isFinished;

  const layoutQuestions = useMemo(
    () =>
      questions.map((q) => ({
        ...q,
        title: q.text,
      })),
    [questions],
  );

  const safeCurrentQ = Math.min(Math.max(currentQ, 1), Math.max(layoutQuestions.length, 1));

  const playFollowupAudio = useCallback(
    async (startIndex = 0): Promise<boolean> => {
      const player = followupAudioElementRef.current;
      if (!player || !followupAudioCandidates.length) {
        return false;
      }

      const safeStartIndex = Math.max(0, Math.min(startIndex, followupAudioCandidates.length - 1));

      for (let index = safeStartIndex; index < followupAudioCandidates.length; index += 1) {
        const candidate = followupAudioCandidates[index];
        followupCandidateIndexRef.current = index;

        if (player.src !== candidate) {
          player.src = candidate;
          player.load();
        }

        player.currentTime = 0;
        player.muted = false;
        player.volume = 1;

        try {
          await player.play();
          setIsFollowupAutoplayBlocked(false);
          return true;
        } catch (error) {
          const blocked = error instanceof DOMException && error.name === "NotAllowedError";
          if (blocked) {
            setIsFollowupAutoplayBlocked(true);
            return false;
          }
        }
      }

      return false;
    },
    [followupAudioCandidates],
  );

  const speakFollowupFallback = useCallback((): boolean => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !followup?.text?.trim()
    ) {
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(followup.text.trim());
      utterance.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, [followup?.text]);

  useEffect(() => {
    if (!isFinished || !followup) {
      return;
    }

    followupCandidateIndexRef.current = 0;

    if (!followupAudioCandidates.length) {
      setIsFollowupAutoplayBlocked(false);
      speakFollowupFallback();
      return;
    }

    void playFollowupAudio(0);
  }, [followup, followupAudioCandidates, isFinished, playFollowupAudio, speakFollowupFallback]);

  useEffect(() => {
    if (!isFollowupAutoplayBlocked || typeof window === "undefined") {
      return;
    }

    let disposed = false;

    const retryPlayback = () => {
      if (disposed) {
        return;
      }

      void playFollowupAudio(followupCandidateIndexRef.current);
    };

    window.addEventListener("pointerdown", retryPlayback, { once: true });
    window.addEventListener("keydown", retryPlayback, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", retryPlayback);
      window.removeEventListener("keydown", retryPlayback);
    };
  }, [isFollowupAutoplayBlocked, playFollowupAudio]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleFollowupAudioError = () => {
    const nextIndex = followupCandidateIndexRef.current + 1;
    if (nextIndex < followupAudioCandidates.length) {
      void playFollowupAudio(nextIndex);
      return;
    }

    speakFollowupFallback();
  };

  const handleReplayFollowupAudio = async () => {
    if (!followup || isReplayingFollowup) {
      return;
    }

    setIsReplayingFollowup(true);

    try {
      const started = await playFollowupAudio(followupCandidateIndexRef.current);
      if (!started) {
        speakFollowupFallback();
      }
    } finally {
      setIsReplayingFollowup(false);
    }
  };

  useEffect(() => {
    if (missingContext) {
      return;
    }

    let alive = true;
    const startedAt = Date.now();

    resetAnalysisUiState(setIsFinished, setIsEvaluating, setErrorMessage, setFollowup);

    const evaluate = async () => {
      try {
        const response = await interviewService.evaluateAnswer(
          sessionId,
          questionId,
          followupMode,
          answerId,
        );
        if (!alive) {
          return;
        }

        if (!response.success || !response.data) {
          setErrorMessage(response.message || "Evaluation failed. Please try again.");
          return;
        }

        if (followupMode) {
          return;
        }

        const followupFromEvaluation = normalizeFollowupAudio(response.data.followup || null);
        const isFollowupRequired =
          Boolean(response.data.followup_recommended) || Boolean(followupFromEvaluation);

        if (!isFollowupRequired) {
          return;
        }

        if (followupFromEvaluation) {
          setFollowup(followupFromEvaluation);
          return;
        }

        let resolvedAnswerId = answerId;

        if (!resolvedAnswerId) {
          const answerLookupResponse = await interviewService.getAnswerByQuestionSession(
            questionId,
            sessionId,
          );
          if (!alive) {
            return;
          }

          if (!answerLookupResponse.success || !answerLookupResponse.data?.id) {
            setErrorMessage(
              answerLookupResponse.message ||
              "Follow-up is required but answer context is missing. Please submit your answer again.",
            );
            return;
          }

          resolvedAnswerId = answerLookupResponse.data.id;
        }

        const followupResponse = await interviewService.getFollowupByAnswerId(resolvedAnswerId);
        if (!alive) {
          return;
        }

        if (!followupResponse.success || !followupResponse.data) {
          setErrorMessage(
            followupResponse.message ||
            "Could not load follow-up question audio. You can continue with text only.",
          );
          return;
        }

        setFollowup(normalizeFollowupAudio(followupResponse.data));
      } finally {
        const elapsed = Date.now() - startedAt;
        const remainingDelay = Math.max(0, ANALYSIS_DELAY_MS - elapsed);

        if (remainingDelay > 0) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, remainingDelay);
          });
        }

        if (!alive) {
          return;
        }

        setIsEvaluating(false);
        setIsFinished(true);
      }
    };

    void evaluate();

    return () => {
      alive = false;
    };
  }, [answerId, followupMode, missingContext, questionId, sessionId]);

  const goToNextMainStep = () => {
    if (currentQ < questions.length) {
      const nextQuestion = questions[currentQ];
      router.push(
        buildRecordingUrl({
          type: interviewType,
          sessionId,
          q: String(currentQ + 1),
          questionId: nextQuestion?.questionId || null,
          followup: null,
          followupAudio: null,
          followupMode: false,
        }),
      );
      return;
    }

    const nextParams = new URLSearchParams({
      type: interviewType,
      sessionId,
      count: String(questionCount),
      q: String(currentQ),
    });
    router.push(`/interview-feature/last-analysis?${nextParams.toString()}`);
  };

  const handleNext = (options?: { skipFollowup?: boolean }) => {
    if (missingContext) {
      router.push("/features/interview");
      return;
    }

    if (followup && !options?.skipFollowup) {
      router.push(
        buildRecordingUrl({
          type: interviewType,
          sessionId,
          q: String(currentQ),
          followup: followup.text,
          followupAudio: followup.audio || null,
          questionId: null,
          followupMode: true,
        }),
      );
      return;
    }

    goToNextMainStep();
  };

  const handleSkipFollowup = () => {
    handleNext({ skipFollowup: true });
  };

  return (
    <InterviewLayout
      title="Interview Analysis"
      questions={layoutQuestions}
      currentActiveId={safeCurrentQ}
      unlockedStepId={safeCurrentQ}
      onQuestionClick={(id: number) => {
        const target = questions.find((q) => q.id === id);
        router.push(
          buildRecordingUrl({
            type: interviewType,
            sessionId,
            q: String(id),
            questionId: target?.questionId || null,
            followup: null,
            followupAudio: null,
            followupMode: false,
          }),
        );
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-evenly",
          textAlign: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={{ maxWidth: "var(--container-sm)" }}>
          <Animation
            message={
              missingContext ? (
                "Missing session or question context. Please restart interview flow."
              ) : errorMessage ? (
                errorMessage
              ) : isEvaluating ? (
                "Our Model is analyzing your answers,\nGive us a moment"
              ) : isFinished && followup ? (
                "Optional follow-up question"
              ) : isFinished ? (
                "Our Model has finished the analysis,\nReady for the next question?"
              ) : (
                "Evaluation is not complete yet.\nPlease try again"
              )
            }
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-xl)", alignItems: "center", justifyContent: "center" }}>
          {isFinished && followup ? (
            <Button
              type="button"
              onClick={handleSkipFollowup}
              variant="outline"
            >
              Skip Follow-up
            </Button>
          ) : null}


          <Button
            onClick={() => handleNext()}
            disabled={!isActionReady}
            style={{
              cursor: isActionReady ? "pointer" : "wait",
              transition: "all 0.5s ease",
              opacity: isActionReady ? 1 : 0.8,
            }}
          >
            {missingContext ? "Restart Interview" : followup ? "Answer Follow-up" : "Next Question"}
          </Button>



        </div>
      </div>
    </InterviewLayout>
  );
}
