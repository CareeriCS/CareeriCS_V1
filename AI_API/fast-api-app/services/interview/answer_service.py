from uuid import UUID
import json
import logging
import subprocess
import sys
from typing import Any

from sqlalchemy.orm import Session as DBSession
from fastapi import BackgroundTasks, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

import db.models as models
from core.config import settings
from ai.completion import transcribe
from db.session import SessionLocal

from utils.util import (
    save_uploaded_file,
    _generate_tts,
    convert_audio_and_video,
    delete_files,
    evaluate_answer_service,
    ser,
    fer,
    emotion_evaluation,
    sentiment_analysis
)


logger = logging.getLogger(__name__)
MEDIA_ANALYSIS_TIMEOUT_SECONDS = 120


# ============================================================
# FETCH ANSWER
# ============================================================
def get_answer_by_question_and_session(
    db: DBSession,
    question_id: UUID,
    session_id: UUID
) -> models.Answer | None:

    return db.query(models.Answer).filter(
        models.Answer.question_id == question_id,
        models.Answer.session_id == session_id,
        models.Answer.isfollowup.is_(False),
    ).first()


# ============================================================
# SUBMIT ANSWER
# ============================================================

async def submit_answer_service(
    db: DBSession,
    session_id: UUID,
    question_id: UUID,
    audio: UploadFile,
    is_followup: bool = False,
):

    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question = db.get(models.Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    existing_answer = None
    if not is_followup:
        existing_answer = (
            db.query(models.Answer)
            .filter_by(session_id=session_id, question_id=question_id, isfollowup=False)
            .first()
        )

    uploaded_path = None
    wav_path = None
    mp4_path = None

    try:
        uploaded_path = await save_uploaded_file(audio)
        mp4_path, wav_path = await run_in_threadpool(convert_audio_and_video, uploaded_path)
        delete_files(uploaded_path)
        uploaded_path = None
        transcript = await run_in_threadpool(transcribe, wav_path)
    except HTTPException:
        delete_files(uploaded_path, wav_path, mp4_path)
        raise
    except Exception as e:
        delete_files(uploaded_path, wav_path, mp4_path)
        raise HTTPException(status_code=500, detail=f"Answer processing failed: {str(e)}")

    if existing_answer:
        # Keep the same answer row so any created follow-up remains linked.
        delete_files(existing_answer.answer_video, existing_answer.answer_audio)

        existing_answer.answer_text = transcript
        existing_answer.answer_audio = wav_path
        existing_answer.answer_video = mp4_path
        existing_answer.feedback = None
        existing_answer.grade = None
        existing_answer.emotion_evaluation = None
        existing_answer.tone_evaluation = None
        existing_answer.sentiment_evaluation = None

        db.commit()
        db.refresh(existing_answer)

        return {
            "answer_id": existing_answer.id,
            "answer_text": existing_answer.answer_text,
            "answer_audio": existing_answer.answer_audio,
        }

    answer = models.Answer(
        session_id=session_id,
        question_id=question_id,
        answer_text=transcript,
        answer_audio=wav_path,
        answer_video=mp4_path,
        isfollowup=is_followup,
    )

    db.add(answer)
    db.commit()
    db.refresh(answer)

    return {
        "answer_id": answer.id,
        "answer_text": answer.answer_text,
        "answer_audio": answer.answer_audio,
    }


# ============================================================
# EVALUATION
# ============================================================

def evaluate_answer_service_wrapper(
    db: DBSession,
    session_id: UUID,
    question_id: UUID,
    is_followup: bool = False,
    answer_id: UUID | None = None,
    background_tasks: BackgroundTasks | None = None,
):
    answer = _resolve_answer_for_evaluation(
        db,
        session_id,
        question_id,
        is_followup,
        answer_id,
    )

    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    question = db.get(models.Question, question_id)

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    session = db.get(models.Session, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    main_answer = _get_main_answer(db, session_id, question_id)
    existing_followup = _get_followup_for_main_answer(db, main_answer)

    is_followup_allowed = (not is_followup) and (existing_followup is None)
    question_text = (
        existing_followup.fquestion_text
        if is_followup and existing_followup
        else question.question_text
    )

    evaluation = evaluate_answer_service(
        question_text=question_text,
        user_answer=answer.answer_text,
        interview_type=session.type,
        is_followup=is_followup_allowed,
    )

    score = evaluation["score"]
    feedback = evaluation["feedback"]
    improvement = evaluation["improvement"]
    followup_required = evaluation["followup_required"]

    # Store text feedback immediately so the endpoint can return even if media
    # analysis is slow or native ML libraries crash in a child process.
    _store_evaluation(db, answer, feedback, score)

    _queue_or_run_media_analysis(db, answer, background_tasks)

    if is_followup:
        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": False,
            "followup": None,
            "emotion_evaluation": answer.emotion_evaluation,
            "tone_evaluation": answer.tone_evaluation,
        }

    if existing_followup:
        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": True,
            "followup": _serialize_followup(existing_followup),
            "emotion_evaluation": answer.emotion_evaluation,
            "tone_evaluation": answer.tone_evaluation,
        }

    if is_followup_allowed and followup_required:
        followup_info = _handle_followup(db, answer.id, improvement)

        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": True,
            "followup": followup_info,
            "emotion_evaluation": answer.emotion_evaluation,
            "tone_evaluation": answer.tone_evaluation,
        }

    return {
        "evaluation": feedback,
        "grade": score,
        "followup_recommended": False,
        "followup": None,
        "emotion_evaluation": answer.emotion_evaluation,
        "tone_evaluation": answer.tone_evaluation,
    }

