const BEHAVIORAL_INTERVIEW_TYPE = "HR";
export const MIN_INTERVIEW_QUESTION_COUNT = 5;
export const MAX_INTERVIEW_QUESTION_COUNT = 15;
export const DEFAULT_INTERVIEW_QUESTION_COUNT = 5;

export function isBehavioralInterviewType(value: string | null | undefined): boolean {
  return (value || "").trim().toLowerCase() === "hr";
}

export function normalizeInterviewType(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return BEHAVIORAL_INTERVIEW_TYPE;
  }

  if (isBehavioralInterviewType(trimmed)) {
    return BEHAVIORAL_INTERVIEW_TYPE;
  }

  return trimmed;
}

export function getTechnicalInterviewTypes(types: string[]): string[] {
  return types.filter((type) => !isBehavioralInterviewType(type));
}

export function normalizeInterviewQuestionCount(
  value: number | string | null | undefined,
  minQuestions: number = MIN_INTERVIEW_QUESTION_COUNT,
  maxQuestions: number = MAX_INTERVIEW_QUESTION_COUNT,
  fallback: number = DEFAULT_INTERVIEW_QUESTION_COUNT,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (normalized < minQuestions) {
    return minQuestions;
  }

  if (normalized > maxQuestions) {
    return maxQuestions;
  }

  return normalized;
}

export function buildInterviewRecordingRoute(
  interviewType: string,
  sessionId: string | null,
  questionCount: number = DEFAULT_INTERVIEW_QUESTION_COUNT,
): string {
  const params = new URLSearchParams({
    type: normalizeInterviewType(interviewType),
    q: "1",
    count: String(normalizeInterviewQuestionCount(questionCount)),
  });

  if (sessionId) {
    params.set("sessionId", sessionId);
  }

  return `/interview-feature/recording?${params.toString()}`;
}

export function buildInterviewSessionName(interviewType: string): string {
  const normalizedType = normalizeInterviewType(interviewType);
  if (isBehavioralInterviewType(normalizedType)) {
    return "Behavioral Mock Interview";
  }

  return `${normalizedType} Technical Mock Interview`;
}

export function formatInterviewArchiveDate(value?: string | null): string {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString();
}
