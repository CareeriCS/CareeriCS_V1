from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.models import Roadmap, User, UserJourneyProgress
from schemas import (
    JourneyTrackProgressListSchema,
    JourneyTrackProgressReadSchema,
    JourneyTrackProgressUpsertSchema,
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _ensure_user_exists(db: Session, user_id: UUID) -> None:
    if not db.query(User.id).filter(User.id == user_id).first():
        raise ValueError("User not found")

def _ensure_roadmap_exists(db: Session, roadmap_id: UUID | None) -> None:
    if roadmap_id is None:
        return

    if not db.query(Roadmap.id).filter(Roadmap.id == roadmap_id).first():
        raise ValueError("Roadmap not found")


def _normalize_phase(value: int) -> int:
    return max(1, min(5, int(value)))


def get_user_journey_progress_service(
    db: Session,
    user_id: UUID,
) -> JourneyTrackProgressListSchema:
    _ensure_user_exists(db, user_id)

    rows = (
        db.query(UserJourneyProgress)
        .filter(UserJourneyProgress.user_id == user_id)
        .order_by(
            UserJourneyProgress.is_selected.desc(),
            UserJourneyProgress.updated_at.desc(),
            UserJourneyProgress.created_at.desc(),
        )
        .all()
    )

    return JourneyTrackProgressListSchema(
        user_id=user_id,
        tracks=[JourneyTrackProgressReadSchema.model_validate(row) for row in rows],
    )


def upsert_user_journey_progress_service(
    db: Session,
    user_id: UUID,
    track_id: UUID,
    payload: JourneyTrackProgressUpsertSchema,
) -> JourneyTrackProgressReadSchema:
    _ensure_user_exists(db, user_id)
    _ensure_roadmap_exists(db, payload.roadmap_id)

    now = payload.last_visited_at or _utc_now()
    requested_current_phase = _normalize_phase(payload.current_phase)
    requested_max_reached_phase = max(
        requested_current_phase,
        _normalize_phase(payload.max_reached_phase),
    )
    existing_row = (
        db.query(UserJourneyProgress)
        .filter(
            UserJourneyProgress.user_id == user_id,
            UserJourneyProgress.track_id == track_id,
        )
        .first()
    )
    has_started = bool(payload.has_started or (existing_row.has_started if existing_row else False))
    current_phase = requested_current_phase
    max_reached_phase = requested_max_reached_phase
    roadmap_id = payload.roadmap_id

    if existing_row:
        current_phase = max(existing_row.current_phase, current_phase)
        max_reached_phase = max(existing_row.max_reached_phase, max_reached_phase)
        if roadmap_id is None:
            roadmap_id = existing_row.roadmap_id

    try:
        if payload.is_selected:
            (
                db.query(UserJourneyProgress)
                .filter(
                    UserJourneyProgress.user_id == user_id,
                    UserJourneyProgress.track_id != track_id,
                    UserJourneyProgress.is_selected.is_(True),
                )
                .update(
                    {
                        UserJourneyProgress.is_selected: False,
                        UserJourneyProgress.updated_at: now,
                    },
                    synchronize_session=False,
                )
            )

        upsert_stmt = (
            pg_insert(UserJourneyProgress)
            .values(
                user_id=user_id,
                track_id=track_id,
                roadmap_id=roadmap_id,
                current_phase=current_phase,
                max_reached_phase=max_reached_phase,
                has_started=has_started,
                is_selected=payload.is_selected,
                last_visited_at=now,
            )
            .on_conflict_do_update(
                index_elements=[UserJourneyProgress.user_id, UserJourneyProgress.track_id],
                set_={
                    "roadmap_id": roadmap_id,
                    "current_phase": current_phase,
                    "max_reached_phase": max_reached_phase,
                    "has_started": has_started,
                    "is_selected": payload.is_selected,
                    "last_visited_at": now,
                    "updated_at": now,
                },
            )
            .returning(UserJourneyProgress.id)
        )

        progress_id = db.execute(upsert_stmt).scalar_one()
        db.commit()
    except Exception:
        db.rollback()
        raise

    row = db.query(UserJourneyProgress).filter(UserJourneyProgress.id == progress_id).first()
    if not row:
        raise ValueError("Failed to fetch updated journey progress")

    return JourneyTrackProgressReadSchema.model_validate(row)


def delete_user_journey_progress_service(
    db: Session,
    user_id: UUID,
    track_id: UUID,
) -> None:
    _ensure_user_exists(db, user_id)

    row = (
        db.query(UserJourneyProgress)
        .filter(
            UserJourneyProgress.user_id == user_id,
            UserJourneyProgress.track_id == track_id,
        )
        .first()
    )
    if not row:
        return

    try:
        db.delete(row)
        db.commit()
    except Exception:
        db.rollback()
        raise
