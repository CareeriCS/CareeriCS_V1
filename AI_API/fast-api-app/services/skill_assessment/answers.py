from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
from collections import Counter

from db.models import (
    AssessmentAnswer,
    AssessmentQuestion,
    AssessmentSession,
    UserSkill,
    RoadmapAssessmentResult   # <-- NEW IMPORT
)

from schemas import (
    SubmitAssessmentResponse,
    AssessmentQuestionResult
)

from utils.util import (
    calculate_score,
    score_to_proficiency
)


def submit_answers(db: Session, session_id: str, user_id: str, user_answers: list) -> SubmitAssessmentResponse:
    
    session = db.query(AssessmentSession).filter_by(id=session_id, user_id=user_id).first()
    if not session:
        raise ValueError("Assessment session not found")
    if session.status == "submitted":
        raise ValueError("Assessment already submitted")

    # Fetch questions
    questions = db.query(AssessmentQuestion).filter_by(session_id=session_id).all()
    if not questions:
        raise ValueError("Assessment questions were not found for this session")

    questions_map = {str(q.id): q for q in questions}
    expected_question_ids = {str(q.id) for q in questions}

    if len(user_answers) != session.total_questions:
        raise ValueError(
            f"Incomplete submission: expected {session.total_questions} answers, "
            f"received {len(user_answers)}."
        )

    submitted_question_ids = []
    for ans in user_answers:
        question_id = str(ans.get("question_id", "")).strip()
        selected_answer = str(ans.get("selected_answer", "")).strip()

        if not question_id:
            raise ValueError("Invalid submission: each answer must include a question_id.")
        if not selected_answer:
            raise ValueError("Invalid submission: each answer must include a selected_answer.")
        if question_id not in expected_question_ids:
            raise ValueError("Invalid submission: one or more answers do not belong to this session.")

        submitted_question_ids.append(question_id)

    submitted_counts = Counter(submitted_question_ids)
    duplicate_question_ids = [qid for qid, count in submitted_counts.items() if count != 1]
    if duplicate_question_ids:
        raise ValueError(
            "Invalid submission: each session question must have exactly one submitted answer."
        )

    missing_question_ids = expected_question_ids - set(submitted_question_ids)
    if missing_question_ids:
        raise ValueError(
            f"Incomplete submission: {len(missing_question_ids)} question(s) are missing answers."
        )

    # Save answers and compute correctness
    answer_objects = []
    results = []

    for ans in user_answers:
        q = questions_map.get(str(ans["question_id"]))
        if not q:
            raise ValueError("Invalid submission: one or more answers do not belong to this session.")
        is_correct = ans["selected_answer"] == q.correct_answer
        answer_objects.append(
            AssessmentAnswer(
                id=uuid4(),
                session_id=session_id,
                question_id=q.id,
                selected_answer=ans["selected_answer"],
                is_correct=is_correct,
                answered_at=datetime.utcnow()
            )
        )
        results.append(
            AssessmentQuestionResult(
                question_id=q.id,
                selected_answer=ans["selected_answer"],
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                is_correct=is_correct
            )
        )

    db.bulk_save_objects(answer_objects)

    # Calculate score & proficiency
    score = calculate_score([{"is_correct": r.is_correct} for r in results])
    proficiency = score_to_proficiency(score)

    # Update session
    session.score = score
    session.status = "submitted"
    session.submitted_at = datetime.utcnow()
    db.commit()

    # Save proficiency based on session type
    if session.type in ("skills", "skill"):
        user_skill = db.query(UserSkill).filter_by(user_id=user_id, skill_id=session.skill_id).first()
        if user_skill:
            user_skill.score = score
            user_skill.proficiency = proficiency
        else:
            user_skill = UserSkill(
                id=uuid4(),
                user_id=user_id,
                skill_id=session.skill_id,
                score=score,
                proficiency=proficiency,
                isCV=True
            )
            db.add(user_skill)

    else:  # roadmap / section / step
        filter_kwargs = {"user_id": user_id, "type": session.type}
        if session.type == "roadmap":
            filter_kwargs["roadmap_id"] = session.roadmap_id
        elif session.type == "section":
            filter_kwargs["section_id"] = session.section_id
        elif session.type == "step":
            filter_kwargs["step_id"] = session.step_id

        roadmap_result = db.query(RoadmapAssessmentResult).filter_by(**filter_kwargs).first()
        if roadmap_result:
            roadmap_result.score = score
            roadmap_result.proficiency = proficiency
            roadmap_result.completion_status = "completed"
            roadmap_result.completed_at = datetime.utcnow()
            roadmap_result.updated_at = datetime.utcnow()
        else:
            roadmap_result = RoadmapAssessmentResult(
                id=uuid4(),
                user_id=user_id,
                roadmap_id=session.roadmap_id,
                section_id=session.section_id if session.type in ("section", "step") else None,
                step_id=session.step_id if session.type == "step" else None,
                type=session.type,
                score=score,
                proficiency=proficiency,
                completion_status="completed",
                completed_at=datetime.utcnow(),
            )
            db.add(roadmap_result)

    db.commit()

    return SubmitAssessmentResponse(
        session_id=session_id,
        score=score,
        total_questions=session.total_questions,
        results=results
    )
    

def get_results(db: Session, session_id: str, user_id: str) -> SubmitAssessmentResponse:
    session = db.query(AssessmentSession).filter_by(id=session_id, user_id=user_id).first()
    if not session or session.status != "submitted":
        raise ValueError("Results not available")

    answers = db.query(AssessmentAnswer).filter_by(session_id=session_id).all()
    questions = db.query(AssessmentQuestion).filter_by(session_id=session_id).all()
    questions_map = {q.id: q for q in questions}

    results = [
        AssessmentQuestionResult(
            question_id=a.question_id,
            selected_answer=a.selected_answer,
            correct_answer=questions_map[a.question_id].correct_answer,
            explanation=questions_map[a.question_id].explanation,
            is_correct=a.is_correct
        )
        for a in answers
    ]

    return SubmitAssessmentResponse(
        session_id=session_id,
        score=session.score,
        total_questions=session.total_questions,
        results=results
    )