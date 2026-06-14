from datetime import datetime, timezone
from typing import Dict, List
from uuid import UUID, uuid4

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from db.models import Roadmap, RoadmapAssessmentResult, RoadmapSection, RoadmapStep
from schemas import (
    CurrentRoadmapLearningSchema,
    RoadmapProgressSummarySchema,
    SectionProgressSummarySchema,
    StepProgressReadSchema,
    StepProgressUpsertRequestSchema,
    UserRoadmapProgressItemSchema,
    UserRoadmapProgressListSchema,
)


def _utc_now():
    return datetime.now(timezone.utc)


def _completion_status(completed: int, total: int) -> str:
    if total <= 0 or completed <= 0:
        return "not_started"
    if completed >= total:
        return "completed"
    return "in_progress"


def _percent(completed: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round((completed / total) * 100))


def _upsert_progress_row(
    db: Session,
    *,
    user_id: UUID,
    result_type: str,
    roadmap_id: UUID | None,
    section_id: UUID | None,
    step_id: UUID | None,
) -> RoadmapAssessmentResult:
    row = (
        db.query(RoadmapAssessmentResult)
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.type == result_type,
            RoadmapAssessmentResult.roadmap_id.is_(roadmap_id) if roadmap_id is None else RoadmapAssessmentResult.roadmap_id == roadmap_id,
            RoadmapAssessmentResult.section_id.is_(section_id) if section_id is None else RoadmapAssessmentResult.section_id == section_id,
            RoadmapAssessmentResult.step_id.is_(step_id) if step_id is None else RoadmapAssessmentResult.step_id == step_id,
        )
        .first()
    )

    if row:
        return row

    row = RoadmapAssessmentResult(
        id=uuid4(),
        user_id=user_id,
        type=result_type,
        roadmap_id=roadmap_id,
        section_id=section_id,
        step_id=step_id,
        completion_status="not_started",
    )
    db.add(row)
    db.flush()
    return row


def _recompute_section_progress(db: Session, user_id: UUID, roadmap_id: UUID, section: RoadmapSection) -> None:
    section_metrics = (
        db.query(
            func.count(RoadmapStep.id).label("total_steps"),
            func.sum(
                case(
                    (RoadmapAssessmentResult.completion_status == "completed", 1),
                    else_=0,
                )
            ).label("completed_steps"),
            func.avg(RoadmapAssessmentResult.score).label("avg_score"),
        )
        .outerjoin(
            RoadmapAssessmentResult,
            and_(
                RoadmapAssessmentResult.step_id == RoadmapStep.id,
                RoadmapAssessmentResult.user_id == user_id,
                RoadmapAssessmentResult.type == "step",
            ),
        )
        .filter(RoadmapStep.section_id == section.id)
        .first()
    )

    total_steps = int(section_metrics.total_steps or 0) if section_metrics else 0
    completed_steps = int(section_metrics.completed_steps or 0) if section_metrics else 0
    status = _completion_status(completed_steps, total_steps)
    avg_score = int(round(section_metrics.avg_score)) if section_metrics and section_metrics.avg_score is not None else None

    section_row = _upsert_progress_row(
        db,
        user_id=user_id,
        result_type="section",
        roadmap_id=roadmap_id,
        section_id=section.id,
        step_id=None,
    )
    section_row.completion_status = status
    section_row.completed_at = _utc_now() if status == "completed" else None
    section_row.score = avg_score


def _recompute_roadmap_progress(db: Session, user_id: UUID, roadmap: Roadmap) -> None:
    total_sections = (
        db.query(func.count(RoadmapSection.id))
        .filter(RoadmapSection.roadmap_id == roadmap.id)
        .scalar()
    )
    total_sections = int(total_sections or 0)

    section_results = (
        db.query(RoadmapAssessmentResult.completion_status, RoadmapAssessmentResult.score)
        .join(
            RoadmapSection,
            RoadmapSection.id == RoadmapAssessmentResult.section_id,
        )
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.type == "section",
            RoadmapAssessmentResult.roadmap_id == roadmap.id,
            RoadmapSection.roadmap_id == roadmap.id,
        )
        .all()
    )

    completed_sections = sum(1 for row in section_results if row.completion_status == "completed")
    scores = [int(row.score) for row in section_results if row.score is not None]

    status = _completion_status(completed_sections, total_sections)
    avg_score = int(round(sum(scores) / len(scores))) if scores else None

    roadmap_row = _upsert_progress_row(
        db,
        user_id=user_id,
        result_type="roadmap",
        roadmap_id=roadmap.id,
        section_id=None,
        step_id=None,
    )
    roadmap_row.completion_status = status
    roadmap_row.completed_at = _utc_now() if status == "completed" else None
    roadmap_row.score = avg_score


