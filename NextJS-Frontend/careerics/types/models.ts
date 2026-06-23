/** Domain entity types — expand as your schema grows. */

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "admin" | "user" | "guest";

/** Auth session shape (used by auth provider + middleware). */
export interface AuthSession {
  user: Pick<User, "id" | "email" | "displayName" | "role">;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix epoch seconds
}

// ── Interview domain ────────────────────────────

export type InterviewSessionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "cancelled";

export type QuestionStatus = "pending" | "recording" | "recorded" | "skipped";

export interface InterviewQuestion {
  id: string;
  index: number;
  text: string;
  status: QuestionStatus;
  /** Duration of the recorded answer in seconds (null if not yet recorded). */
  recordedDurationSec: number | null;
  /** URL to the recorded video blob / upload (null until recorded). */
  videoUrl: string | null;
}

export interface InterviewSession {
  id: string;
  title: string;
  code: string; // e.g. "001"
  status: InterviewSessionStatus;
  questions: InterviewQuestion[];
  /** Total allowed time per question in seconds. */
  timeLimitPerQuestionSec: number;
  createdAt: string;
  updatedAt: string;
}

// ── FastAPI Interview domain ─────────────────────────

export interface APISession {
  id: string;
  name: string;
  type: string;
  status: string;
  user_id: string;
  created_at?: string | null;
  emotion_evaluation?: Record<string, unknown> | null;
  tone_evaluation?: Record<string, unknown> | null;
  sentiment_evaluation?: Record<string, unknown> | null;
}

export interface APISessionCreate {
  name: string;
  type: string;
  status: string;
  user_id: string;
}

export interface APISessionUpdate {
  status?: string;
  emotion_evaluation?: Record<string, unknown> | null;
  tone_evaluation?: Record<string, unknown> | null;
  sentiment_evaluation?: Record<string, unknown> | null;
}

export interface APIInterviewArchiveItem {
  session_id: string;
  session_name: string;
  session_type: string;
  session_created_at?: string | null;
  report_id: string;
  report_filename: string;
  report_created_at: string;
}

export interface APICompleteInterviewSessionResponse {
  session: APISession;
  report: APIReport;
}

export interface APIQuestion {
  id: string;
  type: string;
  question_text: string;
  question_audio?: string | null;
}

export interface APIQuestionCreate {
  type: string;
  question_text: string;
  question_audio?: string;
}

export interface APISubmitAnswerResponse {
  answer_id: string;
  answer_text: string;
  answer_audio: string;
}

export interface APIAnswerRead {
  id: string;
  session_id: string;
  question_id: string | null;
  answer_text: string | null;
  answer_audio: string | null;
}

export interface APIFollowup {
  id: string;
  text: string;
  audio: string;
}

export interface APIFollowupRead {
  id: string;
  answer_id: string;
  fquestion_text: string;
  fquestion_audio: string | null;
}

export interface APIEvaluationResponse {
  evaluation: string | null;
  grade: number | null;
  followup_recommended?: boolean;
  followup: APIFollowup | null;
  emotion_evaluation: Record<string, unknown> | null;
  tone_evaluation: Record<string, unknown> | null;
  sentiment_evaluation: Record<string, unknown> | null;
}

// ── FastAPI CV domain ─────────────────────────────────

export interface CVSkillEntry {
  id: string;
  isCV: boolean;
  proficiency?: string | null;
  skill: { id: string; skill_name: string };
}

export interface CVExperience {
  id?: string;
  role: string;
  organization?: string | null;
  period?: string | null;
  responsibilities?: string[] | null;
  achievements?: string | null;
}

export interface CVEducation {
  id?: string;
  qualification?: string | null;
  institution?: string | null;
  period?: string | null;
  details?: string | null;
}

export interface CVCertification {
  id?: string;
  title?: string | null;
  organization?: string | null;
  period?: string | null;
}

export interface CVProject {
  id?: string;
  title?: string | null;
  description?: string | null;
  role?: string | null;
  technologies?: string[] | null;
  achievements?: string | null;
}

export interface CVLanguage {
  id?: string;
  language: string;
  proficiency?: string | null;
}

export interface CVAward {
  id?: string;
  title: string;
  organization?: string | null;
  date?: string | null;
  description?: string | null;
}

export interface CVReference {
  id?: string;
  name: string;
  role?: string | null;
  organization?: string | null;
  contact_info?: string | null;
}

export interface CVProfile {
  id?: string;
  full_name: string;
  professional_title?: string | null;
  email?: string | null;
  secondary_email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  username?: string | null;
  summary?: string | null;
  skills: CVSkillEntry[];
  experiences: CVExperience[];
  education: CVEducation[];
  certifications: CVCertification[];
  projects: CVProject[];
  languages: CVLanguage[];
  awards: CVAward[];
  references: CVReference[];
}

export interface UserProfile {
  id: string;
  full_name: string;
  professional_title?: string | null;
  email?: string | null;
  secondary_email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin?: string | null;
  portfolio?: string | null;
  github?: string | null;
  username?: string | null;
  summary?: string | null;
  created_at: string;
}

export interface UserProfileUpsertRequest {
  full_name?: string | null;
  professional_title?: string | null;
  email?: string | null;
  secondary_email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
