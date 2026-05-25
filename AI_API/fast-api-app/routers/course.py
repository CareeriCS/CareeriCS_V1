from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from dependencies import get_db
from schemas import (
    BulkCourseImportResult,
    CourseProgressResponse,
    CourseResponse,
    CourseStatusUpdateRequest,
    UserCourseProgressListResponse,
)
from services.course_service import (
    bulk_import_courses as bulk_import_courses_service,
    fetch_course_by_id,
    get_courses_by_category,
    get_user_course_progress,
    get_courses_by_skill,
    get_courses_grouped,
    update_course_status,
)

router = APIRouter(prefix="/courses", tags=["Courses"])


def _parse_user_uuid(user_id: str) -> UUID:
    try:
        return UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")


@router.post("/bulk-import", response_model=BulkCourseImportResult, status_code=status.HTTP_201_CREATED)
def bulk_import_courses_endpoint(
    courses: List[dict],
    db: Session = Depends(get_db)
):
    """
    Bulk import courses and skip duplicates by URL.
    """
    try:
        return bulk_import_courses_service(db, courses)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grouped", response_model=dict)
def list_courses_grouped(db: Session = Depends(get_db)):
    """
    Return hierarchical grouping: category -> tag -> courses.
    """
    try:
        grouped = get_courses_grouped(db)
        return jsonable_encoder(grouped)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category/{category}", response_model=dict)
def list_courses_by_category(
    category: str,
    db: Session = Depends(get_db),
):
    """
    Return courses grouped by tag for a selected category.
    """
    try:
        grouped = get_courses_by_category(db, category)
        return jsonable_encoder(grouped)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skill/{tag}", response_model=List[CourseResponse])
def list_courses_by_skill(
    tag: str,
    category: str | None = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db),
):
    """
    Return all courses that include the requested tag.
    """
    try:
        courses = get_courses_by_skill(db, tag, category)
        return courses
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{course_id}/status", response_model=CourseProgressResponse)
def update_status_endpoint(
    course_id: UUID,
    payload: CourseStatusUpdateRequest,
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db),
):
    """
    Upsert user course status: saved/enrolled/completed.
    """
    try:
        user_uuid = _parse_user_uuid(user_id)
        progress = update_course_status(db, user_uuid, course_id, payload.status)
        return progress
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{user_id}", response_model=UserCourseProgressListResponse)
def get_user_course_progress_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return get_user_course_progress(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{course_id}", response_model=CourseResponse)
def get_course_details(
    course_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get details of a specific course by ID.
    """
    try:
        course = fetch_course_by_id(db, course_id)
        if not course:
            raise HTTPException(status_code=404, detail=f"Course with ID {course_id} not found")
        return course
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
