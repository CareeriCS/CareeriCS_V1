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
  linkedin?: string | null;
  portfolio?: string | null;
  github?: string | null;
  username?: string | null;
  summary?: string | null;
  auth_display_name?: string | null;
}

// ── FastAPI Roadmap domain ─────────────────────────

export type RoadmapCompletionStatus = "not_started" | "in_progress" | "completed";

export interface RoadmapResource {
  resourceType?: string;
  title?: string;
  url?: string;
  [key: string]: unknown;
}

export interface RoadmapStepRead {
  id: string;
  title: string;
  description?: string;
  order: number;
  resources: RoadmapResource[];
}

export interface RoadmapSectionRead {
  id: string;
  title: string;
  description?: string;
  order: number;
  courses_count?: number;
  steps: RoadmapStepRead[];
}

export interface RoadmapRead {
  id: string;
  title: string;
  description?: string;
  sections: RoadmapSectionRead[];
}

export interface RoadmapListItem {
  id: string;
  title: string;
  description?: string;
  sections_count: number;
  steps_count: number;
}

export interface RoadmapCourse {
  id: string;
  provider: string;
  title: string;
  url?: string;
  description?: string | null;
  language?: string | null;
  is_free?: boolean | null;
  rating?: number | null;
  provider_course_id?: string | null;
  rank_in_provider?: number | null;
}

export interface RoadmapCoursesSection {
  section_id: string;
  section_title: string;
  order: number;
  courses: RoadmapCourse[];
}

export interface RoadmapCoursesRead {
  roadmap_id: string;
  roadmap_title: string;
  sections: RoadmapCoursesSection[];
}

export interface UserRoadmapBookmark {
  roadmap_id: string;
  created_at: string;
}

export interface UserRoadmapBookmarkList {
  user_id: string;
  bookmarks: UserRoadmapBookmark[];
}

export interface UserRoadmapBookmarkToggle {
  roadmap_id: string;
  bookmarked: boolean;
}

export type UnifiedBookmarkKind = "roadmap" | "career";
export type UnifiedBookmarkSource = "roadmap" | "career_quiz";

export interface UnifiedBookmarkMetadata {
  roadmap_id?: string | null;
  session_id?: string | null;
  track_id?: string | null;
  track_name?: string | null;
  source?: UnifiedBookmarkSource | null;
}

export interface UnifiedBookmarkEntry {
  kind: UnifiedBookmarkKind;
  entity_id: string;
  title: string;
  description?: string | null;
  score?: number | null;
  target_href?: string | null;
  metadata?: UnifiedBookmarkMetadata | null;
  saved_at: string;
}

export interface UnifiedBookmarkDraft {
  kind: UnifiedBookmarkKind;
  entity_id: string;
  title: string;
  description?: string | null;
  score?: number | null;
  target_href?: string | null;
  metadata?: UnifiedBookmarkMetadata | null;
  saved_at?: string;
}

export interface StepProgressUpsertRequest {
  completion_status: RoadmapCompletionStatus;
  score?: number | null;
  proficiency?: string | null;
}

export interface StepProgressRead {
  step_id: string;
  completion_status: RoadmapCompletionStatus;
  completed_at?: string | null;
  score?: number | null;
  proficiency?: string | null;
}

export interface SectionProgressSummary {
  section_id: string;
  title: string;
  completion_status: RoadmapCompletionStatus;
  completed_steps: number;
  total_steps: number;
  completion_percent: number;
  steps: StepProgressRead[];
}

export interface RoadmapProgressSummary {
  roadmap_id: string;
  title: string;
  completion_status: RoadmapCompletionStatus;
  completed_sections: number;
  total_sections: number;
  completed_steps: number;
  total_steps: number;
  completion_percent: number;
  sections: SectionProgressSummary[];
}

export interface UserRoadmapProgressItem {
  roadmap_id: string;
  title: string;
  completion_status: RoadmapCompletionStatus;
  completion_percent: number;
}

export interface UserRoadmapProgressList {
  user_id: string;
  roadmaps: UserRoadmapProgressItem[];
}

export interface CurrentRoadmapLearning {
  roadmap_id: string;
  roadmap_title: string;
  section_id?: string | null;
  section_title?: string | null;
  step_id?: string | null;
  step_title?: string | null;
  progress_percent: number;
}