def _get_locked_section_message(
    db: Session,
    user_id: UUID,
    roadmap_id: UUID,
    target_section: RoadmapSection,
) -> str | None:
    existing_target_progress = (
        db.query(RoadmapAssessmentResult.id)
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.roadmap_id == roadmap_id,
            RoadmapAssessmentResult.section_id == target_section.id,
            RoadmapAssessmentResult.type == "step",
        )
        .first()
    )
    if existing_target_progress:
        return None

    previous_sections = (
        db.query(
            RoadmapSection.id.label("section_id"),
            RoadmapSection.title.label("title"),
            func.count(RoadmapStep.id).label("total_steps"),
            func.sum(
                case(
                    (RoadmapAssessmentResult.completion_status == "completed", 1),
                    else_=0,
                )
            ).label("completed_steps"),
        )
        .outerjoin(RoadmapStep, RoadmapStep.section_id == RoadmapSection.id)
        .outerjoin(
            RoadmapAssessmentResult,
            and_(
                RoadmapAssessmentResult.step_id == RoadmapStep.id,
                RoadmapAssessmentResult.user_id == user_id,
                RoadmapAssessmentResult.type == "step",
            ),
        )
        .filter(
            RoadmapSection.roadmap_id == roadmap_id,
            RoadmapSection.order < target_section.order,
        )
        .group_by(RoadmapSection.id, RoadmapSection.title, RoadmapSection.order)
        .order_by(RoadmapSection.order.asc(), RoadmapSection.id.asc())
        .all()
    )
    if not previous_sections:
        return None

    first_incomplete_previous = next(
        (
            section
            for section in previous_sections
            if _completion_status(
                int(section.completed_steps or 0),
                int(section.total_steps or 0),
            )
            != "completed"
        ),
        None,
    )
    if not first_incomplete_previous:
        return None

    return (
        f'Complete "{first_incomplete_previous.title}" before updating '
        f'"{target_section.title}".'
    )


def upsert_step_progress_service(
    db: Session,
    roadmap_id: UUID,
    user_id: UUID,
    step_id: UUID,
    payload: StepProgressUpsertRequestSchema,
) -> RoadmapProgressSummarySchema:
    roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        raise ValueError("Roadmap not found")

    step = db.query(RoadmapStep).filter(RoadmapStep.id == step_id).first()
    if not step:
        raise ValueError("Step not found")

    section = db.query(RoadmapSection).filter(RoadmapSection.id == step.section_id).first()
    if not section or section.roadmap_id != roadmap.id:
        raise ValueError("Step does not belong to roadmap")

    locked_section_message = _get_locked_section_message(db, user_id, roadmap.id, section)
    if locked_section_message:
        raise ValueError(locked_section_message)

    step_row = _upsert_progress_row(
        db,
        user_id=user_id,
        result_type="step",
        roadmap_id=roadmap.id,
        section_id=section.id,
        step_id=step.id,
    )

    step_row.completion_status = payload.completion_status
    step_row.score = payload.score
    step_row.proficiency = payload.proficiency
    step_row.completed_at = _utc_now() if payload.completion_status == "completed" else None

    _recompute_section_progress(db, user_id, roadmap.id, section)
    _recompute_roadmap_progress(db, user_id, roadmap)

    db.commit()
    return get_roadmap_progress_service(db, roadmap_id, user_id)


