import { fastapiApi } from "@/lib/api";
import type {
  ApiResponse,
  CourseProgressResponse,
  CourseStatusUpdateRequest,
  UserCourseProgressList,
} from "@/types";

export const courseService = {
  getUserCourseProgress(userId: string): Promise<ApiResponse<UserCourseProgressList>> {
    return fastapiApi.get<UserCourseProgressList>(`/courses/progress/${userId}`);
  },

  updateCourseStatus(
    courseId: string,
    userId: string,
    payload: CourseStatusUpdateRequest,
  ): Promise<ApiResponse<CourseProgressResponse>> {
    return fastapiApi.put<CourseProgressResponse>(
      `/courses/${courseId}/status?user_id=${encodeURIComponent(userId)}`,
      payload,
    );
  },
} as const;
