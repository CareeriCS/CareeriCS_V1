import { fastapiApi } from "@/lib/api";
import type {
  APICareerAnswerInput,
  APICareerAnswerRead,
  APICareerCardRead,
  APICareerCardSelectionItem,
  APICareerCardType,
  APICareerEvaluationRead,
  APICareerQuestionResponse,
  APICareerSelectedCardRead,
  APICareerSessionCreate,
  APICareerSessionRead,
  APICareerTrack,
  ApiResponse,
} from "@/types";

let cachedCareerTracks: APICareerTrack[] | null = null;
let careerTracksPromise: Promise<ApiResponse<APICareerTrack[]>> | null = null;
const USER_SESSIONS_CACHE_TTL_MS = 5_000;
const userSessionsCache = new Map<
  string,
  {
    data: APICareerSessionRead[];
    expiresAt: number;
  }
>();
const userSessionsPromiseCache = new Map<
  string,
  Promise<ApiResponse<APICareerSessionRead[]>>
>();

function getUserSessionsCacheKey(userId: string): string {
  return userId.trim();
}

function getCachedUserSessions(
  userId: string,
): APICareerSessionRead[] | null {
  const cacheKey = getUserSessionsCacheKey(userId);
  const cached = userSessionsCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    userSessionsCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

export const careerService = {
  listTracks(): Promise<ApiResponse<APICareerTrack[]>> {
    if (cachedCareerTracks) {
      return Promise.resolve({
        data: cachedCareerTracks,
        success: true,
      });
    }

    if (careerTracksPromise) {
      return careerTracksPromise;
    }

    careerTracksPromise = fastapiApi.get<APICareerTrack[]>("/career/tracks/").then((response) => {
      if (response.success && response.data) {
        cachedCareerTracks = response.data;
      }

      return response;
    }).finally(() => {
      careerTracksPromise = null;
    });

    return careerTracksPromise;
  },

  createSession(
    payload: APICareerSessionCreate,
  ): Promise<ApiResponse<APICareerSessionRead>> {
    return fastapiApi.post<APICareerSessionRead>("/career/sessions/", payload);
  },

  getSession(
    sessionId: string,
  ): Promise<ApiResponse<APICareerSessionRead>> {
    return fastapiApi.get<APICareerSessionRead>(`/career/sessions/${sessionId}`);
  },

  getUserSessions(
    userId: string,
  ): Promise<ApiResponse<APICareerSessionRead[]>> {
    const cachedSessions = getCachedUserSessions(userId);
    if (cachedSessions) {
      return Promise.resolve({
        data: cachedSessions,
        success: true,
      });
    }

    const cacheKey = getUserSessionsCacheKey(userId);
    const pendingRequest = userSessionsPromiseCache.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const nextRequest = fastapiApi
      .get<APICareerSessionRead[]>(`/career/sessions/user/${userId}`)
      .then((response) => {
        if (response.success && response.data) {
          userSessionsCache.set(cacheKey, {
            data: response.data,
            expiresAt: Date.now() + USER_SESSIONS_CACHE_TTL_MS,
          });
        }

        return response;
      })
      .finally(() => {
        userSessionsPromiseCache.delete(cacheKey);
      });

    userSessionsPromiseCache.set(cacheKey, nextRequest);
    return nextRequest;
  },

  updateSessionStatus(
    sessionId: string,
    payload: { status: string },
  ): Promise<ApiResponse<APICareerSessionRead>> {
    return fastapiApi
      .put<APICareerSessionRead>(`/career/sessions/${sessionId}/status`, payload)
      .then((response) => {
        if (response.success && response.data?.user_id) {
          const cacheKey = getUserSessionsCacheKey(response.data.user_id);
          userSessionsCache.delete(cacheKey);
          userSessionsPromiseCache.delete(cacheKey);
        }

        return response;
      });
  },

  getCardsByType(
    cardType: APICareerCardType,
  ): Promise<ApiResponse<APICareerCardRead[]>> {
    return fastapiApi.get<APICareerCardRead[]>(`/career/cards/${cardType}`);
  },

  selectCards(
    sessionId: string,
    cards: APICareerCardSelectionItem[],
  ): Promise<ApiResponse<APICareerSelectedCardRead[]>> {
    return fastapiApi.post<APICareerSelectedCardRead[]>(
      `/career/cards/select/${sessionId}`,
      { cards },
    );
  },

  getSelectedCards(
    sessionId: string,
  ): Promise<ApiResponse<APICareerSelectedCardRead[]>> {
    return fastapiApi.get<APICareerSelectedCardRead[]>(
      `/career/cards/selected/${sessionId}`,
    );
  },

  getQuestionsForSession(
    sessionId: string,
  ): Promise<ApiResponse<APICareerQuestionResponse[]>> {
    return fastapiApi.get<APICareerQuestionResponse[]>(`/career/questions/${sessionId}`);
  },

  submitAnswers(
    sessionId: string,
    answers: APICareerAnswerInput[],
  ): Promise<ApiResponse<APICareerAnswerRead[]>> {
    return fastapiApi.post<APICareerAnswerRead[]>(
      `/career/answers/${sessionId}`,
      { answers },
    );
  },

  evaluateCareerQuiz(
    sessionId: string,
  ): Promise<ApiResponse<APICareerEvaluationRead>> {
    return fastapiApi.get<APICareerEvaluationRead>(`/career/answers/${sessionId}/evaluate`);
  },

  getCareerResults(
    sessionId: string,
  ): Promise<ApiResponse<APICareerEvaluationRead>> {
    return fastapiApi.get<APICareerEvaluationRead>(`/career/answers/${sessionId}/results`);
  },
} as const;
