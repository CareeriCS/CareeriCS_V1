/**
 * Interview service — all backend calls for the interview feature.
 *
 * Maps directly to the FastAPI routers:
 *   POST/GET/DELETE  /sessions/…
 *   GET/POST         /questions/…
 *   POST             /answers/  and  /answers/evaluate/
 *
 * Components and hooks must never call fastapiApi directly.
 */

import { fastapiApi } from "@/lib/api";
import { normalizeInterviewAudioUrl } from "@/lib/interview-media";
import type {
  ApiResponse,
  APISession,
  APISessionCreate,
  APISessionUpdate,
  APIInterviewArchiveItem,
  APICompleteInterviewSessionResponse,
  APIQuestion,
  APIQuestionCreate,
  APIAnswerRead,
  APISubmitAnswerResponse,
  APIEvaluationResponse,
  APIFollowup,
  APIFollowupRead,
} from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (value == null) {
    return null;
  }

  const coerced = String(value).trim();
  return coerced.length ? coerced : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeFollowupPayload(payload: unknown): APIFollowup | null {
  if (!isRecord(payload)) {
    return null;
  }

  const text = toNullableString(
    payload.text ??
      payload.fquestion_text ??
      payload.followup_text ??
      payload.question_text ??
      payload.question,
  );

  if (!text) {
    return null;
  }

  const id =
    toNullableString(payload.id ?? payload.followup_id ?? payload.fquestion_id) ||
    `followup-${text.slice(0, 24)}`;
  const audio =
    toNullableString(
      payload.audio ??
        payload.fquestion_audio ??
        payload.followup_audio ??
        payload.question_audio,
    ) || "";

  return {
    id,
    text,
    audio: normalizeInterviewAudioUrl(audio, "followups"),
  };
}

function normalizeEvaluationPayload(payload: unknown): APIEvaluationResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const followup = normalizeFollowupPayload(
    payload.followup ?? payload.follow_up_question ?? payload.followup_question,
  );
  const followupFlag = payload.followup_recommended ?? payload.followup_required ?? payload.follow_up_required;

  return {
    evaluation: toNullableString(payload.evaluation ?? payload.feedback),
    grade: toNullableNumber(payload.grade ?? payload.score),
    followup_recommended:
      typeof followupFlag === "boolean" ? followupFlag : Boolean(followup),
    followup,
    emotion_evaluation: isRecord(payload.emotion_evaluation)
      ? (payload.emotion_evaluation as Record<string, unknown>)
      : null,
    tone_evaluation: isRecord(payload.tone_evaluation)
      ? (payload.tone_evaluation as Record<string, unknown>)
      : null,
  };
}

