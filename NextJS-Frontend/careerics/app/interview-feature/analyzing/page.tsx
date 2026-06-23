"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Animation from "@/components/ui/animation";
import InterviewLayout from "@/components/ui/interview";
import { interviewService } from "@/services/interview.service";
import { normalizeInterviewAudioUrl } from "@/lib/interview-media";
import { useNavigationLock } from "@/lib/navigation-lock";
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
  const navigationLockOwner = useMemo(
    () => `interview-analyzing:${sessionId || "pending"}`,
    [sessionId],
  );
  useNavigationLock(navigationLockOwner, isEvaluating);

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