def get_roadmap_progress_service(db: Session, roadmap_id: UUID, user_id: UUID) -> RoadmapProgressSummarySchema:
    roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        raise ValueError("Roadmap not found")

    sections = (
        db.query(RoadmapSection)
        .filter(RoadmapSection.roadmap_id == roadmap.id)
        .order_by(RoadmapSection.order.asc(), RoadmapSection.id.asc())
        .all()
    )

    section_ids = [section.id for section in sections]
    steps = []
    if section_ids:
        steps = (
            db.query(RoadmapStep)
            .filter(RoadmapStep.section_id.in_(section_ids))
            .order_by(RoadmapStep.order.asc(), RoadmapStep.id.asc())
            .all()
        )

    progress_rows = (
        db.query(RoadmapAssessmentResult)
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.roadmap_id == roadmap.id,
            RoadmapAssessmentResult.type == "step",
        )
        .all()
    )

    step_progress = {row.step_id: row for row in progress_rows if row.step_id}

    steps_by_section: Dict[UUID, List[RoadmapStep]] = {}
    for step in steps:
        steps_by_section.setdefault(step.section_id, []).append(step)

    section_summaries: List[SectionProgressSummarySchema] = []
    completed_sections = 0
    completed_steps_global = 0

    for section in sections:
        section_steps = steps_by_section.get(section.id, [])
        step_items: List[StepProgressReadSchema] = []
        completed_steps = 0

        for step in section_steps:
            row = step_progress.get(step.id)
            status = row.completion_status if row else "not_started"
            if status == "completed":
                completed_steps += 1
                completed_steps_global += 1

            step_items.append(
                StepProgressReadSchema(
                    step_id=step.id,
                    completion_status=status,
                    completed_at=row.completed_at if row else None,
                    score=row.score if row else None,
                    proficiency=row.proficiency if row else None,
                )
            )

        section_status = _completion_status(completed_steps, len(section_steps))
        if section_status == "completed":
            completed_sections += 1

        section_summaries.append(
            SectionProgressSummarySchema(
                section_id=section.id,
                title=section.title,
                completion_status=section_status,
                completed_steps=completed_steps,
                total_steps=len(section_steps),
                completion_percent=_percent(completed_steps, len(section_steps)),
                steps=step_items,
            )
        )

    total_steps_global = len(steps)
    roadmap_status = _completion_status(completed_sections, len(sections))

    return RoadmapProgressSummarySchema(
        roadmap_id=roadmap.id,
        title=roadmap.title,
        completion_status=roadmap_status,
        completed_sections=completed_sections,
        total_sections=len(sections),
        completed_steps=completed_steps_global,
        total_steps=total_steps_global,
        completion_percent=_percent(completed_steps_global, total_steps_global),
        sections=section_summaries,
    )


def get_user_roadmaps_progress_service(db: Session, user_id: UUID) -> UserRoadmapProgressListSchema:
    roadmaps = db.query(Roadmap).order_by(Roadmap.title.asc()).all()
    section_totals_rows = (
        db.query(
            RoadmapSection.id.label("section_id"),
            RoadmapSection.roadmap_id.label("roadmap_id"),
            func.count(RoadmapStep.id).label("total_steps"),
        )
        .outerjoin(RoadmapStep, RoadmapStep.section_id == RoadmapSection.id)
        .group_by(RoadmapSection.id, RoadmapSection.roadmap_id)
        .all()
    )

    completed_steps_rows = (
        db.query(
            RoadmapStep.section_id.label("section_id"),
            func.count(RoadmapAssessmentResult.id).label("completed_steps"),
        )
        .join(
            RoadmapAssessmentResult,
            and_(
                RoadmapAssessmentResult.step_id == RoadmapStep.id,
                RoadmapAssessmentResult.user_id == user_id,
                RoadmapAssessmentResult.type == "step",
                RoadmapAssessmentResult.completion_status == "completed",
            ),
        )
        .group_by(RoadmapStep.section_id)
        .all()
    )

    completed_steps_by_section: Dict[UUID, int] = {
        row.section_id: int(row.completed_steps or 0)
        for row in completed_steps_rows
        if row.section_id
    }

    roadmap_totals: Dict[UUID, Dict[str, int]] = {}
    for row in section_totals_rows:
        roadmap_id = row.roadmap_id
        section_id = row.section_id
        if not roadmap_id or not section_id:
            continue

        total_steps = int(row.total_steps or 0)
        completed_steps = completed_steps_by_section.get(section_id, 0)

        aggregates = roadmap_totals.setdefault(
            roadmap_id,
            {
                "completed_sections": 0,
                "total_sections": 0,
                "completed_steps": 0,
                "total_steps": 0,
            },
        )

        aggregates["total_sections"] += 1
        aggregates["total_steps"] += total_steps
        aggregates["completed_steps"] += completed_steps

        section_status = _completion_status(completed_steps, total_steps)
        if section_status == "completed":
            aggregates["completed_sections"] += 1

    default_totals = {
        "completed_sections": 0,
        "total_sections": 0,
        "completed_steps": 0,
        "total_steps": 0,
    }

    items: List[UserRoadmapProgressItemSchema] = []
    for roadmap in roadmaps:
        aggregates = roadmap_totals.get(roadmap.id, default_totals)
        completion_status = _completion_status(
            aggregates["completed_sections"],
            aggregates["total_sections"],
        )
        completion_percent = _percent(
            aggregates["completed_steps"],
            aggregates["total_steps"],
        )

        items.append(
            UserRoadmapProgressItemSchema(
                roadmap_id=roadmap.id,
                title=roadmap.title,
                completion_status=completion_status,
                completion_percent=completion_percent,
            )
        )

    return UserRoadmapProgressListSchema(user_id=user_id, roadmaps=items)


