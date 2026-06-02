"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Interview from "@/components/ui/interview";
import { useAuth } from "@/providers/auth-provider";
import { skillAssessmentService } from "@/services";
import type {
  APIAssessmentQuestion,
  APIAssessmentQuestionResult,
  APIAssessmentSessionType,
  APISubmitAssessmentResponse,
} from "@/types";
import { Button } from "@/components/ui";

const STORAGE_PREFIX = "skill-assessment:";
const STATUS_STORAGE_PREFIX = "skill-assessment:status:";

type CachedAssessmentState = {
  sessionId: string;
  questions: APIAssessmentQuestion[];
  userAnswers: Record<string, string>;
  currentQuestion: number;
  unlockedStepId: number;
};

function getProficiencyLevel(score: number): "Advanced" | "Intermediate" | "Beginner" {
  if (score >= 80) return "Advanced";
  if (score >= 50) return "Intermediate";
  return "Beginner";
}

function normalizeSessionType(rawType: string | null): APIAssessmentSessionType {
  if (rawType === "roadmap" || rawType === "section" || rawType === "step") {
    return rawType;
  }
  return "skills";
}

export default function AssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  const legacySkillId = searchParams.get("skillId") || "";
  const legacySkillName = searchParams.get("skillName") || "";
  const targetId = searchParams.get("targetId") || legacySkillId;
  const targetName = searchParams.get("targetName") || legacySkillName || "Skill Assessment";
  const sessionType = normalizeSessionType(searchParams.get("sessionType"));
  const resumeSessionId = searchParams.get("sessionId") || "";
  const parsedNumQuestions = Number(searchParams.get("numQuestions") || "7");
  const numQuestions = Number.isFinite(parsedNumQuestions) && parsedNumQuestions > 0
    ? Math.min(parsedNumQuestions, 20)
    : 7;

  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [expandedId, setExpandedId] = useState(1);
  const [unlockedStepId, setUnlockedStepId] = useState(1);

  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<APIAssessmentQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  const [isInitializing, setIsInitializing] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [resultsData, setResultsData] = useState<APISubmitAssessmentResponse | null>(null);
  const [error, setError] = useState("");

  const initKeyRef = useRef("");

  const currentQData = questions[currentQuestion - 1] || null;
  const selectedChoice = currentQData ? userAnswers[currentQData.id] || null : null;
  const isAnswered = Boolean(selectedChoice);
  const allAnswered = questions.length > 0 && questions.every((q) => Boolean(userAnswers[q.id]));

  const resultByQuestionId = useMemo(() => {
    const map = new Map<string, APIAssessmentQuestionResult>();
    for (const item of resultsData?.results || []) {
      map.set(item.question_id, item);
    }
    return map;
  }, [resultsData]);

  const sidebarQuestions = questions.map((q, idx) => ({
    id: idx + 1,
    title: "",
    text: q.question_text,
  }));

  const persistAssessmentState = (
    nextSessionId: string,
    nextQuestions: APIAssessmentQuestion[],
    nextAnswers: Record<string, string>,
    nextCurrentQuestion: number,
    nextUnlockedStepId: number,
  ) => {
    const cacheKey = `${STORAGE_PREFIX}${nextSessionId}`;
    const payload: CachedAssessmentState = {
      sessionId: nextSessionId,
      questions: nextQuestions,
      userAnswers: nextAnswers,
      currentQuestion: nextCurrentQuestion,
      unlockedStepId: nextUnlockedStepId,
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  };

  const startNewSession = async () => {
    if (!user?.id || !targetId) return;

    setIsInitializing(true);
    setError("");
    setShowResult(false);
    setIsReviewing(false);
    setResultsData(null);

    const response = await skillAssessmentService.startSession(user.id, {
      target_id: targetId,
      num_questions: numQuestions,
      session_type: sessionType,
    });

    if (!response.success || !response.data?.session_id || !response.data.questions?.length) {
      setError(response.message || "Unable to start skill assessment session.");
      setIsInitializing(false);
      return;
    }

    const nextSessionId = response.data.session_id;
    const nextQuestions = response.data.questions;

    setSessionId(nextSessionId);
    setQuestions(nextQuestions);
    setUserAnswers({});
    setCurrentQuestion(1);
    setExpandedId(1);
    setUnlockedStepId(1);

    persistAssessmentState(nextSessionId, nextQuestions, {}, 1, 1);
    sessionStorage.setItem(`${STATUS_STORAGE_PREFIX}${nextSessionId}`, "in_progress");

    const params = new URLSearchParams({
      targetId,
      targetName,
      sessionType,
      numQuestions: String(numQuestions),
      sessionId: nextSessionId,
    });

    if (sessionType === "skills") {
      params.set("skillId", targetId);
      params.set("skillName", targetName);
    }

    router.replace(`/skill-feature/questions?${params.toString()}`);

    setIsInitializing(false);
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const initKey = `${user?.id || ""}:${sessionType}:${targetId}:${resumeSessionId}:${numQuestions}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;

    if (!user?.id) {
      setIsInitializing(false);
      setError("Please sign in to start the assessment.");
      return;
    }

    if (!targetId) {
      setIsInitializing(false);
      setError("Missing assessment target. Please select a topic or skill first.");
      return;
    }

    const initialize = async () => {
      if (resumeSessionId) {
        const cached = sessionStorage.getItem(`${STORAGE_PREFIX}${resumeSessionId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as CachedAssessmentState;
            if (parsed.sessionId && parsed.questions?.length) {
              setSessionId(parsed.sessionId);
              setQuestions(parsed.questions);
              setUserAnswers(parsed.userAnswers || {});
              setCurrentQuestion(parsed.currentQuestion || 1);
              setExpandedId(parsed.currentQuestion || 1);
              setUnlockedStepId(parsed.unlockedStepId || 1);
              setIsInitializing(false);
              return;
            }
          } catch {
            // Ignore malformed cache and fall through to restart.
          }
        }
      }

      await startNewSession();
    };

    void initialize();
  }, [isAuthLoading, numQuestions, resumeSessionId, sessionType, targetId, targetName, user?.id]);

  useEffect(() => {
    if (!sessionId || !questions.length) return;
    persistAssessmentState(sessionId, questions, userAnswers, currentQuestion, unlockedStepId);
  }, [currentQuestion, questions, sessionId, unlockedStepId, userAnswers]);

  const handleChoiceClick = (choiceValue: string) => {
    if (!currentQData || isReviewing) return;

    setUserAnswers((prev) => ({
      ...prev,
      [currentQData.id]: choiceValue,
    }));

    if (currentQuestion < questions.length) {
      setUnlockedStepId((prev) => Math.max(prev, currentQuestion + 1));
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length) {
      const nextQ = currentQuestion + 1;
      setCurrentQuestion(nextQ);
      setExpandedId(nextQ);
      if (nextQ > unlockedStepId) setUnlockedStepId(nextQ);
    }
  };

  const handleFinish = async () => {
    if (!user?.id || !sessionId || !allAnswered || isSubmitting || !questions.length) {
      return;
    }

    setIsCalculating(true);
    setIsSubmitting(true);
    setError("");

    const answersPayload = questions
      .map((question) => ({
        question_id: question.id,
        selected_answer: userAnswers[question.id],
      }))
      .filter((answer) => Boolean(answer.selected_answer));

    const submitResponse = await skillAssessmentService.submitAnswers(
      user.id,
      sessionId,
      answersPayload,
    );

    if (!submitResponse.success || !submitResponse.data) {
      setIsCalculating(false);
      setIsSubmitting(false);
      setError(submitResponse.message || "Unable to submit assessment answers.");
      return;
    }

    sessionStorage.setItem(`${STATUS_STORAGE_PREFIX}${sessionId}`, "submitted");

    const resultsResponse = await skillAssessmentService.getResults(user.id, sessionId);
    const finalResults =
      resultsResponse.success && resultsResponse.data
        ? resultsResponse.data
        : submitResponse.data;

    setResultsData(finalResults);
    setShowResult(true);
    setIsReviewing(false);
    setUnlockedStepId(questions.length);
    setIsCalculating(false);
    setIsSubmitting(false);
  };

  const handleViewDetails = () => {
    setIsReviewing(true);
    setShowResult(false);
    setCurrentQuestion(1);
    setExpandedId(1);

    if (!resultsData) return;
    const answeredQuestionIds = new Set(resultsData.results.map((r) => r.question_id));
    let unlocked = 1;
    for (let i = 0; i < questions.length; i += 1) {
      if (answeredQuestionIds.has(questions[i].id)) {
        unlocked = i + 1;
      }
    }
    setUnlockedStepId(Math.max(1, unlocked));
  };

  const percentage = Math.round(resultsData?.score || 0);

  
  return (
    <Interview
      questions={sidebarQuestions}
      currentActiveId={expandedId}
      unlockedStepId={unlockedStepId}
      onQuestionClick={(id) => {
        setExpandedId(id);
        if (id <= unlockedStepId) {
          setCurrentQuestion(id);
        }
      }}
      title={targetName}
    >
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", position: "fixed",
       boxSizing: "border-box", paddingTop: "20vh",overflowY: "auto",paddingLeft: "7vw"
      }}
      >
        
        {isInitializing ? (
          <div style={{ textAlign: "center", color: "white" }}>
            <h2 style={{ fontSize: "28px", fontFamily: "var(--font-nova-square)", marginBottom: "12px" }}>
              {isAuthLoading ? "Checking your session..." : "Preparing your assessment..."}
            </h2>
            {error ? <p style={{ color: "#ffd3d3" }}>{error}</p> : null}
          </div>
        ) : showResult ? (
          /* --- RESULT SCREEN --- */
          <div style={{ display: "flex", width: "100%", maxWidth: "900px", justifyContent: "space-between", alignItems: "center", gap: "50px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: "32px", fontFamily: "var(--font-nova-square)", marginBottom: "40px" }}>Your Got</h2>
              <div style={{ position: "relative", width: "200px", height: "200px" }}>
                <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="15" />
                  <circle   
                    cx="100" cy="100" r="90" fill="none" stroke="#D4FF47" strokeWidth="15" 
                    strokeDasharray="565" strokeDashoffset={565 - (565 * percentage) / 100}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease-out" }}
                  />
                </svg>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "40px", fontWeight: "800", fontFamily: "var(--font-nova-square)" }}>
                  {percentage}%
                </div>
              </div>
              <button onClick={handleViewDetails} style={{ marginTop: "60px", width: "100%", maxWidth: "250px", backgroundColor: "var(--primary-green)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: "#111827" }}>
                View Details
              </button>
            </div>

            <div style={{ width: "2px", height: "300px", backgroundColor: "rgba(255,255,255,0.2)" }}></div>

            <div style={{ flex: 1, color: "white" }}>
              <h2 style={{ fontSize: "32px", fontFamily: "var(--font-nova-square)", marginBottom: "15px" }}>Your Proficiency Level</h2>
              <h1 style={{ fontSize: "56px", color: "#D4FF47", fontWeight: "500", marginBottom: "20px", fontFamily: "var(--font-nova-square)" }}>
                {getProficiencyLevel(percentage)}
              </h1>
              <p style={{ fontSize: "18px", opacity: 0.8, lineHeight: "1.6", marginBottom: "40px" }}>
                Assessment complete. You can now review each question to see the correct answers.
              </p>
              <Button
              variant="secondary"
                onClick={() => {
                  void startNewSession();
                }}
                style={{ width: "100%", maxWidth: "250px", border: "none", padding: "25px", borderRadius: "12px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: "#111827",marginTop: "20px"  }}
              >
                Retake Assessment
              </Button>
            </div>
          </div>

        ) : isCalculating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <h2 style={{ color: "white", fontSize: "28px", fontFamily: "var(--font-nova-square)", marginBottom: "10px" }}>Our Model is calculating your score,</h2>
            <p style={{ color: "white", fontSize: "20px", opacity: 0.8, marginBottom: "40px" }}>Give us a moment</p>
            <div style={{ width: "300px", height: "300px" }}><img src="/interview/analyzing.svg" alt="Calculating" style={{ width: "100%", height: "auto" }} /></div>
          </div>

        ) : (
          <div style={{ width: "100%", maxWidth: "680px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ color: "white", fontSize: "24px", marginBottom: "35px", textAlign: "center", fontFamily: 'var(--font-nova-square)' }}>
              {currentQuestion}. {currentQData?.question_text}
            </h3>

            {error ? (
              <p style={{ color: "#ffd3d3", marginTop: "0", marginBottom: "20px" }}>{error}</p>
            ) : null}

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              {(currentQData?.options || []).map((choice) => {
                const isSelected = selectedChoice === choice;
                const questionResult = currentQData ? resultByQuestionId.get(currentQData.id) : undefined;
                const isCorrect = questionResult?.correct_answer === choice;
                let bgColor = "white";
                if (isReviewing) {
                  if (isCorrect) bgColor = "#dff98c";
                  else if (isSelected && !isCorrect) bgColor = "#fd8686";
                }
                return (
                  <div key={choice} onClick={() => handleChoiceClick(choice)}
                    style={{
                      backgroundColor: bgColor, borderRadius: "15px", padding: "16px 25px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      cursor: isReviewing ? "default" : "pointer", color: "#111827",
                      transition: "0.2s ease",
                    }}>
                    <span style={{ fontSize: "17px", fontWeight: "500" }}>{choice}</span>
                    <div 
                        style={{ 
                            width: "22px", 
                            height: "22px", 
                            minWidth: "22px",   
                            minHeight: "22px",  
                            flexShrink: 0,     
                            borderRadius: "50%", 
                            border: "2px solid #111827", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center" 
                          }}
                        >                 
                       {isReviewing && isCorrect ? (
                        <span style={{ fontSize: "12px", fontWeight: "bold" }}>✓</span>
                      ) : isReviewing && isSelected && !isCorrect ? (
                        <span style={{ fontSize: "12px", fontWeight: "bold" }}>✕</span>
                      ) : (
                        isSelected && <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#111827" }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "30px", marginTop: "35px", marginBottom: "30px" }}>
              <Button 
              variant="secondary"
                onClick={() => {
                  const prevQ = currentQuestion - 1;
                  if (prevQ >= 1) {
                    setCurrentQuestion(prevQ);
                    setExpandedId(prevQ);
                  }
                }}
                disabled={currentQuestion === 1}
                style={{
                  display: "flex", alignItems: "center", backgroundColor: "#C1CBE6",
                  border: "none", borderRadius: "50px", padding: "25px 15px 25px 5px",
                  cursor: currentQuestion === 1 ? "not-allowed" : "pointer",
                  opacity: currentQuestion === 1 ? 0.5 : 1, transition: "0.3s"
                }}
              >
                <div style={{ width: "48px", height: "48px", backgroundColor: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "15px",position: "relative",right: "4px" }}><img src="/auth/redo.svg" alt="prev" style={{ width: "18px" }} /></div>
                <span style={{ color: "#111827", fontWeight: "bold", fontSize: "16px", fontFamily: 'var(--font-nova-square)' }}>Previous</span>
              </Button>

              {currentQuestion < questions.length ? (
                <Button 
                variant="primary-inverted"
                  onClick={handleNext}
                  disabled={!isAnswered}
                  style={{
                    display: "flex", alignItems: "center", 
                    border: "none", borderRadius: "50px", padding: "25px 15px 25px 25px",
                    cursor: !isAnswered ? "not-allowed" : "pointer",
                    opacity: !isAnswered ? 0.5 : 1, transition: "0.3s"
                  }}
                >
                  <span style={{ color: "#111827", fontWeight: "bold", fontSize: "16px", fontFamily: 'var(--font-nova-square)', marginRight: "15px" }}>Next</span>
                  <div style={{ width: "47px", height: "47px", backgroundColor: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(180deg)", left: "15px", position: "relative" }}><img src="/auth/redo.svg" alt="next" style={{ width: "18px" }} /></div>
                </Button>
              ) : (
                !isReviewing && (
                  <Button
                    variant="primary"

                    onClick={() => {
                      void handleFinish();
                    }}
                    disabled={!allAnswered || isSubmitting}
                    style={{ width: "200px",  border: "none", padding: "25px 15px", borderRadius: "12px", fontWeight: "800", fontSize: "16px", color: "#111827", opacity: allAnswered && !isSubmitting ? 1 : 0.4, cursor: allAnswered && !isSubmitting ? "pointer" : "not-allowed" }}
                  >
                    {isSubmitting ? "Submitting..." : "Back to Results"}
                  </Button>
                )
              )}
            </div>
            
            {isReviewing && (
              <button onClick={() => setShowResult(true)} style={{ color: "white", background: "none", border: "1px solid white", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", opacity: 0.7 }}>Back to Results</button>
            )}
          </div>
        )}
      </div>
    </Interview>
  );
}
