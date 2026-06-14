import { careerService } from "@/services";

export const CAREER_FEATURE_ROUTE = "/features/career";

export function buildCareerQuizSelectionHref(sessionId: string): string {
  return `/quiz-features/hobbies?sessionId=${encodeURIComponent(sessionId)}`;
}

export function buildCareerQuizResultsHref(
  sessionId: string,
  trackId?: string | null,
): string {
  const params = new URLSearchParams({
    sessionId,
  });

  if (trackId) {
    params.set("trackId", trackId);
  }

  return `/quiz-features/results?${params.toString()}`;
}

export function buildCareerTrackDetailsHref(
  trackName: string,
  trackId?: string | null,
): string {
  const params = new URLSearchParams({
    jobTitle: trackName,
  });

  if (trackId) {
    params.set("trackId", trackId);
  }

  return `/quiz-features/blog?${params.toString()}`;
}

export function resolveCareerBookmarkHref(options: {
  trackId: string;
  trackName?: string | null;
}): string {
  if (options.trackName) {
    return buildCareerTrackDetailsHref(options.trackName, options.trackId);
  }

  return CAREER_FEATURE_ROUTE;
}

export async function startCareerQuizSession(userId: string): Promise<string> {
  const response = await careerService.createSession({ user_id: userId });

  if (!response.success || !response.data?.id) {
    throw new Error(response.message || "Unable to start the career quiz right now.");
  }

  return response.data.id;
}
