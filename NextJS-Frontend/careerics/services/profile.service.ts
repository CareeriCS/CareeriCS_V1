import { fastapiApi } from "@/lib/api";
import type { ApiResponse, UserProfile, UserProfileUpsertRequest } from "@/types";

export const profileService = {
  getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return fastapiApi.get<UserProfile>(`/users/profile/${userId}`);
  },

  upsertUserProfile(
    userId: string,
    payload: UserProfileUpsertRequest,
  ): Promise<ApiResponse<UserProfile>> {
    return fastapiApi.put<UserProfile>(`/users/profile/${userId}`, payload);
  },

  updateUserProfile(
    userId: string,
    payload: UserProfileUpsertRequest,
  ): Promise<ApiResponse<UserProfile>> {
    return fastapiApi.patch<UserProfile>(`/users/profile/${userId}`, payload);
  },
} as const;
