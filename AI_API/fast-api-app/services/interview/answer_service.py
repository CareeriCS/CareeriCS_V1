from sqlalchemy.orm import Session as DBSession
from fastapi import BackgroundTasks, HTTPException, UploadFile
import db.models as models
from core.config import settings
from ai.completion import transcribe
from uuid import UUID
import logging

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

        mp4_path, wav_path = convert_audio_and_video(uploaded_path)

        delete_files(uploaded_path)
        uploaded_path = None

        transcript = transcribe(wav_path)
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

async def evaluate_answer_service_wrapper(
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

    # store feedback and score immediately
    _store_evaluation(db, answer, feedback, score)

    # Schedule heavy ML analysis as a background task so it does not block
    # the HTTP response. Results are persisted to the DB asynchronously.
    def _safe_media_analysis():
        try:
            _run_final_media_analysis(db, answer)
        except Exception as exc:
            logger.error(
                "Background media analysis failed for answer %s: %s",
                answer.id,
                exc,
            )

    if background_tasks is not None:
        background_tasks.add_task(_safe_media_analysis)
    else:
        # Fallback: run synchronously when no BackgroundTasks context is available
        _safe_media_analysis()

    if is_followup:
        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": False,
            "followup": None,
            "emotion_evaluation": None,
            "tone_evaluation": None,
            "sentiment_evaluation": None,
        }

    if existing_followup:
        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": True,
            "followup": _serialize_followup(existing_followup),
            "emotion_evaluation": None,
            "tone_evaluation": None,
            "sentiment_evaluation": None,
        }

    if is_followup_allowed and followup_required:
        followup_info = _handle_followup(db, answer.id, improvement)

        return {
            "evaluation": feedback,
            "grade": score,
            "followup_recommended": True,
            "followup": followup_info,
            "emotion_evaluation": None,
            "tone_evaluation": None,
            "sentiment_evaluation": None,
        }

    return {
        "evaluation": feedback,
        "grade": score,
        "followup_recommended": False,
        "followup": None,
        "emotion_evaluation": None,
        "tone_evaluation": None,
        "sentiment_evaluation": None,
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
        audio_path = f"/{settings.AUDIO_PATHS['followups']}/{followup.fquestion_audio}"

    return {
        "id": followup.id,
        "text": followup.fquestion_text,
        "audio": audio_path,
    }


# ======================================================
# FINAL MEDIA ANALYSIS
# ======================================================

def _run_final_media_analysis(
    db: DBSession,
    answer
):

    emotions = []
    tone_result = None

    if answer.answer_video:
        emotions = fer(answer.answer_video)

    if answer.answer_audio:
        tone_result = ser(answer.answer_audio)

    sentiments = sentiment_analysis(answer.answer_text)


    answer.emotion_evaluation = emotion_evaluation(emotions)
    answer.sentiment_evaluation = sentiments
    answer.tone_evaluation = tone_result

    db.commit()