export interface JourneyTrackProgress {
  track_id: string;
  roadmap_id?: string | null;
  current_phase: number;
  max_reached_phase: number;
  has_started: boolean;
  is_selected: boolean;
  last_visited_at: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyTrackProgressList {
  user_id: string;
  tracks: JourneyTrackProgress[];
}

export interface JourneyTrackProgressUpsertRequest {
  roadmap_id?: string | null;
  current_phase: number;
  max_reached_phase: number;
  has_started?: boolean;
  is_selected?: boolean;
  last_visited_at?: string | null;
}

// ── FastAPI Skills domain ───────────────────────────────

export interface APISkill {
  id: string;
  skill_name: string;
}

// ── FastAPI Skill assessment domain ─────────────────────

export type APIAssessmentSessionType = "skills" | "roadmap" | "section" | "step";

export interface APIStartAssessmentRequest {
  target_id: string;
  num_questions: number;
  session_type: APIAssessmentSessionType;
}

export interface APIAssessmentQuestion {
  id: string;
  question_text: string;
  options: string[];
}

export interface APIStartAssessmentResponse {
  session_id: string;
  questions: APIAssessmentQuestion[];
}

export interface APIAssessmentAnswerInput {
  question_id: string;
  selected_answer: string;
}

export interface APIAssessmentQuestionResult {
  question_id: string;
  selected_answer: string;
  correct_answer: string;
  explanation: string;
  is_correct: boolean;
}

export interface APISubmitAssessmentResponse {
  session_id: string;
  score: number;
  total_questions: number;
  results: APIAssessmentQuestionResult[];
}

export interface APIAssessmentSessionSummary {
  id: string;
  user_id: string;
  type: APIAssessmentSessionType | string;
  skill_id?: string | null;
  roadmap_id?: string | null;
  section_id?: string | null;
  step_id?: string | null;
  total_questions: number;
  score: number;
  status: string;
  started_at: string;
  submitted_at?: string | null;
}

// ── FastAPI Reports domain ──────────────────────────────

export type APIReportType = "cv" | "interview_session" | "skill_assessment" | "other";

export interface APIReport {
  id: string;
  filename: string;
  created_at: string;
  type: APIReportType;
}

export interface GoogleDriveUploadedFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  webContentLink?: string | null;
}

export type GoogleDriveUploadErrorCode =
  | "UNAUTHENTICATED"
  | "GOOGLE_DRIVE_SCOPE_MISSING"
  | "GOOGLE_DRIVE_API_DISABLED"
  | "GOOGLE_DRIVE_TOKEN_MISSING"
  | "GOOGLE_DRIVE_TOKEN_EXPIRED"
  | "GENERATED_FILE_MISSING"
  | "GOOGLE_DRIVE_UPLOAD_FAILED";

// ── FastAPI Career quiz domain ──────────────────────────

export type APICareerCardType = "hobby" | "technical";

export interface APICareerSessionCreate {
  user_id: string;
  status?: string;
}

export interface APICareerSessionRead {
  id: string;
  user_id: string;
  status: string;
  started_at?: string | null;
  submitted_at?: string | null;
}

export interface APICareerCardRead {
  id: string;
  name: string;
  description?: string | null;
}

export interface APICareerCardSelectionItem {
  id: string;
  type: APICareerCardType;
}

export interface APICareerSelectedCardRead {
  type: APICareerCardType;
  id: string;
  name: string;
}

export interface APICareerQuestionResponse {
  id: string;
  hobby_id?: string | null;
  technical_skill_id?: string | null;
  text: string;
  type: APICareerCardType;
}

export interface APICareerAnswerInput {
  question_id: string;
  answer: number;
}

export interface APICareerAnswerRead {
  id: string;
  session_id: string;
  question_id: string;
  answer: number;
}

export interface APICareerTrack {
  id: string;
  name: string;
  description?: string | null;
}

export interface APICareerTrackScore {
  track_id: string;
  track_name: string;
  track_description?: string | null;
  roadmap_id?: string | null;
  score: number;
}

export interface APICareerEvaluationRead {
  track_scores: APICareerTrackScore[];
}

// —— Local course progress domain ———————————————————————————————————————————————————————

export interface CourseProgressTimeline {
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

export type CourseProgressStatus = "saved" | "enrolled" | "completed";

export interface CourseProgressResponse {
  id: string;
  course_id: string;
  user_id: string;
  status: CourseProgressStatus;
  started_at?: string | null;
  completed_at?: string | null;
  saved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCourseProgressItem {
  course_id: string;
  status: CourseProgressStatus;
  title: string;
  provider?: string | null;
  url: string;
  started_at?: string | null;
  completed_at?: string | null;
  saved_at?: string | null;
  updated_at: string;
}

export interface UserCourseProgressList {
  user_id: string;
  current: UserCourseProgressItem[];
  completed: UserCourseProgressItem[];
}

export interface CourseStatusUpdateRequest {
  status: CourseProgressStatus;
}
