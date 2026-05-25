from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from db.models import User
from schemas import UserProfileReadSchema, UserProfileUpsertSchema


PROFILE_FIELD_NAMES = (
    "full_name",
    "professional_title",
    "email",
    "secondary_email",
    "phone",
    "city",
    "country",
    "linkedin",
    "portfolio",
    "github",
    "username",
    "summary",
)


def _clean_optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _fallback_full_name(
    *,
    full_name: Optional[str],
    auth_display_name: Optional[str],
    username: Optional[str],
    email: Optional[str],
) -> Optional[str]:
    if full_name:
        return full_name
    if auth_display_name:
        return auth_display_name
    if username:
        return username
    if email:
        prefix = email.split("@")[0].strip()
        if prefix:
            return prefix
    return None


def get_user_profile_service(db: Session, user_id: UUID) -> UserProfileReadSchema:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User profile not found")

    return UserProfileReadSchema.model_validate(user)


def upsert_user_profile_service(
    db: Session,
    user_id: UUID,
    payload: UserProfileUpsertSchema,
) -> UserProfileReadSchema:
    incoming = payload.model_dump(exclude_unset=True)
    cleaned = {
        key: _clean_optional_text(value)
        for key, value in incoming.items()
        if key in PROFILE_FIELD_NAMES
    }

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        fallback_name = _fallback_full_name(
            full_name=cleaned.get("full_name"),
            auth_display_name=_clean_optional_text(payload.auth_display_name),
            username=cleaned.get("username"),
            email=cleaned.get("email"),
        )
        if not fallback_name:
            raise ValueError("full_name is required to create a profile")

        user = User(id=user_id, full_name=fallback_name)
        db.add(user)
        db.flush()

    # Update only provided fields, so unset keys never wipe existing values.
    for field_name, field_value in cleaned.items():
        if field_name == "full_name":
            continue
        setattr(user, field_name, field_value)

    if "full_name" in cleaned:
        next_name = cleaned.get("full_name")
        if not next_name:
            raise ValueError("full_name cannot be empty")
        user.full_name = next_name
    elif not user.full_name:
        fallback_name = _fallback_full_name(
            full_name=None,
            auth_display_name=_clean_optional_text(payload.auth_display_name),
            username=user.username,
            email=user.email,
        )
        if not fallback_name:
            raise ValueError("full_name is required")
        user.full_name = fallback_name

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(user)
    return UserProfileReadSchema.model_validate(user)
