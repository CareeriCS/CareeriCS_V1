import re
from pathlib import Path

from db.models import Base


SQL_PATH = Path(__file__).resolve().parents[1] / "db" / "proposed_phase1_indexes.sql"
CREATE_INDEX_RE = re.compile(
    r"^CREATE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)",
    re.IGNORECASE,
    re.MULTILINE,
)

EXPECTED_INDEX_NAMES = {
    "idx_reports_user_type_created_at_desc",
    "idx_job_applications_user_job_post_updated_at_desc",
    "idx_job_applications_user_active_updated_at_desc",
    "idx_job_applications_job_post_id",
    "idx_interview_sessions_user_created_at_desc",
    "idx_interview_answers_session_question",
    "idx_assessment_sessions_user_started_at_desc",
    "idx_assessment_sessions_skill_id",
    "idx_assessment_sessions_roadmap_id",
    "idx_assessment_sessions_section_id",
    "idx_assessment_sessions_step_id",
    "idx_assessment_questions_session_id",
    "idx_assessment_answers_session_question",
    "idx_assessment_answers_question_id",
    "idx_career_sessions_user_started_at_desc",
    "idx_career_selected_cards_session_id",
    "idx_career_answers_session_question",
    "idx_career_answers_question_id",
    "idx_career_track_results_session_track",
    "idx_career_track_results_track_id",
    "idx_roadmap_assessment_results_user_roadmap_type_status",
    "idx_roadmap_assessment_results_user_step_status",
    "idx_roadmap_assessment_results_user_section_type",
}


def _sql_text() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


def _proposed_index_names() -> list[str]:
    return CREATE_INDEX_RE.findall(_sql_text())


def test_phase1_proposed_index_names_are_expected_and_unique():
    proposed_names = _proposed_index_names()

    assert set(proposed_names) == EXPECTED_INDEX_NAMES
    assert len(proposed_names) == len(set(proposed_names))


def test_phase1_proposed_indexes_do_not_duplicate_model_index_names():
    existing_model_indexes = {
        index.name
        for table in Base.metadata.tables.values()
        for index in table.indexes
        if index.name
    }

    assert EXPECTED_INDEX_NAMES.isdisjoint(existing_model_indexes)


def test_phase1_proposed_indexes_are_documented_and_reversible():
    sql = _sql_text()

    for index_name in EXPECTED_INDEX_NAMES:
        assert f"-- {index_name}:" in sql
        assert f"DROP INDEX CONCURRENTLY IF EXISTS {index_name};" in sql

    assert "CREATE INDEX CONCURRENTLY" in sql
    assert "Run these statements outside an explicit transaction block." in sql


def test_phase1_course_tags_gin_index_is_documented_as_postponed():
    sql = _sql_text()

    assert "Postponed until Phase 3" in sql
    assert "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_tags_gin" in sql
    assert not re.search(
        r"(?m)^CREATE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+idx_courses_tags_gin",
        sql,
    )
