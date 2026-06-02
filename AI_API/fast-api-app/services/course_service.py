from datetime import UTC, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.models import Course, CourseUserProgress, RoadmapCourse, User
from schemas import CourseProgressItemRead, UserCourseProgressListResponse


VALID_COURSE_STATUSES = {"saved", "enrolled", "completed"}


def _normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _normalize_tags(value: Any) -> Optional[List[str]]:
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = value.strip()
        return [cleaned] if cleaned else None

    if not isinstance(value, list):
        return None

    tags: List[str] = []
    seen = set()
    for item in value:
        if item is None:
            continue
        cleaned = str(item).strip()
        if not cleaned:
            continue
        normalized_key = cleaned.casefold()
        if normalized_key in seen:
            continue
        seen.add(normalized_key)
        tags.append(cleaned)

    return tags or None


def _normalize_course_input(course_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    title = _normalize_str(course_data.get("name") or course_data.get("title"))
    url = _normalize_str(course_data.get("url"))

    if not title or not url:
        return None

    return {
        "platform": _normalize_str(course_data.get("platform")),
        "title": title,
        "instructor": _normalize_str(course_data.get("instructor")),
        "tags": _normalize_tags(course_data.get("tags")),
        "duration": _normalize_str(course_data.get("duration")),
        "url": url,
        "category": _normalize_str(course_data.get("category")),
        "level": _normalize_str(course_data.get("level")),
        "price": _normalize_str(course_data.get("price")),
        "language": _normalize_str(course_data.get("language")),
    }


def fetch_course_by_id(db: Session, course_id: UUID) -> Optional[Course]:
    return db.query(Course).filter(Course.id == course_id).first()


def get_courses_grouped(db: Session) -> Dict[str, Dict[str, List[Course]]]:
    courses = db.query(Course).order_by(Course.category.asc().nullsfirst(), Course.title.asc()).all()

    grouped: Dict[str, Dict[str, List[Course]]] = {}
    for course in courses:
        category = (course.category or "Uncategorized").strip() or "Uncategorized"
        tags = [tag.strip() for tag in (course.tags or []) if tag and tag.strip()]
        if not tags:
            tags = ["Unspecified"]

        category_group = grouped.setdefault(category, {})
        for tag in tags:
            category_group.setdefault(tag, []).append(course)

    return grouped


def get_courses_by_category(db: Session, category: str) -> Dict[str, List[Course]]:
    normalized_category = category.strip()
    courses = db.query(Course).filter(func.lower(Course.category) == normalized_category.lower()).order_by(Course.title.asc()).all()

    grouped_by_skill: Dict[str, List[Course]] = {}
    for course in courses:
        tags = [tag.strip() for tag in (course.tags or []) if tag and tag.strip()]
        if not tags:
            tags = ["Unspecified"]

        for tag in tags:
            grouped_by_skill.setdefault(tag, []).append(course)

    return grouped_by_skill


def get_courses_by_skill(db: Session, tag: str, category: Optional[str] = None) -> List[Course]:
    normalized_tag = tag.strip().casefold()

    query_obj = db.query(Course)
    if category:
        query_obj = query_obj.filter(func.lower(Course.category) == category.strip().lower())

    courses = query_obj.order_by(Course.title.asc()).all()
    return [
        course
        for course in courses
        if any((course_tag or "").strip().casefold() == normalized_tag for course_tag in (course.tags or []))
    ]


def _resolve_course_for_progress(db: Session, user_id: UUID, course_id: UUID) -> Course:
    user_exists = db.query(User.id).filter(User.id == user_id).first()
    if not user_exists:
        raise ValueError(f"User with ID {user_id} not found")

    course = db.query(Course).filter(Course.id == course_id).first()
    if course:
        return course

    roadmap_course = db.query(RoadmapCourse).filter(RoadmapCourse.id == course_id).first()
    if not roadmap_course:
        raise ValueError(f"Course with ID {course_id} not found")

    existing_course = db.query(Course).filter(Course.url == roadmap_course.url).first()
    if existing_course:
        # TODO: if mirrored roadmap courses keep a different Course.id, frontend status matching may need URL-based reconciliation.
        return existing_course

    mirrored_course = Course(
        id=roadmap_course.id,
        platform=roadmap_course.provider,
        title=roadmap_course.title,
        url=roadmap_course.url,
        category=None,
        level=None,
        language=roadmap_course.language,
        price="Free" if roadmap_course.is_free is True else None,
    )

    db.add(mirrored_course)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing_course = db.query(Course).filter(Course.url == roadmap_course.url).first()
        if existing_course:
            # TODO: if mirrored roadmap courses keep a different Course.id, frontend status matching may need URL-based reconciliation.
            return existing_course
        raise

    return mirrored_course


def update_course_status(db: Session, user_id: UUID, course_id: UUID, status: str) -> CourseUserProgress:
    normalized_status = (status or "").strip().lower()
    if normalized_status not in VALID_COURSE_STATUSES:
        raise ValueError("Invalid status. Allowed values: saved, enrolled, completed")

    course = _resolve_course_for_progress(db, user_id, course_id)

    now = datetime.now(UTC)

    insert_values: Dict[str, Any] = {
        "user_id": user_id,
        "course_id": course.id,
        "status": normalized_status,
        "saved_at": now if normalized_status == "saved" else None,
        "started_at": now if normalized_status == "enrolled" else None,
        "completed_at": now if normalized_status == "completed" else None,
    }

    update_values: Dict[str, Any] = {
        "status": normalized_status,
        "updated_at": now,
    }

    if normalized_status == "saved":
        update_values["saved_at"] = now
    elif normalized_status == "enrolled":
        update_values["started_at"] = now
    elif normalized_status == "completed":
        update_values["completed_at"] = now

    upsert_stmt = (
        pg_insert(CourseUserProgress)
        .values(**insert_values)
        .on_conflict_do_update(
            index_elements=[CourseUserProgress.user_id, CourseUserProgress.course_id],
            set_=update_values,
        )
        .returning(CourseUserProgress.id)
    )

    try:
        progress_id = db.execute(upsert_stmt).scalar_one()
        db.commit()
    except Exception:
        db.rollback()
        raise

    progress = db.query(CourseUserProgress).filter(CourseUserProgress.id == progress_id).first()
    if not progress:
        raise ValueError("Failed to fetch updated course progress")

    return progress


def get_user_course_progress(db: Session, user_id: UUID) -> UserCourseProgressListResponse:
    user_exists = db.query(User.id).filter(User.id == user_id).first()
    if not user_exists:
        raise ValueError(f"User with ID {user_id} not found")

    progress_rows = (
        db.query(CourseUserProgress, Course)
        .join(Course, Course.id == CourseUserProgress.course_id)
        .filter(CourseUserProgress.user_id == user_id)
        .order_by(CourseUserProgress.updated_at.desc(), Course.title.asc())
        .all()
    )

    current: List[CourseProgressItemRead] = []
    completed: List[CourseProgressItemRead] = []

    for progress, course in progress_rows:
        item = CourseProgressItemRead(
            course_id=progress.course_id,
            status=progress.status,
            title=course.title,
            provider=course.platform,
            url=course.url,
            started_at=progress.started_at,
            completed_at=progress.completed_at,
            saved_at=progress.saved_at,
            updated_at=progress.updated_at,
        )

        if progress.status == "completed":
            completed.append(item)
        else:
            current.append(item)

    return UserCourseProgressListResponse(
        user_id=user_id,
        current=current,
        completed=completed,
    )


def bulk_import_courses(db: Session, courses_data: List[dict]) -> Dict[str, Any]:
    inserted = 0
    skipped = 0
    duplicates: List[str] = []

    try:
        for item in courses_data:
            if not isinstance(item, dict):
                skipped += 1
                continue

            normalized = _normalize_course_input(item)
            if not normalized:
                skipped += 1
                continue

            stmt = (
                pg_insert(Course)
                .values(**normalized)
                .on_conflict_do_nothing(index_elements=[Course.url])
                .returning(Course.id)
            )

            inserted_id = db.execute(stmt).scalar_one_or_none()
            if inserted_id:
                inserted += 1
            else:
                skipped += 1
                duplicates.append(normalized["url"])

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "inserted": inserted,
        "skipped": skipped,
        "total_processed": len(courses_data),
        "duplicates": duplicates,
    }


# Aliases required by external callers using camelCase naming.
def getCoursesGrouped(db: Session) -> Dict[str, Dict[str, List[Course]]]:
    return get_courses_grouped(db)


def getCoursesByCategory(db: Session, category: str) -> Dict[str, List[Course]]:
    return get_courses_by_category(db, category)


def getCoursesBySkill(db: Session, tag: str, category: Optional[str] = None) -> List[Course]:
    return get_courses_by_skill(db, tag, category)


def updateCourseStatus(db: Session, user_id: UUID, course_id: UUID, status: str) -> CourseUserProgress:
    return update_course_status(db, user_id, course_id, status)


def bulkImportCourses(db: Session, courses_data: List[dict]) -> Dict[str, Any]:
    return bulk_import_courses(db, courses_data)
