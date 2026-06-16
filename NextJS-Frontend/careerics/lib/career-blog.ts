/**
 * Career blog service for fetching career level details.
 * Provides data for the Job Details / Career Blog UI.
 */

import { fastapiApi } from "@/lib/api/clients";
import type { ApiResponse } from "@/types";

export interface LevelDetail {
  salary: string;
  demand: string;
  demandColor: string;
  responsibilities: string[];
  fitReason: string[];
  skills: string[];
}

export interface CareerBlogDetails {
  Entry: LevelDetail;
  Junior: LevelDetail;
  Senior: LevelDetail;
}

/**
 * Format salary range values coming from the API.
 * Normalizes strings like "$50K - $80K" or "50k-80k" into "$50 - $80" or "50 - 80".
 */
export function formatSalaryRange(value: string): string {
  return value.replace(/(\d)\s*[kK]\b/g, "$1").trim();
}

/**
 * Fetch career blog details for a specific career and level.
 *
 * @param careerId - The career ID (UUID from career_tracks.id)
 * @param level - The career level (Entry, Junior, or Senior)
 * @returns Promise with career details response
 */
export async function fetchCareerBlogDetails(
  careerId: string,
  level: string = "Junior"
): Promise<ApiResponse<CareerBlogDetails | null>> {
  try {
    const params: Record<string, string> = {
      careerId: careerId,
      level: level,
    };

    return await fastapiApi.get<CareerBlogDetails>(
      "/blog/career-details",
      {
        params: params as Record<string, string | number | boolean>,
      }
    );
  } catch (error) {
    console.error("Error fetching career blog details:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch career details",
      data: null,
    };
  }
}
