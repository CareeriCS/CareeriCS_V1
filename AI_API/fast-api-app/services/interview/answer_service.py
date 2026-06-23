from uuid import UUID
import json
import logging
import os
import subprocess
import sys
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock
from typing import Any

from sqlalchemy.exc import IntegrityError
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
)


logger = logging.getLogger(__name__)
MEDIA_ANALYSIS_TIMEOUT_SECONDS = int(os.getenv("MEDIA_ANALYSIS_TIMEOUT_SECONDS", "300"))
MEDIA_ANALYSIS_EXECUTOR = ThreadPoolExecutor(
    max_workers=int(os.getenv("MEDIA_ANALYSIS_WORKERS", "1")),
    thread_name_prefix="careerics-media-analysis",
)
TTS_EXECUTOR = ThreadPoolExecutor(
    max_workers=int(os.getenv("FOLLOWUP_TTS_WORKERS", "1")),
    thread_name_prefix="careerics-followup-tts",
)
_media_analysis_lock = Lock()
_tts_lock = Lock()
_media_analysis_queued_answer_ids: set[str] = set()
_tts_queued_followup_ids: set[str] = set()


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

    try:
        evaluation = evaluate_answer_service(
            question_text=question_text,
            user_answer=answer.answer_text or "",
            interview_type=session.type,
            is_followup=is_followup_allowed,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Answer evaluation failed for answer %s", answer.id)
        raise HTTPException(
            status_code=502,
            detail="Answer evaluation failed. Please try again.",
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
        return _build_evaluation_response(answer, feedback, score, False, None)

    if existing_followup:
        return _build_evaluation_response(
            answer,
            feedback,
            score,
            True,
            _serialize_followup(existing_followup),
        )

    if is_followup_allowed and followup_required:
        followup_info = _handle_followup(db, answer.id, improvement)
        return _build_evaluation_response(answer, feedback, score, True, followup_info)

    return _build_evaluation_response(answer, feedback, score, False, None)


# ======================================================
# RESPONSE HELPERS
# ======================================================

def _build_evaluation_response(
    answer,
    feedback: str,
    score: float,
    followup_recommended: bool,
    followup,
):
    return {
        "evaluation": feedback,
        "grade": score,
        "followup_recommended": followup_recommended,
        "followup": followup,
        "emotion_evaluation": answer.emotion_evaluation,
        "tone_evaluation": answer.tone_evaluation,
        "sentiment_evaluation": answer.sentiment_evaluation,
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

    return _get_followup_by_answer_id(db, main_answer.id)


def _get_followup_by_answer_id(
    db: DBSession,
    answer_id: UUID,
) -> models.Followup | None:
    return (
        db.query(models.Followup)
        .filter(models.Followup.answer_id == answer_id)
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
    existing_followup = _get_followup_by_answer_id(db, answer_id)
    if existing_followup:
        if not existing_followup.fquestion_audio:
            _queue_followup_tts(str(existing_followup.id))
        return _serialize_followup(existing_followup)

    followup = models.Followup(
        fquestion_text=followup_text,
        fquestion_audio=None,
        answer_id=answer_id,
    )

    db.add(followup)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_followup = _get_followup_by_answer_id(db, answer_id)
        if existing_followup:
            logger.warning(
                "Follow-up already exists for answer %s; returning existing row after duplicate insert race.",
                answer_id,
            )
            if not existing_followup.fquestion_audio:
                _queue_followup_tts(str(existing_followup.id))
            return _serialize_followup(existing_followup)

        logger.exception(
            "Follow-up insert failed for answer %s and no existing row was found after rollback.",
            answer_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Could not create follow-up question at this time.",
        )

    db.refresh(followup)

    _queue_followup_tts(str(followup.id))

    return _serialize_followup(followup)


def _queue_followup_tts(followup_id: str):
    with _tts_lock:
        if followup_id in _tts_queued_followup_ids:
            return
        _tts_queued_followup_ids.add(followup_id)

    try:
        future = TTS_EXECUTOR.submit(_generate_followup_audio_by_id, followup_id)
        future.add_done_callback(lambda completed: _finalize_tts_task(followup_id, completed))
    except Exception:
        with _tts_lock:
            _tts_queued_followup_ids.discard(followup_id)
        logger.exception("Could not queue follow-up TTS for %s", followup_id)


def _finalize_tts_task(followup_id: str, completed: Future):
    with _tts_lock:
        _tts_queued_followup_ids.discard(followup_id)

    try:
        completed.result()
    except Exception:
        logger.exception("Queued follow-up TTS task failed for %s", followup_id)


def _generate_followup_audio_by_id(followup_id: str):
    db = SessionLocal()
    try:
        followup = db.get(models.Followup, UUID(followup_id))
        if not followup or followup.fquestion_audio:
            return

        audio_filename = _generate_tts(
            followup.fquestion_text,
            settings.AUDIO_PATHS["followups"]
        )
        followup.fquestion_audio = audio_filename
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to generate follow-up audio for %s", followup_id)
    finally:
        db.close()


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
    """Queue media analysis without tying it to FastAPI BackgroundTasks."""

    del db, background_tasks  # Analysis reloads its own DB session by answer id.

    answer_id = str(answer.id)
    with _media_analysis_lock:
        if answer_id in _media_analysis_queued_answer_ids:
            logger.info("Media analysis already queued for answer %s", answer_id)
            return
        _media_analysis_queued_answer_ids.add(answer_id)

    try:
        future = MEDIA_ANALYSIS_EXECUTOR.submit(_run_final_media_analysis_by_answer_id, answer_id)
        future.add_done_callback(lambda completed: _finalize_media_analysis_task(answer_id, completed))
    except Exception:
        with _media_analysis_lock:
            _media_analysis_queued_answer_ids.discard(answer_id)
        logger.exception("Could not queue media analysis for answer %s", answer_id)


def _finalize_media_analysis_task(answer_id: str, completed: Future):
    with _media_analysis_lock:
        _media_analysis_queued_answer_ids.discard(answer_id)

    try:
        completed.result()
    except Exception:
        logger.exception("Queued media analysis task failed for answer %s", answer_id)


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


def _analysis_timeout_result(analysis_type: str) -> dict[str, Any]:
    return {
        "status": "timeout",
        "analysis_type": analysis_type,
        "timeout_seconds": MEDIA_ANALYSIS_TIMEOUT_SECONDS,
    }


def _analysis_failed_result(analysis_type: str, reason: str) -> dict[str, Any]:
    return {
        "status": "failed",
        "analysis_type": analysis_type,
        "reason": reason,
    }


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


def _payload_summary(analysis_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if analysis_type in {"fer", "ser"}:
        path = str(payload.get("path", ""))
        return {
            "kind": "media",
            "has_path": bool(path),
            "extension": os.path.splitext(path)[1].lower(),
        }

    if analysis_type == "sentiment":
        text = str(payload.get("text", ""))
        return {
            "kind": "text",
            "text_length": len(text),
            "word_count": len(text.split()),
        }

    return {"kind": "unknown"}


def _run_isolated_media_analysis(
    analysis_type: str,
    payload: dict[str, Any],
    default: Any,
):
    env = {
        **os.environ,
        "TRANSFORMERS_NO_TF": "1",
        "USE_TF": "0",
        "USE_FLAX": "0",
        "TF_CPP_MIN_LOG_LEVEL": "3",
        "OMP_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "NUMEXPR_NUM_THREADS": "1",
    }

    try:
        completed = subprocess.run(
            [sys.executable, "-m", "services.interview.media_analysis_runner"],
            input=json.dumps({"analysis_type": analysis_type, "payload": payload}),
            text=True,
            capture_output=True,
            timeout=MEDIA_ANALYSIS_TIMEOUT_SECONDS,
            check=False,
            env=env,
        )
    except subprocess.TimeoutExpired:
        logger.warning(
            "%s media analysis timed out after %s seconds. payload=%s",
            analysis_type,
            MEDIA_ANALYSIS_TIMEOUT_SECONDS,
            _payload_summary(analysis_type, payload),
        )
        return _analysis_timeout_result(analysis_type) if default is None else default
    except Exception:
        logger.exception("%s media analysis subprocess failed to start", analysis_type)
        return _analysis_failed_result(analysis_type, "subprocess_start_failed") if default is None else default

    if completed.returncode != 0:
        logger.warning(
            "%s media analysis exited with code %s. stderr=%s",
            analysis_type,
            completed.returncode,
            completed.stderr[-1000:],
        )
        return _analysis_failed_result(analysis_type, "subprocess_failed") if default is None else default

    try:
        return json.loads(completed.stdout)["result"]
    except Exception:
        logger.exception(
            "Could not parse %s media analysis output. stdout=%s stderr=%s",
            analysis_type,
            completed.stdout[-1000:],
            completed.stderr[-1000:],
        )
        return _analysis_failed_result(analysis_type, "invalid_output") if default is None else default