def _get_roadmap_completion_percent(db: Session, user_id: UUID, roadmap_id: UUID) -> int:
    total_steps = (
        db.query(func.count(RoadmapStep.id))
        .join(RoadmapSection, RoadmapSection.id == RoadmapStep.section_id)
        .filter(RoadmapSection.roadmap_id == roadmap_id)
        .scalar()
    )

    completed_steps = (
        db.query(func.count(func.distinct(RoadmapAssessmentResult.step_id)))
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.roadmap_id == roadmap_id,
            RoadmapAssessmentResult.type == "step",
            RoadmapAssessmentResult.completion_status == "completed",
        )
        .scalar()
    )

    return _percent(int(completed_steps or 0), int(total_steps or 0))


def get_current_roadmap_learning_service(
    db: Session,
    user_id: UUID,
    roadmap_id: UUID | None = None,
) -> CurrentRoadmapLearningSchema:
    base_query = (
        db.query(
            RoadmapAssessmentResult.roadmap_id.label("roadmap_id"),
            RoadmapAssessmentResult.section_id.label("section_id"),
            RoadmapAssessmentResult.step_id.label("step_id"),
            Roadmap.title.label("roadmap_title"),
            RoadmapSection.title.label("section_title"),
            RoadmapStep.title.label("step_title"),
        )
        .join(Roadmap, Roadmap.id == RoadmapAssessmentResult.roadmap_id)
        .outerjoin(RoadmapSection, RoadmapSection.id == RoadmapAssessmentResult.section_id)
        .outerjoin(RoadmapStep, RoadmapStep.id == RoadmapAssessmentResult.step_id)
        .filter(
            RoadmapAssessmentResult.user_id == user_id,
            RoadmapAssessmentResult.type == "step",
        )
    )

    if roadmap_id:
        base_query = base_query.filter(RoadmapAssessmentResult.roadmap_id == roadmap_id)

    # Pick the most recently updated actionable step for the user.
    # This avoids stale in_progress rows shadowing newer completed actions.
    current_step_row = (
        base_query
        .filter(RoadmapAssessmentResult.completion_status.in_(["in_progress", "completed"]))
        .order_by(
            RoadmapAssessmentResult.updated_at.desc(),
            case(
                (RoadmapAssessmentResult.completion_status == "in_progress", 0),
                (RoadmapAssessmentResult.completion_status == "completed", 1),
                else_=2,
            ),
        )
        .first()
    )

    if not current_step_row or not current_step_row.roadmap_id:
        raise ValueError("No current roadmap learning progress found for user")

    progress_percent = _get_roadmap_completion_percent(db, user_id, current_step_row.roadmap_id)

    return CurrentRoadmapLearningSchema(
        roadmap_id=current_step_row.roadmap_id,
        roadmap_title=current_step_row.roadmap_title,
        section_id=current_step_row.section_id,
        section_title=current_step_row.section_title,
        step_id=current_step_row.step_id,
        step_title=current_step_row.step_title,
        progress_percent=progress_percent,
    )
