from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from typing import List
from fastapi import HTTPException
import db.models as models
import schemas
from utils.util import _generate_tts
from core.config import settings
from uuid import UUID
import logging


logger = logging.getLogger(__name__)


def _normalize_question_audio_path(audio_value: str | None) -> str | None:
    if not audio_value:
        return audio_value

    if audio_value.startswith("/audio/"):
        return audio_value

    if audio_value.startswith("audio/"):
        return f"/{audio_value}"

    return f"/{settings.AUDIO_URL_PATHS['questions']}/{audio_value}"


def _apply_question_audio_path(question: models.Question) -> models.Question:
    question.question_audio = _normalize_question_audio_path(question.question_audio)
    return question


def _generate_question_audio(question_text: str) -> str | None:
    try:
        return _generate_tts(question_text, settings.AUDIO_PATHS["questions"])
    except Exception as exc:
        # Audio is optional at runtime because the UI has text fallback.
        logger.warning("Failed to generate question audio: %s", exc)
        return None


# -----------------------------
# Create Single Question
# -----------------------------
def create_question_service(
    db: DBSession,
    payload: schemas.QuestionCreate
) -> models.Question:

    audio_filename = (
        payload.question_audio
        or _generate_question_audio(payload.question_text)
    )

    question = models.Question(
        type=payload.type,
        question_text=payload.question_text,
        question_audio=audio_filename,
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return _apply_question_audio_path(question)


# -----------------------------
# Get All Questions
# -----------------------------
def get_questions_service(db: DBSession) -> List[models.Question]:
    questions = db.query(models.Question).all()
    return [_apply_question_audio_path(q) for q in questions]


# -----------------------------
# List Distinct Question Types
# -----------------------------
def list_question_types_service(db: DBSession) -> List[str]:
    # PostgreSQL requires ORDER BY expressions to appear in the SELECT list when
    # using DISTINCT. Select distinct values in a subquery first, then order
    # case-insensitively in the outer query to remain Postgres-safe.
    subq = (
        db.query(models.Question.type.label("type"))
        .distinct()
        .subquery()
    )

    rows = db.query(subq.c.type).order_by(func.lower(subq.c.type).asc()).all()

    return [row[0] for row in rows if row[0]]


# -----------------------------
# Get Questions By Type
# -----------------------------
def get_questions_by_type_service(
    db: DBSession,
    question_type: str
) -> List[models.Question]:

    questions = (
        db.query(models.Question)
        .filter(func.lower(models.Question.type) == question_type.lower())
        .all()
    )

    if not questions:
        raise HTTPException(
            status_code=404,
            detail="No questions found for this type"
        )

    return [_apply_question_audio_path(q) for q in questions]


# -----------------------------
# Get Question By ID
# -----------------------------
def get_question_service(
    db: DBSession,
    question_id: UUID
) -> models.Question:
    question = db.get(models.Question, question_id)

    if not question:
        raise HTTPException(
            status_code=404, 
            detail="Question not found"
        )

    return _apply_question_audio_path(question)


# -----------------------------
# Mass Create Questions
# -----------------------------
def create_mass_questions_service(
    db: DBSession,
    payload: List[schemas.QuestionCreate]
) -> List[models.Question]:

    created_questions = []

    for q in payload:
        audio_filename = (
            q.question_audio
            or _generate_question_audio(q.question_text)
        )

        question = models.Question(
            type=q.type,
            question_text=q.question_text,
            question_audio=audio_filename
        )

        db.add(question)
        created_questions.append(question)

    db.commit()

    for q in created_questions:
        db.refresh(q)

    return [_apply_question_audio_path(q) for q in created_questions]
