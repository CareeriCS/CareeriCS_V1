from uuid import UUID
from fastapi import APIRouter, Depends, Form, File, UploadFile
from sqlalchemy.orm import Session
from dependencies import get_db
from schemas import AnswerRead 
from services.interview.answer_service import (
    submit_answer_service,
    evaluate_answer_service_wrapper,
    get_answer_by_question_and_session,
)

router = APIRouter(
    prefix="/answers",
    tags=["Answers"]
)


# ============================================================
# SUBMIT ANSWER
# ============================================================
@router.post("/")
async def submit_answer(
    session_id: UUID = Form(...),
    question_id: UUID = Form(...),
    is_followup: bool = Form(False),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await submit_answer_service(
        db,
        session_id,
        question_id,
        audio,
        is_followup,
    )


# ============================================================
# EVALUATE ANSWER
# ============================================================
@router.post("/evaluate/")
def evaluate_answer(
    session_id: UUID = Form(...),
    question_id: UUID = Form(...),
    is_followup: bool = Form(False),
    answer_id: UUID | None = Form(None),
    db: Session = Depends(get_db),
):
    return evaluate_answer_service_wrapper(
        db, session_id, question_id, is_followup, answer_id,
    )


@router.get("/by_question_session/", response_model=AnswerRead | None)
def fetch_answer_by_question_session(
    question_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db)
):
    answer = get_answer_by_question_and_session(db, question_id, session_id)
    if not answer:
        return None
    return AnswerRead.model_validate(answer)
