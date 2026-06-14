from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from ai.completion import deepseek_response
from ai.prompts import skill_assessment_questions_prompt
from db.models import AssessmentQuestion, AssessmentSession, Roadmap, RoadmapSection, RoadmapStep, Skill
from schemas import AssessmentQuestionResponse
from utils.util import _safe_json_parse

VALID_DIFFICULTIES = {"easy", "medium", "hard"}
DEFAULT_DIFFICULTY = "medium"


def _normalize_ai_questions_payload(parsed_output: Any) -> list[dict[str, Any]]:
    if isinstance(parsed_output, list):
        return [item for item in parsed_output if isinstance(item, dict)]

    if isinstance(parsed_output, dict):
        nested = parsed_output.get("questions")
        if isinstance(nested, list):
            return [item for item in nested if isinstance(item, dict)]
        return [parsed_output]

    return []


def _validate_and_normalize_question(item: dict[str, Any]) -> dict[str, Any] | None:
    question_text = str(item.get("question", "")).strip()
    if not question_text:
        return None

    options_raw = item.get("options")
    if not isinstance(options_raw, list) or len(options_raw) != 4:
        return None

    options = [str(option).strip() for option in options_raw]
    if any(not option for option in options):
        return None

    correct_answer = str(item.get("correct_answer", "")).strip()
    if not correct_answer or correct_answer not in options:
        return None

    explanation = str(item.get("explanation", "")).strip()
    if not explanation:
        return None

    difficulty_raw = str(item.get("difficulty", "")).strip().lower()
    difficulty = difficulty_raw if difficulty_raw in VALID_DIFFICULTIES else DEFAULT_DIFFICULTY

    return {
        "question": question_text,
        "options": options,
        "correct_answer": correct_answer,
        "explanation": explanation,
        "difficulty": difficulty,
    }


def _deduplicate_by_question_text(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_questions: list[dict[str, Any]] = []
    seen_question_texts: set[str] = set()

    for question in questions:
        normalized_text = question["question"].strip().lower()
        if normalized_text in seen_question_texts:
            continue
        seen_question_texts.add(normalized_text)
        unique_questions.append(question)

    return unique_questions


def _generate_valid_questions(name: str, num_questions: int) -> list[dict[str, Any]]:
    last_error: Exception | None = None

    for _ in range(2):  # initial attempt + one retry
        try:
            prompt = skill_assessment_questions_prompt(name, num_questions)
            raw_output = deepseek_response(prompt)
            parsed_output = _safe_json_parse(raw_output)
            candidate_questions = _normalize_ai_questions_payload(parsed_output)
            validated_questions = []

            for candidate in candidate_questions:
                normalized_question = _validate_and_normalize_question(candidate)
                if normalized_question:
                    validated_questions.append(normalized_question)

            deduplicated_questions = _deduplicate_by_question_text(validated_questions)
            if len(deduplicated_questions) >= num_questions:
                return deduplicated_questions[:num_questions]
        except Exception as exc:  # noqa: BLE001 - service-level controlled retry
            last_error = exc

    base_message = (
        f"Failed to generate exactly {num_questions} valid skill assessment questions. "
        "The AI response did not meet required count/format after one retry."
    )
    if last_error:
        raise ValueError(f"{base_message} Last error: {last_error}") from last_error
    raise ValueError(base_message)

# -------------------------
# Generate and Save Questions
# -------------------------
def generate_and_save_questions(db: Session, session_id: str, id: str, num_questions: int):
    session = db.query(AssessmentSession).filter_by(id=session_id).first()
    if not session:
        raise ValueError("Assessment session not found")

    session_type = (session.type or "").strip().lower()
    if session_type == "skill":
        session_type = "skills"

    if session_type == "skills":
        skill = db.query(Skill).filter_by(id=id).first()
        if not skill:
            raise ValueError("Skill not found for assessment question generation")
        name = skill.skill_name

    elif session_type == "roadmap":
        roadmap = db.query(Roadmap).filter_by(id=id).first()
        if not roadmap:
            raise ValueError("Roadmap not found for assessment question generation")
        name = roadmap.title

    elif session_type == "section":
        section = db.query(RoadmapSection).filter_by(id=id).first()
        if not section:
            raise ValueError("Roadmap section not found for assessment question generation")

        roadmap = db.query(Roadmap).filter_by(id=section.roadmap_id).first()
        if not roadmap:
            raise ValueError("Roadmap not found for selected section")

        name = f"{roadmap.title}: {section.title}"

    elif session_type == "step":
        step = db.query(RoadmapStep).filter_by(id=id).first()
        if not step:
            raise ValueError("Roadmap step not found for assessment question generation")

        section = db.query(RoadmapSection).filter_by(id=step.section_id).first()
        if not section:
            raise ValueError("Roadmap section not found for selected step")

        roadmap = db.query(Roadmap).filter_by(id=section.roadmap_id).first()
        if not roadmap:
            raise ValueError("Roadmap not found for selected step")

        name = f"{roadmap.title}: {section.title} ({step.title})"

    else:
        raise ValueError("Invalid type. Must be one of: skills, roadmap, section, step.")
        
    ai_questions = _generate_valid_questions(name, num_questions)
    question_objects = [
        AssessmentQuestion(
            id=uuid4(),
            session_id=session_id,
            question_text=q["question"],
            options=q["options"],
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation"),
            difficulty=q.get("difficulty")
        )
        for q in ai_questions
    ]
    if len(question_objects) != num_questions:
        raise ValueError(
            f"Expected exactly {num_questions} questions, but received {len(question_objects)}."
        )

    db.add_all(question_objects)
    db.flush()


# -------------------------
# Fetch Questions for Response
# -------------------------
def get_questions_response(db: Session, session_id: str) -> list[AssessmentQuestionResponse]:
    questions = db.query(AssessmentQuestion).filter_by(session_id=session_id).all()
    return [
        AssessmentQuestionResponse(
            id=q.id,
            question_text=q.question_text,
            options=q.options
        )
        for q in questions
    ]