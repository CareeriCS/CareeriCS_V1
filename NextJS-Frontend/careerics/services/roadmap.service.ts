/**
 * Roadmap service — backend calls for roadmap discovery and progress tracking.
 *
 * Maps directly to FastAPI routes:
 *   GET  /roadmaps
 *   GET  /roadmaps/{roadmap_id}
 *   GET  /roadmaps/by-title/{title}
 *   GET  /roadmaps/bookmarks/{user_id}
 *   POST /roadmaps/{roadmap_id}/bookmarks/{user_id}
 *   GET  /roadmaps/{roadmap_id}/progress/{user_id}
 *   GET  /roadmaps/progress/{user_id}
 *   PUT  /roadmaps/{roadmap_id}/progress/{user_id}/steps/{step_id}
 */

import { fastapiApi } from "@/lib/api";
import type {
  CurrentRoadmapLearning,
  ApiResponse,
  RoadmapCoursesRead,
  RoadmapListItem,
  RoadmapProgressSummary,
  RoadmapRead,
  StepProgressUpsertRequest,
  UserRoadmapBookmarkList,
  UserRoadmapBookmarkToggle,
  UserRoadmapProgressList,
} from "@/types";

export const roadmapService = {
  listRoadmaps(): Promise<ApiResponse<RoadmapListItem[]>> {
    return fastapiApi.get<RoadmapListItem[]>("/roadmaps");
  },

  getRoadmapById(roadmapId: string): Promise<ApiResponse<RoadmapRead>> {
    return fastapiApi.get<RoadmapRead>(`/roadmaps/${roadmapId}`);
  },

  getRoadmapCourses(roadmapId: string): Promise<ApiResponse<RoadmapCoursesRead>> {
    return fastapiApi.get<RoadmapCoursesRead>(`/roadmaps/${roadmapId}/courses`);
  },

  getRoadmapByTitle(title: string): Promise<ApiResponse<RoadmapRead>> {
    return fastapiApi.get<RoadmapRead>(`/roadmaps/by-title/${encodeURIComponent(title)}`);
  },

  getUserRoadmapBookmarks(userId: string): Promise<ApiResponse<UserRoadmapBookmarkList>> {
    return fastapiApi.get<UserRoadmapBookmarkList>(`/roadmaps/bookmarks/${userId}`);
  },

  toggleRoadmapBookmark(
    roadmapId: string,
    userId: string,
  ): Promise<ApiResponse<UserRoadmapBookmarkToggle>> {
    return fastapiApi.post<UserRoadmapBookmarkToggle>(`/roadmaps/${roadmapId}/bookmarks/${userId}`);
  },

  async isRoadmapBookmarked(
    roadmapId: string,
    userId: string,
  ): Promise<ApiResponse<UserRoadmapBookmarkToggle>> {
    const response = await fastapiApi.get<UserRoadmapBookmarkList>(`/roadmaps/bookmarks/${userId}`);
    if (!response.success || !response.data?.bookmarks) {
      return {
        data: null as unknown as UserRoadmapBookmarkToggle,
        success: false,
        message: response.message || "Unable to load roadmap bookmarks right now.",
        errors: response.errors,
      };
    }

    return {
      data: {
        roadmap_id: roadmapId,
        bookmarked: response.data.bookmarks.some((bookmark) => bookmark.roadmap_id === roadmapId),
      },
      success: true,
    };
  },

  async addRoadmapBookmark(
    roadmapId: string,
    userId: string,
  ): Promise<ApiResponse<UserRoadmapBookmarkToggle>> {
    const statusResponse = await fastapiApi.get<UserRoadmapBookmarkList>(`/roadmaps/bookmarks/${userId}`);
    if (!statusResponse.success || !statusResponse.data?.bookmarks) {
      return {
        data: null as unknown as UserRoadmapBookmarkToggle,
        success: false,
        message: statusResponse.message || "Unable to load roadmap bookmarks right now.",
        errors: statusResponse.errors,
      };
    }

    if (statusResponse.data.bookmarks.some((bookmark) => bookmark.roadmap_id === roadmapId)) {
      return {
        data: {
          roadmap_id: roadmapId,
          bookmarked: true,
        },
        success: true,
      };
    }

    return fastapiApi.post<UserRoadmapBookmarkToggle>(`/roadmaps/${roadmapId}/bookmarks/${userId}`);
  },

  async removeRoadmapBookmark(
    roadmapId: string,
    userId: string,
  ): Promise<ApiResponse<UserRoadmapBookmarkToggle>> {
    const statusResponse = await fastapiApi.get<UserRoadmapBookmarkList>(`/roadmaps/bookmarks/${userId}`);
    if (!statusResponse.success || !statusResponse.data?.bookmarks) {
      return {
        data: null as unknown as UserRoadmapBookmarkToggle,
        success: false,
        message: statusResponse.message || "Unable to load roadmap bookmarks right now.",
        errors: statusResponse.errors,
      };
    }

    if (!statusResponse.data.bookmarks.some((bookmark) => bookmark.roadmap_id === roadmapId)) {
      return {
        data: {
          roadmap_id: roadmapId,
          bookmarked: false,
        },
        success: true,
      };
    }

    return fastapiApi.post<UserRoadmapBookmarkToggle>(`/roadmaps/${roadmapId}/bookmarks/${userId}`);
  },

  getRoadmapProgress(
    roadmapId: string,
    userId: string,
  ): Promise<ApiResponse<RoadmapProgressSummary>> {
    return fastapiApi.get<RoadmapProgressSummary>(`/roadmaps/${roadmapId}/progress/${userId}`);
  },

  getUserRoadmapsProgress(userId: string): Promise<ApiResponse<UserRoadmapProgressList>> {
    return fastapiApi.get<UserRoadmapProgressList>(`/roadmaps/progress/${userId}`);
  },

  getCurrentRoadmapLearning(
    userId: string,
    roadmapId?: string,
  ): Promise<ApiResponse<CurrentRoadmapLearning>> {
    const query = roadmapId ? `?roadmap_id=${encodeURIComponent(roadmapId)}` : "";
    return fastapiApi.get<CurrentRoadmapLearning>(`/roadmaps/current/${userId}${query}`);
  },

  upsertStepProgress(
    roadmapId: string,
    userId: string,
    stepId: string,
    payload: StepProgressUpsertRequest,
  ): Promise<ApiResponse<RoadmapProgressSummary>> {
    return fastapiApi.put<RoadmapProgressSummary>(
      `/roadmaps/${roadmapId}/progress/${userId}/steps/${stepId}`,
      payload,
    );
  },
} as const;