# ======================================================
# STORE BASIC EVALUATION
# ======================================================

def _store_evaluation(
    db: DBSession,
    answer,
    feedback: str,
    score: float
):

    answer.feedback = feedback
    answer.grade = score

    db.commit()


def _get_main_answer(
    db: DBSession,
    session_id: UUID,
    question_id: UUID,
) -> models.Answer | None:
    return (
        db.query(models.Answer)
        .filter_by(session_id=session_id, question_id=question_id, isfollowup=False)
        .first()
    )


def _get_answer_for_evaluation(
    db: DBSession,
    session_id: UUID,
    question_id: UUID,
    is_followup: bool,
) -> models.Answer | None:
    return (
        db.query(models.Answer)
        .filter_by(
            session_id=session_id,
            question_id=question_id,
            isfollowup=is_followup,
        )
        .first()
    )


def _resolve_answer_for_evaluation(
    db: DBSession,
    session_id: UUID,
    question_id: UUID,
    is_followup: bool,
    answer_id: UUID | None,
) -> models.Answer | None:
    if answer_id is None:
        return _get_answer_for_evaluation(db, session_id, question_id, is_followup)

    answer = db.get(models.Answer, answer_id)
    if not answer:
        return None

    if (
        answer.session_id != session_id
        or answer.question_id != question_id
        or answer.isfollowup != is_followup
    ):
        raise HTTPException(
            status_code=400,
            detail="Provided answer_id does not match the requested interview answer context.",
        )

    return answer


def _get_followup_for_main_answer(
    db: DBSession,
    main_answer: models.Answer | None,
) -> models.Followup | None:
    if not main_answer:
        return None

    return (
        db.query(models.Followup)
        .filter(models.Followup.answer_id == main_answer.id)
        .first()
    )


# ======================================================
# FOLLOW-UP HANDLING
# ======================================================

def _handle_followup(
    db: DBSession,
    answer_id: UUID,
    followup_text: str
):

    audio_filename = None
    try:
        audio_filename = _generate_tts(
            followup_text,
            settings.AUDIO_PATHS["followups"]
        )
    except Exception as exc:
        # Keep the follow-up text flow working even when TTS fails.
        logger.warning("Failed to generate follow-up audio: %s", exc)

    followup = models.Followup(
        fquestion_text=followup_text,
        fquestion_audio=audio_filename,
        answer_id=answer_id,
    )

    db.add(followup)

    db.commit()
    db.refresh(followup)

    return _serialize_followup(followup)


