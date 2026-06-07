"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InterviewLayout from "@/components/ui/interview";
import { interviewService } from "@/services/interview.service";
import { normalizeInterviewAudioUrl } from "@/lib/interview-media";
import type { APIFollowup } from "@/types";
import { useInterviewFlow } from "@/hooks";

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
    currentQ,
    questions,
    buildRecordingUrl,
  } = useInterviewFlow();

  const [isFinished, setIsFinished] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [followup, setFollowup] = useState<APIFollowup | null>(null);

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
        const response = await interviewService.evaluateAnswer(sessionId, questionId);

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
              "Could not load the follow-up question. You can continue to the next question.",
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
      q: String(currentQ),
    });

    router.push(`/interview-feature/last-analysis?${nextParams.toString()}`);
  };

  const handleAnswerFollowup = () => {
    if (missingContext) {
      router.push("/features/interview");
      return;
    }

    if (!followup) {
      goToNextMainStep();
      return;
    }

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
  };

  const handleSkipFollowup = () => {
    goToNextMainStep();
  };

  const handlePrimaryAction = () => {
    if (missingContext) {
      router.push("/features/interview");
      return;
    }

    goToNextMainStep();
  };

  return (
    <InterviewLayout
      title="Interview Analysis"
      questions={layoutQuestions}
      currentActiveId={safeCurrentQ}
      unlockedStepId={safeCurrentQ}
      onQuestionClick={() => {}}
      singleLineItems
      disableNavigation
    >
      <div className="analysis-page">
        <h2 className="analysis-title">
          {missingContext ? (
            <>Missing session or question context. Please restart interview flow.</>
          ) : errorMessage ? (
            <>{errorMessage}</>
          ) : isEvaluating ? (
            <>
              Our Model is analyzing your answers,
              <br />
              Give us a moment
            </>
          ) : isFinished && followup ? (
            <>
              Optional follow-up question available.
              <br />
              Do you want to answer it?
            </>
          ) : isFinished ? (
            <>
              Our Model has finished the analysis,
              <br />
              Ready for the next question?
            </>
          ) : (
            <>
              Evaluation is not complete yet.
              <br />
              Please try again
            </>
          )}
        </h2>

        <div className="analysis-image-wrap">
          <img
            src="/interview/analyzing.svg"
            alt="AI Analysis"
            className="analysis-image"
            style={{
              filter: isFinished
                ? "drop-shadow(0 0 20px rgba(212, 255, 71, 0.4))"
                : "drop-shadow(0 0 20px rgba(168, 85, 247, 0.3))",
            }}
          />
        </div>

        {isFinished && followup ? (
          <div className="analysis-actions">
            <button
              type="button"
              onClick={handleAnswerFollowup}
              disabled={!isActionReady}
              className="analysis-button analysis-button-primary"
            >
              Answer Follow-up
            </button>

            <button
              type="button"
              onClick={handleSkipFollowup}
              disabled={!isActionReady}
              className="analysis-button analysis-button-secondary"
            >
              Skip Follow-up
            </button>
          </div>
        ) : (
          <div className="analysis-actions">
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!isActionReady}
              className="analysis-button analysis-button-primary"
            >
              {missingContext ? "Restart Interview" : "Next Question"}
            </button>
          </div>
        )}

        <style jsx>{`
          .analysis-page,
          .analysis-page * {
            box-sizing: border-box;
            font-family: var(--font-nova-square), sans-serif;
            font-weight: 400 !important;
          }

          .analysis-page {
            width: 100%;
            min-height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding-bottom: 40px;
          }

          .analysis-title {
            margin: 0 0 24px;
            color: white;
            font-size: 24px;
            line-height: 1.6;
            text-align: center;
          }

          .analysis-image-wrap {
            margin-bottom: 60px;
          }

          .analysis-image {
            width: 300px;
            height: auto;
            transition: filter 0.5s ease;
          }

          .analysis-actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .analysis-button {
            border-radius: 14px;
            border: none;
            font-size: 18px;
            cursor: pointer;
            transition:
              background-color 0.25s ease,
              opacity 0.25s ease,
              transform 0.25s ease;
          }

          .analysis-button:disabled {
            cursor: wait;
            opacity: 0.75;
          }

          .analysis-button:not(:disabled):hover {
            transform: translateY(-1px);
          }

          .analysis-button-primary {
            min-width: 230px;
            padding: 12px 48px;
            background-color: #d4ff47;
            color: #1a1a1a;
          }

          .analysis-button-primary:not(:disabled):hover {
            background-color: var(--primary-green);
          }

          .analysis-button-secondary {
            min-width: 170px;
            padding: 12px 24px;
            background-color: rgba(255, 255, 255, 0.14);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.25);
            font-size: 15px;
          }

          .analysis-button-secondary:not(:disabled):hover {
            background-color: rgba(255, 255, 255, 0.22);
          }
        `}</style>
      </div>
    </InterviewLayout>
  );
}