export const interviewService = {
  // ── Sessions ────────────────────────────────────────────────────────────────

  createSession(payload: APISessionCreate): Promise<ApiResponse<APISession>> {
    return fastapiApi.post<APISession>("/sessions/", payload);
  },

  getSession(sessionId: string): Promise<ApiResponse<APISession>> {
    return fastapiApi.get<APISession>(`/sessions/${sessionId}`);
  },

  updateSession(
    sessionId: string,
    payload: APISessionUpdate,
  ): Promise<ApiResponse<APISession>> {
    return fastapiApi.put<APISession>(`/sessions/${sessionId}`, payload);
  },

  getUserSessions(userId: string): Promise<ApiResponse<APISession[]>> {
    return fastapiApi.get<APISession[]>(`/sessions/user/${userId}`);
  },

  getUserArchive(userId: string): Promise<ApiResponse<APIInterviewArchiveItem[]>> {
    return fastapiApi.get<APIInterviewArchiveItem[]>(`/sessions/user/${userId}/archive`);
  },

  deleteSession(sessionId: string): Promise<ApiResponse<{ detail: string }>> {
    return fastapiApi.delete<{ detail: string }>(`/sessions/${sessionId}`);
  },

  completeSession(
    sessionId: string,
  ): Promise<ApiResponse<APICompleteInterviewSessionResponse>> {
    return fastapiApi.post<APICompleteInterviewSessionResponse>(`/sessions/${sessionId}/complete`);
  },

  /**
   * Returns a direct URL for the PDF session report.
   * Use as an <a href> download link or window.open() — the browser will handle streaming.
   */
  getSessionReportUrl(sessionId: string): string {
    return `/api/fastapi/sessions/${sessionId}/report`;
  },

  // ── Questions ────────────────────────────────────────────────────────────────

  listQuestions(): Promise<ApiResponse<APIQuestion[]>> {
    return fastapiApi.get<APIQuestion[]>("/questions/");
  },

  listQuestionTypes(): Promise<ApiResponse<string[]>> {
    return fastapiApi.get<string[]>("/questions/types/");
  },

  getQuestion(questionId: string): Promise<ApiResponse<APIQuestion>> {
    return fastapiApi.get<APIQuestion>(`/questions/${questionId}`);
  },

  getQuestionsByType(
    questionType: string,
  ): Promise<ApiResponse<APIQuestion[]>> {
    return fastapiApi.get<APIQuestion[]>(`/questions/type/${questionType}`);
  },

  createQuestion(payload: APIQuestionCreate): Promise<ApiResponse<APIQuestion>> {
    return fastapiApi.post<APIQuestion>("/questions/", payload);
  },

  massCreateQuestions(
    payload: APIQuestionCreate[],
  ): Promise<ApiResponse<APIQuestion[]>> {
    return fastapiApi.post<APIQuestion[]>("/questions/mass_create/", payload);
  },

  // ── Answers ──────────────────────────────────────────────────────────────────

  /**
   * Submit an audio/video recording for a question.
   * `audio` should be the raw Blob from MediaRecorder (webm format).
   */
  submitAnswer(
    sessionId: string,
    questionId: string,
    audio: Blob,
    isFollowup = false,
  ): Promise<ApiResponse<APISubmitAnswerResponse>> {
    const form = new FormData();
    form.append("session_id", sessionId);
    form.append("question_id", questionId);
    form.append("audio", audio, "answer.webm");
    form.append("is_followup", isFollowup ? "true" : "false");
    return fastapiApi.post<APISubmitAnswerResponse>("/answers/", form, { noRetry: true });
  },

  /**
   * Trigger server-side evaluation (FER + SER + sentiment + AI scoring)
   * for a previously submitted answer. May return a follow-up question.
   */
  evaluateAnswer(
    sessionId: string,
    questionId: string,
    isFollowup = false,
    answerId?: string,
  ): Promise<ApiResponse<APIEvaluationResponse | null>> {
    const form = new FormData();
    form.append("session_id", sessionId);
    form.append("question_id", questionId);
    form.append("is_followup", isFollowup ? "true" : "false");
    if (answerId) {
      form.append("answer_id", answerId);
    }
    return fastapiApi
      .post<unknown>("/answers/evaluate/", form, { noRetry: true })
      .then((response) => {
        if (!response.success) {
          return {
            ...response,
            data: null,
          };
        }

        const normalized = normalizeEvaluationPayload(response.data);
        if (!normalized) {
          return {
            ...response,
            success: false,
            message: response.message || "Unexpected evaluation response from server.",
            data: null,
          };
        }

        return {
          ...response,
          data: normalized,
        };
      });
  },

  getAnswerByQuestionSession(
    questionId: string,
    sessionId: string,
  ): Promise<ApiResponse<APIAnswerRead | null>> {
    return fastapiApi.get<APIAnswerRead | null>("/answers/by_question_session/", {
      params: {
        question_id: questionId,
        session_id: sessionId,
      },
    });
  },

  async getFollowupByAnswerId(
    answerId: string,
  ): Promise<ApiResponse<APIFollowup | null>> {
    const response = await fastapiApi.get<APIFollowupRead | null>(`/followups/${answerId}`);

    if (!response.success) {
      return {
        ...response,
        data: null,
      };
    }

    if (!response.data) {
      return {
        ...response,
        data: null,
      };
    }

    return {
      ...response,
      data: {
        id: response.data.id,
        text: response.data.fquestion_text,
        audio: normalizeInterviewAudioUrl(response.data.fquestion_audio, "followups"),
      },
    };
  },

} as const;
