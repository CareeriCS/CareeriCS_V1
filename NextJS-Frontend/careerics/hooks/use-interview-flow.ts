"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { interviewService } from "@/services/interview.service";
import { normalizeInterviewAudioUrl } from "@/lib/interview-media";
import {
  DEFAULT_INTERVIEW_QUESTION_COUNT,
  normalizeInterviewQuestionCount,
  normalizeInterviewType as normalizeCanonicalInterviewType,
} from "@/lib/interview";

export type InterviewType = string;

export interface UIQuestion {
  id: number;
  text: string;
  questionId: string;
  audioUrl: string;
}

interface RecordingOverrides {
  type?: InterviewType;
  sessionId?: string | null;
  questionCount?: number | null;
  q?: string;
  questionId?: string | null;
  followup?: string | null;
  followupAudio?: string | null;
  followupId?: string | null;
  followupMode?: boolean | null;
}

interface AnalyzingOverrides {
  type?: InterviewType;
  sessionId?: string;
  questionCount?: number | null;
  q?: string;
  questionId?: string;
  answerId?: string;
  followupMode?: boolean;
}

function normalizeInterviewType(rawType: string | null | undefined): InterviewType {
  return normalizeCanonicalInterviewType(rawType);
}

async function getQuestionsByCanonicalType(interviewType: InterviewType) {
  return interviewService.getQuestionsByType(interviewType);
}

export function useInterviewFlow() {
  const searchParams = useSearchParams();

  const interviewType = useMemo<InterviewType>(() => {
    return normalizeInterviewType(searchParams.get("type"));
  }, [searchParams]);

  const sessionId = searchParams.get("sessionId") || "";
  const questionId = searchParams.get("questionId") || "";
  const answerId = searchParams.get("answerId") || "";
  const questionCount = useMemo(() => {
    return normalizeInterviewQuestionCount(
      searchParams.get("count"),
      undefined,
      undefined,
      DEFAULT_INTERVIEW_QUESTION_COUNT,
    );
  }, [searchParams]);
  const followupText = searchParams.get("followup") || "";
  const followupAudio = searchParams.get("followupAudio") || "";
  const followupId = searchParams.get("followupId") || "";
  const followupMode = searchParams.get("followupMode") === "1";

  const currentQ = useMemo(() => {
    const parsed = Number(searchParams.get("q") || "1");
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  }, [searchParams]);

  const [questions, setQuestions] = useState<UIQuestion[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState("");

  useEffect(() => {
    let alive = true;

    const loadQuestions = async () => {
      setIsQuestionsLoading(true);
      setQuestionsError("");

      const response = await getQuestionsByCanonicalType(interviewType);
      if (!alive) return;

      if (!response.success || !response.data?.length) {
        setQuestions([]);
        setQuestionsError(response.message || "No questions found for this interview type.");
        setIsQuestionsLoading(false);
        return;
      }

      const mapped: UIQuestion[] = response.data.map((q, index) => ({
        id: index + 1,
        text: q.question_text,
        questionId: q.id,
        audioUrl: normalizeInterviewAudioUrl(q.question_audio, "questions"),
      }));

      setQuestions(mapped.slice(0, questionCount));
      setIsQuestionsLoading(false);
    };

    loadQuestions();

    return () => {
      alive = false;
    };
  }, [interviewType, questionCount]);

  const buildRecordingUrl = useCallback(
    (overrides: RecordingOverrides = {}) => {
      const next = new URLSearchParams(searchParams.toString());

      if (overrides.type) {
        next.set("type", overrides.type);
      } else if (!next.get("type")) {
        next.set("type", interviewType);
      }

      if (overrides.sessionId === null) {
        next.delete("sessionId");
      } else if (typeof overrides.sessionId === "string") {
        next.set("sessionId", overrides.sessionId);
      }

      if (overrides.questionCount === null) {
        next.delete("count");
      } else if (typeof overrides.questionCount === "number") {
        next.set("count", String(normalizeInterviewQuestionCount(overrides.questionCount)));
      } else if (!next.get("count")) {
        next.set("count", String(questionCount));
      }

      if (overrides.q) {
        next.set("q", overrides.q);
      }

      if (overrides.questionId === null) {
        next.delete("questionId");
      } else if (typeof overrides.questionId === "string") {
        next.set("questionId", overrides.questionId);
      }

      if (overrides.followup === null) {
        next.delete("followup");
      } else if (typeof overrides.followup === "string") {
        next.set("followup", overrides.followup);
      }

      if (overrides.followupAudio === null) {
        next.delete("followupAudio");
      } else if (typeof overrides.followupAudio === "string") {
        next.set("followupAudio", overrides.followupAudio);
      }

      if (overrides.followupId === null) {
        next.delete("followupId");
      } else if (typeof overrides.followupId === "string") {
        next.set("followupId", overrides.followupId);
      }

      if (overrides.followupMode === null) {
        next.delete("followupMode");
      } else if (typeof overrides.followupMode === "boolean") {
        if (overrides.followupMode) {
          next.set("followupMode", "1");
        } else {
          next.delete("followupMode");
        }
      }

      next.delete("answerId");

      return `/interview-feature/recording?${next.toString()}`;
    },
    [searchParams, interviewType, questionCount],
  );

  const buildAnalyzingUrl = useCallback(
    (overrides: AnalyzingOverrides) => {
      const params = new URLSearchParams({
        type: overrides.type || interviewType,
        sessionId: overrides.sessionId || sessionId,
        count: String(
          normalizeInterviewQuestionCount(overrides.questionCount ?? questionCount),
        ),
        q: overrides.q || String(currentQ),
        questionId: overrides.questionId || questionId,
      });

      if (overrides.answerId) {
        params.set("answerId", overrides.answerId);
      }

      const shouldUseFollowupMode =
        typeof overrides.followupMode === "boolean"
          ? overrides.followupMode
          : followupMode;

      if (shouldUseFollowupMode) {
        params.set("followupMode", "1");
      }

      return `/interview-feature/analyzing?${params.toString()}`;
    },
    [interviewType, sessionId, questionCount, currentQ, questionId, followupMode],
  );

  const getQuestionByStep = useCallback(
    (step: number) => {
      if (!Number.isFinite(step) || step < 1) {
        return null;
      }

      return questions.find((q) => q.id === Math.floor(step)) || null;
    },
    [questions],
  );

  const getNextMainQuestion = useCallback(
    (fromStep: number = currentQ) => {
      if (!Number.isFinite(fromStep) || fromStep < 1) {
        return null;
      }

      const nextStep = Math.floor(fromStep) + 1;
      return getQuestionByStep(nextStep);
    },
    [currentQ, getQuestionByStep],
  );

  return {
    interviewType,
    sessionId,
    questionId,
    answerId,
    questionCount,
    followupText,
    followupAudio,
    followupId,
    followupMode,
    currentQ,
    questions,
    isQuestionsLoading,
    questionsError,
    getQuestionByStep,
    getNextMainQuestion,
    buildRecordingUrl,
    buildAnalyzingUrl,
  };
}
