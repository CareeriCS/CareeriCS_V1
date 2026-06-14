"use client";

import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { skillAssessmentService } from "@/services";
import { runCloseStatusUpdate } from "@/lib/session-close";
import Interview from "@/components/ui/interview";
import { Button } from "@/components/ui";
import type { APIAssessmentQuestion, APIAssessmentSessionType, APISubmitAssessmentResponse } from "@/types";
import { AssessmentContext, type AssessmentContextType, type StartNewSessionOptions } from "./context";

const STORAGE_PREFIX = "skill-assessment:";
const ASSESSMENT_STATUS_STORAGE_PREFIX = "skill-assessment:status:";

type CachedAssessmentState = {
  sessionId: string;
  questions: APIAssessmentQuestion[];
  userAnswers: Record<string, string>;
  currentQuestion: number;
  unlockedStepId: number;
};

function normalizeSessionType(rawType: string | null): APIAssessmentSessionType {
  return rawType === "roadmap" || rawType === "section" || rawType === "step" ? rawType : "skills";
}

export default function JourneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? "";

  const targetId = searchParams.get("targetId") || searchParams.get("skillId") || "";
  const targetName = searchParams.get("targetName") || searchParams.get("skillName") || "Skill Assessment";
  const sessionType = normalizeSessionType(searchParams.get("sessionType"));
  const resumeSessionId = searchParams.get("sessionId") || "";
  const parsedNumQuestions = Number(searchParams.get("numQuestions") || "7");
  const numQuestions =
    Number.isFinite(parsedNumQuestions) && parsedNumQuestions > 0
      ? Math.min(Math.floor(parsedNumQuestions), 20)
      : 7;

  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<APIAssessmentQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [expandedId, setExpandedId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);
  const [resultsData, setResultsData] = useState<APISubmitAssessmentResponse | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);

  const initKeyRef = useRef("");
  const startInFlightRef = useRef<Promise<void> | null>(null);
  const startInFlightKeyRef = useRef("");

  const sidebarQuestions = useMemo(
    () => questions.map((q, idx) => ({ id: idx + 1, title: `Question ${idx + 1}`, text: q.question_text })),
    [questions]
  );

  const syncParams = useCallback((id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("sessionId", id);
    return p.toString();
  }, [searchParams]);

  const startNewSession = useCallback(async (options: StartNewSessionOptions = {}) => {
    if (!userId || !targetId) {
      const missingTargetMessage = "Missing assessment target information.";
      setSessionError(missingTargetMessage);
      throw new Error(missingTargetMessage);
    }

    const inFlightKey = `${userId}:${sessionType}:${targetId}:${numQuestions}:${options.forceNew ? "force" : "normal"}`;
    if (startInFlightRef.current && startInFlightKeyRef.current === inFlightKey) {
      return startInFlightRef.current;
    }

    const runPromise = (async () => {
      setSessionError("");
      setIsStartingSession(true);

      const response = await skillAssessmentService.startSession(userId, {
        target_id: targetId,
        num_questions: numQuestions,
        session_type: sessionType,
      });

      if (!response.success || !response.data?.session_id) {
        throw new Error(response.message || "Failed to start assessment session.");
      }

      const sId = response.data.session_id;
      const qs = response.data.questions || [];
      if (!qs.length) {
        throw new Error("The assessment session started without questions.");
      }
      if (qs.length !== numQuestions) {
        throw new Error(
          `Expected ${numQuestions} questions, but received ${qs.length}. Please try again.`,
        );
      }

      setSessionId(sId);
      setQuestions(qs);
      setUserAnswers({});
      setCurrentQuestion(1);
      setExpandedId(1);
      setUnlockedStepId(1);
      setResultsData(null);

      sessionStorage.setItem(
        `${STORAGE_PREFIX}${sId}`,
        JSON.stringify({
          sessionId: sId,
          questions: qs,
          userAnswers: {},
          currentQuestion: 1,
          unlockedStepId: 1,
        }),
      );
      sessionStorage.setItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${sId}`, "in_progress");
      router.replace(`/skill-feature/questions?${syncParams(sId)}`);
    })();

    startInFlightKeyRef.current = inFlightKey;
    startInFlightRef.current = runPromise;

    try {
      await runPromise;
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Failed to start assessment session.");
      throw err;
    } finally {
      if (startInFlightRef.current === runPromise) {
        startInFlightRef.current = null;
        startInFlightKeyRef.current = "";
      }
      setIsStartingSession(false);
    }
  }, [userId, targetId, numQuestions, sessionType, syncParams, router]);

  useEffect(() => {
    if (isAuthLoading) return;
    const initKey = `${userId}:${sessionType}:${targetId}:${resumeSessionId}:${numQuestions}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;

    if (!userId || !targetId) return;

    if (resumeSessionId) {
      const cached = sessionStorage.getItem(`${STORAGE_PREFIX}${resumeSessionId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachedAssessmentState;
          if (!parsed?.sessionId || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            throw new Error("Cached session is missing questions.");
          }

          setSessionError("");
          setSessionId(parsed.sessionId);
          setQuestions(parsed.questions.slice(0, 20));
          setUserAnswers(parsed.userAnswers || {});
          setCurrentQuestion(parsed.currentQuestion || 1);
          setUnlockedStepId(parsed.unlockedStepId || 1);
          setExpandedId(parsed.currentQuestion || 1);
          return;
        } catch {
          sessionStorage.removeItem(`${STORAGE_PREFIX}${resumeSessionId}`);
        }
      }
    }
    void startNewSession().catch(() => undefined);
  }, [isAuthLoading, numQuestions, resumeSessionId, sessionType, targetId, userId, startNewSession]);

  const handleStepNavigation = (id: number) => {
    setExpandedId(id);
    if (id <= unlockedStepId) {
      setCurrentQuestion(id);
      if (pathname.includes("/results")) {
        router.push(`/skill-feature/questions?${searchParams.toString()}&review=true`);
      }
    }
  };

  const handleClose = async () => {
    if (isClosing) return;
    setIsClosing(true);

    const activeSessionId = sessionId || searchParams.get("sessionId") || "";
    const localStatus = activeSessionId
      ? sessionStorage.getItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${activeSessionId}`)
      : null;
    const shouldCancel = activeSessionId && localStatus !== "submitted" && localStatus !== "completed";

    if (shouldCancel) {
      await runCloseStatusUpdate("skill assessment", async () => {
        const response = await skillAssessmentService.updateSessionStatus(activeSessionId, {
          status: "cancelled",
        });
        if (!response.success) {
          throw new Error(response.message || "Unable to cancel skill assessment session.");
        }
        sessionStorage.setItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${activeSessionId}`, "cancelled");
      });
    }

    router.replace("/features/skill");
  };

  const contextValue: AssessmentContextType = {
    userId, sessionId, questions, userAnswers, setUserAnswers,
    currentQuestion, setCurrentQuestion, expandedId, setExpandedId,
    unlockedStepId, setUnlockedStepId, resultsData, setResultsData, startNewSession, targetName
  };

  return (
    <AssessmentContext.Provider value={contextValue}>
      <div
        style={{
          width: "100%",
          height: "100vh",
          padding: "10px",
          boxSizing: "border-box",
          overflow: "hidden",
          position: "relative"
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, var(--dark-blue) 0%, #000000 100%)",
            borderRadius: "5vh",
            width: "100%",
            height: "100%",
            margin: "0 auto",
            overflow: "hidden",
            display: "flex",
            flexDirection: "row",
            position: "relative"
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
          >
            <Interview
              questions={sidebarQuestions}
              currentActiveId={expandedId}
              unlockedStepId={unlockedStepId}
              onQuestionClick={handleStepNavigation}
              title={targetName}
            >
              <div 
                style={{ 
                  display: "flex", 
                  width: "100%", 
                  minWidth: 0, 
                  maxWidth: "100%", 
                  height:"100%",
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                {sessionError && questions.length === 0 ? (
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
                      {sessionError}
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      disabled={isStartingSession}
                      onClick={() => {
                        void startNewSession({ forceNew: true }).catch(() => undefined);
                      }}
                    >
                      Try Again
                    </Button>
                  </section>
                ) : (
                  children
                )}
              </div>
            </Interview>
          </div>

          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={isClosing}
            aria-label="Close skill assessment"
            style={{
              position: "absolute",
              top: "30px",
              right: "30px",
              width: "35px",
              height: "35px",
              cursor: isClosing ? "not-allowed" : "pointer",
              background: "none",
              border: "none",
              zIndex: 1000,
              padding: 0,
              opacity: isClosing ? 0.6 : 1,
            }}
          >
            <img
              src="/global/close.svg"
              alt="Close"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          </button>
        </div>
      </div>
    </AssessmentContext.Provider>
  );
}