def _serialize_followup(followup: models.Followup):

    audio_path = ""
    if followup.fquestion_audio:
        audio_path = f"/{settings.AUDIO_URL_PATHS['followups']}/{followup.fquestion_audio}"

    return {
        "id": followup.id,
        "text": followup.fquestion_text,
        "audio": audio_path,
    }


# ======================================================
# FINAL MEDIA ANALYSIS
# ======================================================

def _queue_or_run_media_analysis(
    db: DBSession,
    answer,
    background_tasks: BackgroundTasks | None,
):
    if background_tasks is not None:
        background_tasks.add_task(_run_final_media_analysis_by_answer_id, str(answer.id))
        return

    # Fallback for tests or internal calls outside FastAPI BackgroundTasks.
    _run_final_media_analysis(db, answer)


def _run_final_media_analysis_by_answer_id(answer_id: str):
    db = SessionLocal()
    try:
        answer = db.get(models.Answer, UUID(answer_id))
        if not answer:
            logger.warning("Skipping media analysis because answer %s was not found", answer_id)
            return

        _run_final_media_analysis(db, answer)
    except Exception:
        db.rollback()
        logger.exception("Final media analysis failed for answer %s", answer_id)
    finally:
        db.close()


def _run_final_media_analysis(
    db: DBSession,
    answer
):
    emotion_result = {}
    tone_result = None
    sentiment_result = None

    if answer.answer_video:
        emotion_result = _run_isolated_media_analysis(
            "fer",
            {"path": answer.answer_video},
            default={},
        )

    if answer.answer_audio:
        tone_result = _run_isolated_media_analysis(
            "ser",
            {"path": answer.answer_audio},
            default=None,
        )

    if answer.answer_text:
        sentiment_result = _run_isolated_media_analysis(
            "sentiment",
            {"text": answer.answer_text},
            default=None,
        )

    answer.emotion_evaluation = emotion_result
    answer.sentiment_evaluation = sentiment_result
    answer.tone_evaluation = tone_result

    db.commit()


def _run_isolated_media_analysis(
    analysis_type: str,
    payload: dict[str, Any],
    default: Any,
):
    """Run optional ML media analysis in a child process.

    DeepFace/TensorFlow can segfault on small CPU Railway containers. Running each
    analyzer in its own process keeps the Uvicorn worker alive; a failed analyzer
    returns its default value and the text evaluation still succeeds.
    """

    command = r'''
import json
import sys

from utils.util import fer, ser, emotion_evaluation, sentiment_analysis

request = json.loads(sys.stdin.read())
analysis_type = request["analysis_type"]
payload = request["payload"]

if analysis_type == "fer":
    result = emotion_evaluation(fer(payload["path"]))
elif analysis_type == "ser":
    result = ser(payload["path"])
elif analysis_type == "sentiment":
    result = sentiment_analysis(payload["text"])
else:
    raise ValueError(f"Unsupported analysis type: {analysis_type}")

print(json.dumps({"result": result}))
'''

    try:
        completed = subprocess.run(
            [sys.executable, "-c", command],
            input=json.dumps({"analysis_type": analysis_type, "payload": payload}),
            text=True,
            capture_output=True,
            timeout=MEDIA_ANALYSIS_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning("%s media analysis timed out", analysis_type)
        return default
    except Exception:
        logger.exception("%s media analysis subprocess failed to start", analysis_type)
        return default

    if completed.returncode != 0:
        logger.warning(
            "%s media analysis exited with code %s. stderr=%s",
            analysis_type,
            completed.returncode,
            completed.stderr[-1000:],
        )
        return default

    try:
        return json.loads(completed.stdout)["result"]
    except Exception:
        logger.exception(
            "Could not parse %s media analysis output. stdout=%s stderr=%s",
            analysis_type,
            completed.stdout[-1000:],
            completed.stderr[-1000:],
        )
        return default
