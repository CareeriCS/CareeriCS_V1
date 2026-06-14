from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import List

from db.models import AssessmentSession, Roadmap, RoadmapSection, RoadmapStep, Skill
from schemas import AssessmentSessionSummary, StartAssessmentResponse
from services.skill_assessment.questions import generate_and_save_questions, get_questions_response

ALLOWED_SESSION_STATUSES = {"in_progress", "submitted", "completed", "cancelled"}


def _normalize_session_type(session_type: str) -> str:
    normalized = (session_type or "").strip().lower()
    if normalized == "skill":
        return "skills"
    if normalized in ("skills", "roadmap", "section", "step"):
        return normalized
    raise ValueError("Invalid session type. Must be one of: skills, roadmap, section, step")


def _fallback_skill_id(db: Session) -> str | None:
    skill = db.query(Skill).order_by(Skill.skill_name.asc()).first()
    return str(skill.id) if skill else None


def _build_target_fields(db: Session, target_id: str, session_type: str) -> dict:
    if session_type == "skills":
        skill = db.query(Skill).filter(Skill.id == target_id).first()
        if not skill:
            raise ValueError("Skill not found for assessment")
        return {
            "skill_id": str(skill.id),
            "roadmap_id": None,
            "section_id": None,
            "step_id": None,
        }

    if session_type == "roadmap":
        roadmap = db.query(Roadmap).filter(Roadmap.id == target_id).first()
        if not roadmap:
            raise ValueError("Roadmap not found for assessment")
        return {
            "skill_id": None,
            "roadmap_id": str(roadmap.id),
            "section_id": None,
            "step_id": None,
        }

    if session_type == "section":
        section = db.query(RoadmapSection).filter(RoadmapSection.id == target_id).first()
        if not section:
            raise ValueError("Roadmap section not found for assessment")
        return {
            "skill_id": None,
            "roadmap_id": str(section.roadmap_id),
            "section_id": str(section.id),
            "step_id": None,
        }

    step = db.query(RoadmapStep).filter(RoadmapStep.id == target_id).first()
    if not step:
        raise ValueError("Roadmap step not found for assessment")

    section = db.query(RoadmapSection).filter(RoadmapSection.id == step.section_id).first()
    if not section:
        raise ValueError("Roadmap section not found for selected step")

    return {
        "skill_id": None,
        "roadmap_id": str(section.roadmap_id),
        "section_id": str(section.id),
        "step_id": str(step.id),
    }


def start_session(
    db: Session,
    user_id: str,
    target_id: str,  # could be skill_id, roadmap_id, section_id, or step_id
    num_questions: int,
    session_type: str
) -> StartAssessmentResponse:
    normalized_type = _normalize_session_type(session_type)
    target_id_str = str(target_id)

    session_id = uuid4()

    # Assign appropriate foreign keys
    session_data = {
        "id": session_id,
        "user_id": user_id,
        "total_questions": num_questions,
        "status": "in_progress",
        "type": normalized_type,
    }
    session_data.update(_build_target_fields(db, target_id_str, normalized_type))

    # Legacy DB compatibility: some deployed schemas still require non-null skill_id.
    if normalized_type != "skills" and not session_data.get("skill_id"):
        session_data["skill_id"] = _fallback_skill_id(db)

    try:
        session = AssessmentSession(**session_data)
        db.add(session)
        db.flush()

        # Generate questions and keep creation atomic with session creation.
        generate_and_save_questions(db, session_id, target_id_str, num_questions)
        questions_response = get_questions_response(db, session_id)
        if len(questions_response) != num_questions:
            raise ValueError(
                f"Assessment generation failed: expected {num_questions} questions, "
                f"received {len(questions_response)}."
            )

        db.commit()
        return StartAssessmentResponse(session_id=session_id, questions=questions_response)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create assessment session. Ensure assessment_sessions.skill_id allows null "
            "or that at least one skill exists in DB for legacy schema compatibility."
        ) from exc
    except Exception:
        db.rollback()
        raise


def list_user_sessions(db: Session, user_id: str, limit: int = 20) -> List[AssessmentSessionSummary]:
    sessions = (
        db.query(AssessmentSession)
        .filter(AssessmentSession.user_id == user_id)
        .order_by(AssessmentSession.started_at.desc())
        .limit(limit)
        .all()
    )
    return sessions


def update_session_status(db: Session, session_id: str, status: str) -> AssessmentSession:
    normalized_status = (status or "").strip().lower()
    if normalized_status not in ALLOWED_SESSION_STATUSES:
        raise ValueError(
            "Invalid session status. Must be one of: in_progress, submitted, completed, cancelled"
        )

    session = db.query(AssessmentSession).filter_by(id=session_id).first()
    if not session:
        raise ValueError("Assessment session not found")

    current_status = (session.status or "").strip().lower()
    if normalized_status == "cancelled" and current_status in {"submitted", "completed"}:
        return session

    session.status = normalized_status
    db.commit()
    db.refresh(session)
    return session
