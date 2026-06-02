import { fastapiApi } from "@/lib/api";
import type {
  APIAssessmentAnswerInput,
  APIAssessmentSessionSummary,
  APIStartAssessmentRequest,
  APIStartAssessmentResponse,
  APISubmitAssessmentResponse,
  ApiResponse,
} from "@/types";

export const skillAssessmentService = {
  startSession(
    userId: string,
    payload: APIStartAssessmentRequest,
  ): Promise<ApiResponse<APIStartAssessmentResponse>> {
    return fastapiApi.post<APIStartAssessmentResponse>(
      `/skill_assessment/session/start/${userId}`,
      payload,
    );
  },

  getUserSessions(userId: string): Promise<ApiResponse<APIAssessmentSessionSummary[]>> {
    return fastapiApi.get<APIAssessmentSessionSummary[]>(
      `/skill_assessment/session/user/${userId}`,
    );
  },

  updateSessionStatus(
    sessionId: string,
    payload: { status: string },
  ): Promise<ApiResponse<APIAssessmentSessionSummary>> {
    return fastapiApi.put<APIAssessmentSessionSummary>(
      `/skill_assessment/session/${sessionId}/status`,
      payload,
    );
  },

  submitAnswers(
    userId: string,
    sessionId: string,
    answers: APIAssessmentAnswerInput[],
  ): Promise<ApiResponse<APISubmitAssessmentResponse>> {
    return fastapiApi.post<APISubmitAssessmentResponse>(
      `/skill_assessment/answers/submit/${userId}`,
      {
        session_id: sessionId,
        answers,
      },
    );
  },

  getResults(
    userId: string,
    sessionId: string,
  ): Promise<ApiResponse<APISubmitAssessmentResponse>> {
    return fastapiApi.get<APISubmitAssessmentResponse>(
      `/skill_assessment/answers/results/${userId}/${sessionId}`,
    );
  },
} as const;
