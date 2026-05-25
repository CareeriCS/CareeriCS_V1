import { fastapiApi } from "@/lib/api";
import type {
  ApiResponse,
  JourneyTrackProgress,
  JourneyTrackProgressList,
  JourneyTrackProgressUpsertRequest,
} from "@/types";

export const journeyService = {
  getUserJourneyProgress(userId: string): Promise<ApiResponse<JourneyTrackProgressList>> {
    return fastapiApi.get<JourneyTrackProgressList>(`/journey/progress/${userId}`);
  },

  upsertTrackProgress(
    userId: string,
    trackId: string,
    payload: JourneyTrackProgressUpsertRequest,
  ): Promise<ApiResponse<JourneyTrackProgress>> {
    return fastapiApi.put<JourneyTrackProgress>(
      `/journey/progress/${userId}/tracks/${trackId}`,
      payload,
    );
  },

  deleteTrackProgress(userId: string, trackId: string): Promise<ApiResponse<null>> {
    return fastapiApi.delete<null>(`/journey/progress/${userId}/tracks/${trackId}`);
  },
} as const;
