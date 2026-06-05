-- Phase 1 low-risk database index proposal for PostgreSQL/Supabase.
--
-- This repository does not currently include a tracked Alembic/migration setup
-- outside the virtualenv, so this file is intentionally a proposed SQL script.
-- Review and approve before applying it to any database.
--
-- The statements use CONCURRENTLY to reduce lock impact on PostgreSQL.
-- Run these statements outside an explicit transaction block.

-- idx_reports_user_type_created_at_desc:
-- Supports report list lookups by user/type ordered newest-first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_user_type_created_at_desc
    ON reports (user_id, type, created_at DESC);

-- idx_job_applications_user_job_post_updated_at_desc:
-- Supports latest application lookup for one user and a known set of jobs.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_user_job_post_updated_at_desc
    ON job_applications (user_id, job_post_id, updated_at DESC, applied_at DESC NULLS LAST);

-- idx_job_applications_user_active_updated_at_desc:
-- Supports applied/recent application lists that exclude saved-only rows.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_user_active_updated_at_desc
    ON job_applications (user_id, updated_at DESC, applied_at DESC NULLS LAST)
    WHERE status <> 'saved';

-- idx_job_applications_job_post_id:
-- Supports job-post reverse lookups, joins, and FK delete paths.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_job_post_id
    ON job_applications (job_post_id);

-- idx_interview_sessions_user_created_at_desc:
-- Supports listing a user's interview sessions and archives newest-first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_user_created_at_desc
    ON interview_sessions (user_id, created_at DESC);

-- idx_interview_answers_session_question:
-- Supports answer lookups by session/question and answer joins from a session.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_answers_session_question
    ON interview_answers (session_id, question_id);

-- idx_assessment_sessions_user_started_at_desc:
-- Supports listing recent assessment sessions for a user.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_user_started_at_desc
    ON assessment_sessions (user_id, started_at DESC);

-- idx_assessment_sessions_skill_id:
-- Supports skill assessment target lookups and FK-style access.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_skill_id
    ON assessment_sessions (skill_id);

-- idx_assessment_sessions_roadmap_id:
-- Supports roadmap-level assessment target lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_roadmap_id
    ON assessment_sessions (roadmap_id);

-- idx_assessment_sessions_section_id:
-- Supports section-level assessment target lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_section_id
    ON assessment_sessions (section_id);

-- idx_assessment_sessions_step_id:
-- Supports step-level assessment target lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_step_id
    ON assessment_sessions (step_id);

-- idx_assessment_questions_session_id:
-- Supports loading generated questions for an assessment session.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_questions_session_id
    ON assessment_questions (session_id);

-- idx_assessment_answers_session_question:
-- Supports loading answers by session and joining answers to questions.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_answers_session_question
    ON assessment_answers (session_id, question_id);

-- idx_assessment_answers_question_id:
-- Supports question reverse lookups and FK delete paths.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_answers_question_id
    ON assessment_answers (question_id);

-- idx_career_sessions_user_started_at_desc:
-- Supports listing career quiz sessions for a user.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_sessions_user_started_at_desc
    ON career_sessions (user_id, started_at DESC);

-- idx_career_selected_cards_session_id:
-- Supports replacing and reading selected cards for a career session.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_selected_cards_session_id
    ON career_selected_cards (session_id);

-- idx_career_answers_session_question:
-- Supports replacing and reading career answers by session/question.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_answers_session_question
    ON career_answers (session_id, question_id);

-- idx_career_answers_question_id:
-- Supports question reverse lookups and FK delete paths.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_answers_question_id
    ON career_answers (question_id);

-- idx_career_track_results_session_track:
-- Supports reading and replacing career track results for a session.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_track_results_session_track
    ON career_track_results (session_id, track_id);

-- idx_career_track_results_track_id:
-- Supports track reverse lookups and FK delete paths.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_career_track_results_track_id
    ON career_track_results (track_id);

-- idx_roadmap_assessment_results_user_roadmap_type_status:
-- Supports roadmap progress summary reads by user/roadmap/type/status.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roadmap_assessment_results_user_roadmap_type_status
    ON roadmap_assessment_results (user_id, roadmap_id, type, completion_status);

-- idx_roadmap_assessment_results_user_step_status:
-- Supports step progress recomputation and completed-step counts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roadmap_assessment_results_user_step_status
    ON roadmap_assessment_results (user_id, step_id, completion_status)
    WHERE type = 'step';

-- idx_roadmap_assessment_results_user_section_type:
-- Supports section progress recomputation and lock validation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roadmap_assessment_results_user_section_type
    ON roadmap_assessment_results (user_id, section_id, type);

-- Postponed until Phase 3:
-- courses.tags is a PostgreSQL ARRAY(Text) column, so a GIN index is compatible
-- with PostgreSQL/Supabase. It is not active in this Phase 1 proposal because
-- current course tag filtering still scans Python-side arrays after loading rows.
-- Add it when Phase 3 moves tag filtering into SQL.
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_tags_gin
--     ON courses USING GIN (tags)
--     WHERE tags IS NOT NULL;

-- Rollback notes:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_reports_user_type_created_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_job_applications_user_job_post_updated_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_job_applications_user_active_updated_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_job_applications_job_post_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_interview_sessions_user_created_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_interview_answers_session_question;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_sessions_user_started_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_sessions_skill_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_sessions_roadmap_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_sessions_section_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_sessions_step_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_questions_session_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_answers_session_question;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_answers_question_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_sessions_user_started_at_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_selected_cards_session_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_answers_session_question;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_answers_question_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_track_results_session_track;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_career_track_results_track_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_roadmap_assessment_results_user_roadmap_type_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_roadmap_assessment_results_user_step_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_roadmap_assessment_results_user_section_type;
-- Postponed index rollback, only needed if the Phase 3 GIN index is later applied:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_courses_tags_gin;
