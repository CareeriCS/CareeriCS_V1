"use client";

import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { skillAssessmentService } from "@/services";
import { runCloseStatusUpdate } from "@/lib/session-close";
import Interview from "@/components/ui/interview";
import type { APIAssessmentQuestion, APIAssessmentSessionType, APISubmitAssessmentResponse } from "@/types";
import { AssessmentContext, type AssessmentContextType } from "./context"; // Adjust import path

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
  const numQuestions = Math.min(Number(searchParams.get("numQuestions") || "7"), 20);

  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<APIAssessmentQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [expandedId, setExpandedId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);
  const [resultsData, setResultsData] = useState<APISubmitAssessmentResponse | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const initKeyRef = useRef("");

  const sidebarQuestions = useMemo(
    () => questions.map((q, idx) => ({ id: idx + 1, title: `Question ${idx + 1}`, text: q.question_text })),
    [questions]
  );

  const syncParams = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("sessionId", id);
    return p.toString();
  };

  const startNewSession = useCallback(async () => {
    if (!userId || !targetId) return;
    const response = await skillAssessmentService.startSession(userId, {
      target_id: targetId,
      num_questions: numQuestions,
      session_type: sessionType,
    });

    if (response.success && response.data?.session_id && response.data.questions?.length) {
      const sId = response.data.session_id;
      const qs = response.data.questions;
      setSessionId(sId);
      setQuestions(qs);
      setUserAnswers({});
      setCurrentQuestion(1);
      setUnlockedStepId(1);
      
      sessionStorage.setItem(`${STORAGE_PREFIX}${sId}`, JSON.stringify({ sessionId: sId, questions: qs, userAnswers: {}, currentQuestion: 1, unlockedStepId: 1 }));
      sessionStorage.setItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${sId}`, "in_progress");
      router.replace(`/skill-feature/questions?${syncParams(sId)}`);
    }
  }, [userId, targetId, numQuestions, sessionType, searchParams, router]);

  useEffect(() => {
    if (isAuthLoading) return;
    const initKey = `${userId}:${sessionType}:${targetId}:${resumeSessionId}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;

    if (!userId || !targetId) return;

    if (resumeSessionId) {
      const cached = sessionStorage.getItem(`${STORAGE_PREFIX}${resumeSessionId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachedAssessmentState;
          setSessionId(parsed.sessionId);
          setQuestions(parsed.questions);
          setUserAnswers(parsed.userAnswers || {});
          setCurrentQuestion(parsed.currentQuestion || 1);
          setUnlockedStepId(parsed.unlockedStepId || 1);
          setExpandedId(parsed.currentQuestion || 1);
          return;
        } catch (_) {}
      }
    }
    void startNewSession();
  }, [isAuthLoading, resumeSessionId, sessionType, targetId, userId, startNewSession]);

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
                {children}
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