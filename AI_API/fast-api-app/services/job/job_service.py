import logging
from datetime import UTC, date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import case, func, inspect, null, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.models import JobApplication, JobPost, JobPostSkill, Skill, JobUserInteraction, User, UserSkill
from services.job.normalization import (
    build_filter_option_items,
    normalize_career_level,
    normalize_employment_type,
    normalize_job_metadata,
    normalize_work_type,
)
from services.job_ingestion_helpers import clean_text, normalize_and_attach_skills, normalize_skill_name

logger = logging.getLogger(__name__)


def _has_table(db: Session, table_name: str) -> bool:
    bind = db.get_bind()
    if bind is None:
        return False

    try:
        return inspect(bind).has_table(table_name)
    except Exception:
        return False


def _job_applications_table_exists(db: Session) -> bool:
    # Production stores job application state in job_user_interactions.
    return False


def get_job_skills(db: Session, job_post_id: UUID) -> List[str]:
    """Fetch skill names for a job post."""
    skills = db.query(Skill.skill_name).join(
        JobPostSkill, JobPostSkill.skill_id == Skill.id
    ).filter(JobPostSkill.job_post_id == job_post_id).all()
    return [skill[0] for skill in skills]


def get_user_skills(db: Session, user_id: UUID) -> List[str]:
    """Fetch skill names for a user."""
    skills = db.query(Skill.skill_name).join(
        UserSkill, UserSkill.skill_id == Skill.id
    ).filter(UserSkill.user_id == user_id).all()
    return [skill[0] for skill in skills]


def calculate_job_match_percentage(db: Session, user_id: UUID, job_post_id: UUID) -> float:
    """
    Calculate percentage match between user skills and job skills.
    Returns 0.0 to 100.0
    """
    job_skills = set(get_job_skills(db, job_post_id))
    user_skills = set(get_user_skills(db, user_id))
    match_percentage = _calculate_match_percentage(job_skills, user_skills)
    return match_percentage


def _calculate_match_percentage(job_skills: set[str], user_skills: set[str]) -> float:
    if not job_skills:
        return 0.0

    matched_skills = job_skills & user_skills
    match_percentage = (len(matched_skills) / len(job_skills)) * 100
    return round(match_percentage, 2)


def _serialize_job_post(
    job_post: JobPost,
    skills: List[str],
    *,
    interaction: Optional[JobUserInteraction] = None,
    application: Optional[JobApplication] = None,
    has_application_records: bool = True,
    match_percentage: Optional[float] = None,
) -> Dict[str, Any]:
    normalized_metadata = normalize_job_metadata(
        location=job_post.location,
        work_type=job_post.work_type,
        employment_type=job_post.employment_type,
        career_level=job_post.career_level,
    )
    fallback_application_status = None
    fallback_applied_at = None
    if (
        not has_application_records
        and interaction
        and interaction.viewed_at
        and not interaction.is_saved
    ):
        fallback_application_status = "applied"
        fallback_applied_at = interaction.viewed_at

    return {
        "id": job_post.id,
        "job_title": job_post.job_title,
        "company_name": job_post.company_name,
        "job_url": job_post.job_url,
        "source": job_post.source,
        "location": job_post.location,
        "location_country": normalized_metadata.country,
        "location_city": normalized_metadata.city,
        "posted_date": job_post.posted_date,
        "career_level": normalized_metadata.career_level,
        "work_type": normalized_metadata.work_type,
        "employment_type": normalized_metadata.employment_type,
        "salary": (job_post.salary or "").strip() or None,
        "description_about_role": job_post.description_about_role,
        "description_key_responsibilities": job_post.description_key_responsibilities,
        "description_requirements": job_post.description_requirements,
        "description_nice_to_have": job_post.description_nice_to_have,
        "created_at": job_post.created_at,
        "updated_at": job_post.updated_at,
        "skills": skills,
        "match_percentage": match_percentage,
        "is_saved": interaction.is_saved if interaction else False,
        "saved_at": interaction.saved_at if interaction else None,
        "viewed_at": interaction.viewed_at if interaction else None,
        "view_count": interaction.view_count if interaction else 0,
        "last_interaction_at": interaction.last_interaction_at if interaction else None,
        "application_status": application.status if application else fallback_application_status,
        "applied_at": application.applied_at if application else fallback_applied_at,
    }


def _load_job_skills_map(db: Session, job_ids: List[UUID]) -> Dict[UUID, List[str]]:
    if not job_ids:
        return {}

    rows = db.execute(
        select(JobPostSkill.job_post_id, Skill.skill_name)
        .join(Skill, Skill.id == JobPostSkill.skill_id)
        .where(JobPostSkill.job_post_id.in_(job_ids))
        .order_by(Skill.skill_name.asc())
    ).all()

    skills_map: Dict[UUID, List[str]] = {job_id: [] for job_id in job_ids}
    for job_post_id, skill_name in rows:
        skills_map.setdefault(job_post_id, []).append(skill_name)

    return skills_map


def _load_latest_interactions_map(
    db: Session,
    user_id: UUID,
    job_ids: List[UUID],
) -> Dict[UUID, JobUserInteraction]:
    rows = db.execute(
        select(JobUserInteraction)
        .where(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.job_post_id.in_(job_ids),
        )
        .order_by(
            JobUserInteraction.updated_at.desc(),
            JobUserInteraction.created_at.desc(),
        )
    ).scalars().all()

    interactions_map: Dict[UUID, JobUserInteraction] = {}
    for interaction in rows:
        interactions_map.setdefault(interaction.job_post_id, interaction)

    return interactions_map


def _load_latest_applications_map(
    db: Session,
    user_id: UUID,
    job_ids: List[UUID],
) -> Dict[UUID, JobApplication]:
    if not job_ids or not _job_applications_table_exists(db):
        return {}

    rows = db.execute(
        select(JobApplication)
        .where(
            JobApplication.user_id == user_id,
            JobApplication.job_post_id.in_(job_ids),
        )
        .order_by(
            JobApplication.updated_at.desc(),
            JobApplication.applied_at.desc().nullslast(),
        )
    ).scalars().all()

    applications_map: Dict[UUID, JobApplication] = {}
    for application in rows:
        applications_map.setdefault(application.job_post_id, application)

    return applications_map


def enrich_job_posts(
    db: Session,
    job_posts: List[JobPost],
    user_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    if not job_posts:
        return []

    job_ids = [job_post.id for job_post in job_posts]
    skills_map = _load_job_skills_map(db, job_ids)

    user_skills: set[str] = set()
    interactions_map: Dict[UUID, JobUserInteraction] = {}
    applications_map: Dict[UUID, JobApplication] = {}
    has_application_records = _job_applications_table_exists(db) if user_id else True
    if user_id:
        user_skills = set(get_user_skills(db, user_id))
        interactions_map = _load_latest_interactions_map(db, user_id, job_ids)
        applications_map = _load_latest_applications_map(db, user_id, job_ids)

    enriched_jobs: List[Dict[str, Any]] = []
    for job_post in job_posts:
        job_skills = skills_map.get(job_post.id, [])
        match_percentage = None
        if user_id:
            match_percentage = _calculate_match_percentage(set(job_skills), user_skills)

        enriched_jobs.append(
            _serialize_job_post(
                job_post,
                job_skills,
                interaction=interactions_map.get(job_post.id),
                application=applications_map.get(job_post.id),
                has_application_records=has_application_records,
                match_percentage=match_percentage,
            )
        )

    return enriched_jobs


def enrich_job_post_with_skills(db: Session, job_post: JobPost, user_id: Optional[UUID] = None) -> Dict[str, Any]:
    """
    Convert a JobPost object to a response dict with batched related data.
    """
    enriched_jobs = enrich_job_posts(db, [job_post], user_id)
    return enriched_jobs[0]


def _build_scoped_job_query(
    db: Session,
    *,
    scope: str,
    user_id: Optional[UUID],
    query: Optional[str] = None,
    has_application_records: Optional[bool] = None,
):
    has_application_records = _job_applications_table_exists(db) if has_application_records is None else has_application_records
    query_obj = db.query(JobPost)

    if scope == "applications":
        if not user_id:
            raise ValueError("A user ID is required when browsing job applications")

        if has_application_records:
            query_obj = (
                db.query(JobPost)
                .join(JobApplication, JobApplication.job_post_id == JobPost.id)
                .filter(
                    JobApplication.user_id == user_id,
                    JobApplication.status != "saved",
                )
                .distinct()
            )
        else:
            query_obj = (
                db.query(JobPost)
                .join(JobUserInteraction, JobUserInteraction.job_post_id == JobPost.id)
                .filter(
                    JobUserInteraction.user_id == user_id,
                    JobUserInteraction.viewed_at.is_not(None),
                )
                .distinct()
            )
    elif scope != "all":
        raise ValueError(f"Unsupported job browse scope: {scope}")

    query_obj = query_obj.filter(_visible_job_post_expression())

    if query:
        search_pattern = f"%{query}%"
        skill_match = _skill_name_match_exists(search_pattern)
        query_obj = (
            query_obj
            .filter(
                or_(
                    JobPost.job_title.ilike(search_pattern),
                    JobPost.company_name.ilike(search_pattern),
                    JobPost.location.ilike(search_pattern),
                    _description_match_expression(search_pattern),
                    skill_match,
                )
            )
        )

    return query_obj


def _visible_job_post_expression():
    return or_(
        JobPost.employment_type.is_(None),
        func.lower(func.trim(JobPost.employment_type)) != "temporary",
    )


def _skill_name_match_exists(search_pattern: str):
    return (
        select(JobPostSkill.job_post_id)
        .join(Skill, Skill.id == JobPostSkill.skill_id)
        .where(
            JobPostSkill.job_post_id == JobPost.id,
            Skill.skill_name.ilike(search_pattern),
        )
        .exists()
    )


def _description_match_expression(search_pattern: str):
    return or_(
        JobPost.description_about_role.ilike(search_pattern),
        JobPost.description_key_responsibilities.ilike(search_pattern),
        JobPost.description_requirements.ilike(search_pattern),
        JobPost.description_nice_to_have.ilike(search_pattern),
    )


def _job_relevance_score_expression(query: str):
    cleaned_query = (query or "").strip()
    search_pattern = f"%{cleaned_query}%"
    prefix_pattern = f"{cleaned_query}%"
    normalized_query = cleaned_query.lower()
    normalized_title = func.lower(func.trim(JobPost.job_title))

    return case(
        (normalized_title == normalized_query, 100),
        (JobPost.job_title.ilike(prefix_pattern), 90),
        (JobPost.job_title.ilike(search_pattern), 80),
        (_skill_name_match_exists(search_pattern), 70),
        (JobPost.company_name.ilike(search_pattern), 50),
        (JobPost.location.ilike(search_pattern), 40),
        (_description_match_expression(search_pattern), 10),
        else_=0,
    )


def _normalize_selected_values(values: Optional[List[str]]) -> set[str]:
    normalized_values: set[str] = set()
    for value in values or []:
        cleaned = (value or "").strip()
        if cleaned:
            normalized_values.add(cleaned)
    return normalized_values


def _normalize_selected_work_types(values: Optional[List[str]]) -> set[str]:
    normalized_values: set[str] = set()
    for value in values or []:
        normalized = normalize_work_type(value)
        if normalized:
            normalized_values.add(normalized)
    return normalized_values


def _normalize_selected_employment_types(values: Optional[List[str]]) -> set[str]:
    normalized_values: set[str] = set()
    for value in values or []:
        normalized = normalize_employment_type(value)
        if normalized:
            normalized_values.add(normalized)
    return normalized_values


def _normalize_selected_career_levels(values: Optional[List[str]]) -> set[str]:
    normalized_values: set[str] = set()
    for value in values or []:
        normalized = normalize_career_level(value)
        if normalized:
            normalized_values.add(normalized)
    return normalized_values


def _should_hide_job_post(job_post: JobPost, metadata: Optional[Any] = None) -> bool:
    normalized_metadata = metadata or normalize_job_metadata(
        location=job_post.location,
        work_type=job_post.work_type,
        employment_type=job_post.employment_type,
        career_level=job_post.career_level,
    )
    return normalized_metadata.employment_type == "Temporary"


def _has_selected_metadata_filters(
    *,
    countries: Optional[List[str]] = None,
    cities: Optional[List[str]] = None,
    job_types: Optional[List[str]] = None,
    work_types: Optional[List[str]] = None,
    career_levels: Optional[List[str]] = None,
) -> bool:
    return any((
        bool(countries),
        bool(cities),
        bool(job_types),
        bool(work_types),
        bool(career_levels),
    ))


def _normalize_metadata_row(row: Any):
    return normalize_job_metadata(
        location=row.location,
        work_type=row.work_type,
        employment_type=row.employment_type,
        career_level=row.career_level,
    )


def _build_job_filter_payload_from_metadata(metadata_items: Iterable[Any]) -> Dict[str, List[Dict[str, Any]]]:
    metadata_list = list(metadata_items)
    return {
        "countries": build_filter_option_items(metadata.country for metadata in metadata_list),
        "cities": build_filter_option_items(metadata.city for metadata in metadata_list),
        "job_types": build_filter_option_items(
            (metadata.employment_type for metadata in metadata_list),
            excluded_values={"Other"},
        ),
        "work_types": build_filter_option_items(metadata.work_type for metadata in metadata_list),
        "career_levels": build_filter_option_items(metadata.career_level for metadata in metadata_list),
    }


def _load_filter_payload_for_query(query_obj) -> Dict[str, List[Dict[str, Any]]]:
    location_rows = (
        query_obj
        .order_by(None)
        .with_entities(JobPost.location.label("location"))
        .filter(JobPost.location.is_not(None))
        .distinct()
        .all()
    )
    work_type_rows = (
        query_obj
        .order_by(None)
        .with_entities(JobPost.work_type.label("work_type"))
        .filter(JobPost.work_type.is_not(None))
        .distinct()
        .all()
    )
    employment_type_rows = (
        query_obj
        .order_by(None)
        .with_entities(JobPost.employment_type.label("employment_type"))
        .filter(JobPost.employment_type.is_not(None))
        .distinct()
        .all()
    )
    career_level_rows = (
        query_obj
        .order_by(None)
        .with_entities(JobPost.career_level.label("career_level"))
        .filter(JobPost.career_level.is_not(None))
        .distinct()
        .all()
    )

    location_metadata = [
        normalize_job_metadata(
            location=row.location,
            work_type=None,
            employment_type=None,
            career_level=None,
        )
        for row in location_rows
    ]
    employment_types = [
        normalized
        for normalized in (
            normalize_employment_type(row.employment_type)
            for row in employment_type_rows
        )
        if normalized and normalized != "Temporary"
    ]

    return {
        "countries": build_filter_option_items(metadata.country for metadata in location_metadata),
        "cities": build_filter_option_items(metadata.city for metadata in location_metadata),
        "job_types": build_filter_option_items(employment_types, excluded_values={"Other"}),
        "work_types": build_filter_option_items(
            normalize_work_type(row.work_type)
            for row in work_type_rows
        ),
        "career_levels": build_filter_option_items(
            normalize_career_level(row.career_level)
            for row in career_level_rows
        ),
    }


def _count_job_query(query_obj) -> int:
    return int(query_obj.order_by(None).with_entities(func.count(JobPost.id)).scalar() or 0)


def _apply_sql_job_relevance_sort(query_obj, query: str, *, scope: str):
    relevance_score = _job_relevance_score_expression(query)
    order_by = [
        relevance_score.desc(),
        JobPost.posted_date.desc().nullslast(),
        JobPost.created_at.desc().nullslast(),
    ]
    if scope == "applications":
        order_by.append(JobUserInteraction.viewed_at.desc().nullslast())
    return query_obj.order_by(*order_by)


def _apply_sql_job_sort(
    query_obj,
    *,
    scope: str,
    sort: str,
    has_application_records: bool,
    query: Optional[str] = None,
):
    normalized_sort = (sort or "relevance").strip().lower()
    cleaned_query = (query or "").strip()

    if normalized_sort == "relevance" and cleaned_query:
        return _apply_sql_job_relevance_sort(query_obj, cleaned_query, scope=scope)

    if normalized_sort == "date":
        order_by = [
            JobPost.posted_date.desc().nullslast(),
        ]
        if scope == "applications" and has_application_records:
            order_by.append(JobApplication.applied_at.desc().nullslast())
        order_by.append(JobPost.created_at.desc().nullslast())
        return query_obj.order_by(*order_by)

    if scope == "applications" and has_application_records:
        return query_obj.order_by(
            JobApplication.applied_at.desc().nullslast(),
            JobApplication.updated_at.desc().nullslast(),
            JobPost.created_at.desc().nullslast(),
        )

    if scope == "applications":
        return query_obj.order_by(
            JobUserInteraction.viewed_at.desc().nullslast(),
            JobUserInteraction.updated_at.desc().nullslast(),
            JobPost.created_at.desc().nullslast(),
        )

    return query_obj.order_by(
        JobPost.created_at.desc().nullslast(),
        JobPost.posted_date.desc().nullslast(),
    )


def _timestamp(value: Any) -> float:
    if not value:
        return 0.0
    if isinstance(value, date) and not isinstance(value, datetime):
        return float(value.toordinal())
    if isinstance(value, datetime):
        return value.timestamp()
    return 0.0


def _row_sort_timestamp(row: Any) -> float:
    posted_timestamp = _timestamp(row.posted_date)
    if posted_timestamp:
        return posted_timestamp

    applied_timestamp = _timestamp(getattr(row, "application_applied_at", None))
    if applied_timestamp:
        return applied_timestamp

    return _timestamp(row.created_at)


def _sort_metadata_rows(
    rows: List[Any],
    *,
    scope: str,
    sort: str,
    query: Optional[str] = None,
    match_scores: Dict[UUID, float],
) -> List[Any]:
    normalized_sort = (sort or "relevance").strip().lower()
    cleaned_query = (query or "").strip()

    if normalized_sort == "match":
        return sorted(
            rows,
            key=lambda row: (
                -(match_scores.get(row.id, -1.0)),
                -_row_sort_timestamp(row),
            ),
        )

    if normalized_sort == "date":
        return sorted(rows, key=lambda row: -_row_sort_timestamp(row))

    if normalized_sort == "relevance" and cleaned_query:
        return sorted(
            rows,
            key=lambda row: (
                -(getattr(row, "relevance_score", 0) or 0),
                -_timestamp(row.posted_date),
                -_timestamp(row.created_at),
            ),
        )

    if scope == "applications":
        return sorted(
            rows,
            key=lambda row: (
                -_timestamp(getattr(row, "application_applied_at", None)),
                -_timestamp(getattr(row, "application_updated_at", None)),
                -_timestamp(row.created_at),
            ),
        )

    return sorted(
        rows,
        key=lambda row: (
            -_timestamp(row.created_at),
            -_timestamp(row.posted_date),
        ),
    )


def _load_jobs_for_ordered_ids(db: Session, job_ids: List[UUID]) -> List[JobPost]:
    if not job_ids:
        return []

    jobs = db.query(JobPost).filter(JobPost.id.in_(job_ids)).all()
    jobs_by_id = {job.id: job for job in jobs}
    return [jobs_by_id[job_id] for job_id in job_ids if job_id in jobs_by_id]


def _job_sort_timestamp(job_post: JobPost, application: Optional[JobApplication] = None) -> float:
    if job_post.posted_date:
        return float(job_post.posted_date.toordinal())

    if application and application.applied_at:
        return application.applied_at.timestamp()

    if job_post.created_at:
        return job_post.created_at.timestamp()

    return 0.0


def _sort_filtered_jobs(
    jobs: List[JobPost],
    *,
    scope: str,
    sort: str,
    application_map: Dict[UUID, JobApplication],
    match_scores: Dict[UUID, float],
) -> List[JobPost]:
    normalized_sort = (sort or "relevance").strip().lower()

    if normalized_sort == "match":
        return sorted(
            jobs,
            key=lambda job: (
                -(match_scores.get(job.id, -1.0)),
                -_job_sort_timestamp(job, application_map.get(job.id)),
            ),
        )

    if normalized_sort == "date":
        return sorted(
            jobs,
            key=lambda job: -_job_sort_timestamp(job, application_map.get(job.id)),
        )

    if scope == "applications":
        return sorted(
            jobs,
            key=lambda job: (
                -(
                    application_map[job.id].applied_at.timestamp()
                    if job.id in application_map and application_map[job.id].applied_at
                    else 0.0
                ),
                -(
                    application_map[job.id].updated_at.timestamp()
                    if job.id in application_map and application_map[job.id].updated_at
                    else 0.0
                ),
                -(job.created_at.timestamp() if job.created_at else 0.0),
            ),
        )

    return sorted(
        jobs,
        key=lambda job: (
            -(job.created_at.timestamp() if job.created_at else 0.0),
            -_job_sort_timestamp(job),
        ),
    )


def _build_job_filter_payload(
    jobs: List[JobPost],
    metadata_map: Dict[UUID, Any],
) -> Dict[str, List[Dict[str, Any]]]:
    return {
        "countries": build_filter_option_items(metadata_map[job.id].country for job in jobs),
        "cities": build_filter_option_items(metadata_map[job.id].city for job in jobs),
        "job_types": build_filter_option_items(
            (metadata_map[job.id].employment_type for job in jobs),
            excluded_values={"Other"},
        ),
        "work_types": build_filter_option_items(metadata_map[job.id].work_type for job in jobs),
        "career_levels": build_filter_option_items(metadata_map[job.id].career_level for job in jobs),
    }


def browse_job_posts(
    db: Session,
    *,
    scope: str = "all",
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[UUID] = None,
    query: Optional[str] = None,
    countries: Optional[List[str]] = None,
    cities: Optional[List[str]] = None,
    job_types: Optional[List[str]] = None,
    work_types: Optional[List[str]] = None,
    career_levels: Optional[List[str]] = None,
    sort: str = "relevance",
) -> Tuple[List[JobPost], int, Dict[str, List[Dict[str, Any]]]]:
    skip = max(skip, 0)
    limit = min(max(limit, 1), 100)
    has_application_records = False
    cleaned_query = (query or "").strip()
    normalized_sort = (sort or "relevance").strip().lower()
    has_metadata_filters = _has_selected_metadata_filters(
        countries=countries,
        cities=cities,
        job_types=job_types,
        work_types=work_types,
        career_levels=career_levels,
    )

    base_query = _build_scoped_job_query(
        db,
        scope=scope,
        user_id=user_id,
        query=cleaned_query or None,
        has_application_records=has_application_records,
    )

    if not has_metadata_filters and normalized_sort != "match":
        total_count = _count_job_query(base_query)
        paginated_jobs = (
            _apply_sql_job_sort(
                base_query,
                scope=scope,
                sort=sort,
                has_application_records=has_application_records,
                query=cleaned_query,
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
        filter_payload = _load_filter_payload_for_query(base_query)
        return paginated_jobs, total_count, filter_payload

    metadata_query = base_query.with_entities(
        JobPost.id.label("id"),
        JobPost.location.label("location"),
        JobPost.work_type.label("work_type"),
        JobPost.employment_type.label("employment_type"),
        JobPost.career_level.label("career_level"),
        JobPost.created_at.label("created_at"),
        JobPost.posted_date.label("posted_date"),
        (
            _job_relevance_score_expression(cleaned_query)
            if cleaned_query
            else null()
        ).label("relevance_score"),
        (
            JobApplication.applied_at
            if scope == "applications" and has_application_records
            else null()
        ).label("application_applied_at"),
        (
            JobApplication.updated_at
            if scope == "applications" and has_application_records
            else null()
        ).label("application_updated_at"),
    )

    candidate_rows = metadata_query.all()

    selected_countries = _normalize_selected_values(countries)
    selected_cities = _normalize_selected_values(cities)
    selected_job_types = _normalize_selected_employment_types(job_types)
    selected_work_types = _normalize_selected_work_types(work_types)
    selected_career_levels = _normalize_selected_career_levels(career_levels)

    filtered_rows: List[Any] = []
    filtered_metadata: List[Any] = []
    for row in candidate_rows:
        metadata = _normalize_metadata_row(row)

        if metadata.employment_type == "Temporary":
            continue
        if selected_countries and metadata.country not in selected_countries:
            continue
        if selected_cities and metadata.city not in selected_cities:
            continue
        if selected_job_types and metadata.employment_type not in selected_job_types:
            continue
        if selected_work_types and metadata.work_type not in selected_work_types:
            continue
        if selected_career_levels and metadata.career_level not in selected_career_levels:
            continue

        filtered_rows.append(row)
        filtered_metadata.append(metadata)

    match_scores: Dict[UUID, float] = {}

    if user_id and normalized_sort == "match":
        filtered_job_ids = [row.id for row in filtered_rows]
        job_skills_map = _load_job_skills_map(db, filtered_job_ids)
        user_skills = set(get_user_skills(db, user_id))
        match_scores = {
            job_id: _calculate_match_percentage(set(job_skills_map.get(job_id, [])), user_skills)
            for job_id in filtered_job_ids
        }

    sorted_rows = _sort_metadata_rows(
        filtered_rows,
        scope=scope,
        sort=sort,
        query=cleaned_query,
        match_scores=match_scores,
    )

    total_count = len(sorted_rows)
    paginated_job_ids = [row.id for row in sorted_rows[skip: skip + limit]]
    paginated_jobs = _load_jobs_for_ordered_ids(db, paginated_job_ids)
    filter_payload = _build_job_filter_payload_from_metadata(filtered_metadata)

    return paginated_jobs, total_count, filter_payload


def parse_linkedin_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    for date_format in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(cleaned, date_format).date()
        except ValueError:
            continue
    return None


def parseLinkedInDate(value: Optional[str]) -> Optional[date]:
    return parse_linkedin_date(value)


def infer_work_type(job_data: dict) -> Optional[str]:
    return normalize_work_type(job_data.get("work_type"))


def normalize_job_data(job_data: dict) -> dict:
    job_title = (job_data.get("job_title") or job_data.get("title") or "").strip()
    company_name = (job_data.get("company_name") or job_data.get("company") or "").strip() or None
    job_url = (job_data.get("job_url") or job_data.get("link") or "").strip()

    skills_raw = job_data.get("skills") or []
    if not isinstance(skills_raw, list):
        skills_raw = []

    normalized_skills = sorted({
        normalized for normalized in (normalize_skill_name(skill) for skill in skills_raw) if normalized
    })

    posted_date_raw = (
        job_data.get("posted_date")
        or job_data.get("date")
        or job_data.get("postedAt")
    )

    description_about_role = clean_text(
        job_data.get("description_about_role") or job_data.get("about_role")
    )
    description_key_responsibilities = clean_text(
        job_data.get("description_key_responsibilities") or job_data.get("key_responsibilities")
    )
    description_requirements = clean_text(
        job_data.get("description_requirements") or job_data.get("requirements")
    )
    description_nice_to_have = clean_text(
        job_data.get("description_nice_to_have") or job_data.get("nice_to_have")
    )

    return {
        "job_title": job_title,
        "company_name": company_name,
        "job_url": job_url,
        "source": (job_data.get("source") or "").strip() or None,
        "location": (job_data.get("location") or "").strip() or None,
        "posted_date": parse_linkedin_date(posted_date_raw),
        "salary": (job_data.get("salary") or "").strip() or None,
        "description_about_role": description_about_role,
        "description_key_responsibilities": description_key_responsibilities,
        "description_requirements": description_requirements,
        "description_nice_to_have": description_nice_to_have,
        "career_level": (job_data.get("career_level") or job_data.get("experience_level") or "").strip() or None,
        "work_type": infer_work_type(job_data),
        "employment_type": (job_data.get("employment_type") or job_data.get("job_type") or "").strip() or None,
        "skills": normalized_skills,
    }


def insert_job(db: Session, job_data: dict, *, commit: bool = True) -> Tuple[Optional[JobPost], bool, Optional[str], Dict[str, Any]]:
    if not isinstance(job_data, dict):
        return None, False, "Job item must be a JSON object", {
            "job_url": None,
            "created": False,
            "skills_created": 0,
            "skills_linked": 0,
            "status": "skipped",
        }

    normalized = normalize_job_data(job_data)
    job_url = normalized["job_url"]
    if not normalized["job_title"] or not job_url:
        return None, False, "Missing required fields: job_title/job_url", {
            "job_url": job_url,
            "created": False,
            "skills_created": 0,
            "skills_linked": 0,
            "status": "skipped",
        }

    if db.query(JobPost.id).filter(JobPost.job_url == job_url).first():
        return None, False, "Duplicate job_url", {
            "job_url": job_url,
            "created": False,
            "skills_created": 0,
            "skills_linked": 0,
            "status": "skipped",
        }

    try:
        if commit:
            with db.begin():
                job_post = JobPost(
                    job_title=normalized["job_title"],
                    company_name=normalized["company_name"],
                    job_url=job_url,
                    source=normalized["source"],
                    location=normalized["location"],
                    posted_date=normalized["posted_date"],
                    salary=normalized["salary"],
                    description_about_role=normalized["description_about_role"],
                    description_key_responsibilities=normalized["description_key_responsibilities"],
                    description_requirements=normalized["description_requirements"],
                    description_nice_to_have=normalized["description_nice_to_have"],
                    career_level=normalized["career_level"],
                    work_type=normalized["work_type"],
                    employment_type=normalized["employment_type"],
                )
                db.add(job_post)
                db.flush()
                skill_stats = normalize_and_attach_skills(db, job_post.id, normalized["skills"])
        else:
            job_post = JobPost(
                job_title=normalized["job_title"],
                company_name=normalized["company_name"],
                job_url=job_url,
                source=normalized["source"],
                location=normalized["location"],
                posted_date=normalized["posted_date"],
                salary=normalized["salary"],
                description_about_role=normalized["description_about_role"],
                description_key_responsibilities=normalized["description_key_responsibilities"],
                description_requirements=normalized["description_requirements"],
                description_nice_to_have=normalized["description_nice_to_have"],
                career_level=normalized["career_level"],
                work_type=normalized["work_type"],
                employment_type=normalized["employment_type"],
            )
            db.add(job_post)
            db.flush()
            skill_stats = normalize_and_attach_skills(db, job_post.id, normalized["skills"])

        if commit:
            db.refresh(job_post)

        insert_result = {
            "job_url": job_url,
            "created": True,
            "skills_created": skill_stats["skills_created"],
            "skills_linked": skill_stats["skills_linked"],
            "status": "created",
        }
        logger.info(
            "Job inserted: job_url=%s skills_created=%s skills_linked=%s",
            job_url,
            skill_stats["skills_created"],
            skill_stats["skills_linked"],
        )
        return job_post, True, None, insert_result
    except IntegrityError as exc:
        if commit:
            db.rollback()
        return None, False, f"Integrity error while inserting job: {str(exc.orig) if exc.orig else str(exc)}", {
            "job_url": job_url,
            "created": False,
            "skills_created": 0,
            "skills_linked": 0,
            "status": "skipped",
        }


def insertJob(db: Session, job_data: dict, *, commit: bool = True) -> Tuple[Optional[JobPost], bool, Optional[str], Dict[str, Any]]:
    return insert_job(db, job_data, commit=commit)


def bulk_insert_jobs(db: Session, jobs_data: List[dict]) -> Tuple[List[JobPost], int, int, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Bulk insert jobs while skipping duplicates by job_url.
    Uses one transaction for the whole batch and savepoints per item.
    """
    created_jobs: List[JobPost] = []
    updated_count = 0
    skipped_count = 0
    skipped_items: List[Dict[str, Any]] = []
    results: List[Dict[str, Any]] = []

    try:
        for index, job_data in enumerate(jobs_data):
            try:
                with db.begin_nested():
                    job, inserted, reason, job_result = insert_job(db, job_data, commit=False)
                    if inserted and job:
                        created_jobs.append(job)
                        results.append(job_result)
                    else:
                        skipped_count += 1
                        results.append(job_result)
                        skipped_items.append(
                            {
                                "index": index,
                                "title": (job_data.get("job_title") if isinstance(job_data, dict) else None),
                                "reason": reason or "Skipped",
                            }
                        )
            except Exception as exc:
                skipped_count += 1
                results.append(
                    {
                        "job_url": (job_data.get("job_url") if isinstance(job_data, dict) else None),
                        "created": False,
                        "skills_created": 0,
                        "skills_linked": 0,
                        "status": "skipped",
                    }
                )
                skipped_items.append(
                    {
                        "index": index,
                        "title": (job_data.get("job_title") if isinstance(job_data, dict) else None),
                        "reason": f"Unexpected error while processing job: {str(exc)}",
                    }
                )

        db.commit()
        for job in created_jobs:
            db.refresh(job)
    except Exception:
        db.rollback()
        raise

    return created_jobs, updated_count, skipped_count, skipped_items, results


def fetch_jobs_paginated(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[UUID] = None,
    query: Optional[str] = None,
    countries: Optional[List[str]] = None,
    cities: Optional[List[str]] = None,
    job_types: Optional[List[str]] = None,
    work_types: Optional[List[str]] = None,
    career_levels: Optional[List[str]] = None,
    sort: str = "relevance",
) -> Tuple[List[JobPost], int, Dict[str, List[Dict[str, Any]]]]:
    return browse_job_posts(
        db,
        scope="all",
        skip=skip,
        limit=limit,
        user_id=user_id,
        query=query,
        countries=countries,
        cities=cities,
        job_types=job_types,
        work_types=work_types,
        career_levels=career_levels,
        sort=sort,
    )


def fetch_job_post_by_id(db: Session, job_id: UUID) -> Optional[JobPost]:
    job_post = db.query(JobPost).filter(JobPost.id == job_id).first()
    if not job_post or _should_hide_job_post(job_post):
        return None
    return job_post


def search_jobs(
    db: Session,
    query: str,
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[UUID] = None,
    countries: Optional[List[str]] = None,
    cities: Optional[List[str]] = None,
    job_types: Optional[List[str]] = None,
    work_types: Optional[List[str]] = None,
    career_levels: Optional[List[str]] = None,
    sort: str = "relevance",
) -> Tuple[List[JobPost], int, Dict[str, List[Dict[str, Any]]]]:
    return browse_job_posts(
        db,
        scope="all",
        skip=skip,
        limit=limit,
        user_id=user_id,
        query=query,
        countries=countries,
        cities=cities,
        job_types=job_types,
        work_types=work_types,
        career_levels=career_levels,
        sort=sort,
    )


def _validate_user_and_job(db: Session, user_id: UUID, job_post_id: UUID) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User with ID {user_id} not found")

    job_post = db.query(JobPost).filter(JobPost.id == job_post_id).first()
    if not job_post:
        raise ValueError(f"Job post with ID {job_post_id} not found")


def mark_job_as_recently_viewed(db: Session, user_id: UUID, job_post_id: UUID) -> JobUserInteraction:
    _validate_user_and_job(db, user_id, job_post_id)
    now = datetime.now(UTC)

    interaction = (
        db.query(JobUserInteraction)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.job_post_id == job_post_id,
        )
        .order_by(JobUserInteraction.created_at.desc())
        .first()
    )

    try:
        if interaction:
            interaction.viewed_at = now
            interaction.view_count = (interaction.view_count or 0) + 1
            interaction.last_interaction_at = now
            interaction.updated_at = now
        else:
            interaction = JobUserInteraction(
                user_id=user_id,
                job_post_id=job_post_id,
                viewed_at=now,
                view_count=1,
                last_interaction_at=now,
                updated_at=now,
            )
            db.add(interaction)

        db.commit()
        db.refresh(interaction)
    except IntegrityError:
        db.rollback()
        raise ValueError("Invalid job or user reference for interaction")

    return interaction


def set_job_saved_state(db: Session, user_id: UUID, job_post_id: UUID, is_saved: bool) -> JobUserInteraction:
    _validate_user_and_job(db, user_id, job_post_id)
    now = datetime.now(UTC)

    interaction = (
        db.query(JobUserInteraction)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.job_post_id == job_post_id,
        )
        .order_by(JobUserInteraction.created_at.desc())
        .first()
    )

    try:
        if interaction:
            interaction.is_saved = is_saved
            interaction.saved_at = now if is_saved else None
            interaction.last_interaction_at = now
            interaction.updated_at = now
        else:
            interaction = JobUserInteraction(
                user_id=user_id,
                job_post_id=job_post_id,
                is_saved=is_saved,
                saved_at=now if is_saved else None,
                last_interaction_at=now,
                updated_at=now,
            )
            db.add(interaction)

        db.commit()
        db.refresh(interaction)
    except IntegrityError:
        db.rollback()
        raise ValueError("Invalid job or user reference for interaction")

    return interaction


def upsert_job_application(
    db: Session,
    user_id: UUID,
    job_post_id: UUID,
    status: str,
) -> Dict[str, Any]:
    _validate_user_and_job(db, user_id, job_post_id)

    normalized_status = (status or "").strip().lower()
    if normalized_status not in {"applied", "interview", "offer", "rejected", "saved"}:
        raise ValueError(f"Invalid application status: {status}")

    now = datetime.now(UTC)
    has_application_records = _job_applications_table_exists(db)
    application = None
    if has_application_records:
        application = (
            db.query(JobApplication)
            .filter(
                JobApplication.user_id == user_id,
                JobApplication.job_post_id == job_post_id,
            )
            .order_by(
                JobApplication.updated_at.desc(),
                JobApplication.applied_at.desc().nullslast(),
            )
            .first()
        )

    interaction = (
        db.query(JobUserInteraction)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.job_post_id == job_post_id,
        )
        .order_by(JobUserInteraction.updated_at.desc(), JobUserInteraction.created_at.desc())
        .first()
    )

    if interaction:
        if normalized_status != "saved":
            interaction.viewed_at = now
            interaction.view_count = (interaction.view_count or 0) + 1
        interaction.last_interaction_at = now
        interaction.updated_at = now
    else:
        interaction = JobUserInteraction(
            user_id=user_id,
            job_post_id=job_post_id,
            viewed_at=now if normalized_status != "saved" else None,
            view_count=1 if normalized_status != "saved" else 0,
            last_interaction_at=now,
            updated_at=now,
        )
        db.add(interaction)

    if not has_application_records:
        db.commit()
        db.refresh(interaction)
        return {
            "id": interaction.id,
            "job_post_id": interaction.job_post_id,
            "user_id": interaction.user_id,
            "status": normalized_status,
            "applied_at": now if normalized_status != "saved" else None,
            "updated_at": interaction.updated_at,
        }

    if application:
        application.status = normalized_status
        if normalized_status != "saved" and application.applied_at is None:
            application.applied_at = now
    else:
        application = JobApplication(
            user_id=user_id,
            job_post_id=job_post_id,
            status=normalized_status,
            applied_at=None if normalized_status == "saved" else now,
        )
        db.add(application)

    db.commit()
    db.refresh(application)
    return {
        "id": application.id,
        "job_post_id": application.job_post_id,
        "user_id": application.user_id,
        "status": normalized_status,
        "applied_at": application.applied_at,
        "updated_at": application.updated_at,
    }


def _validate_user_exists(db: Session, user_id: UUID) -> None:
    user_exists = db.query(User.id).filter(User.id == user_id).first()
    if not user_exists:
        raise ValueError(f"User with ID {user_id} not found")


def _load_jobs_by_ordered_ids(
    db: Session,
    job_ids: List[UUID],
    skip: int,
    limit: int,
) -> Tuple[List[JobPost], int]:
    if not job_ids:
        return [], 0

    jobs = db.query(JobPost).filter(JobPost.id.in_(job_ids)).all()
    jobs_by_id = {
        job.id: job
        for job in jobs
        if not _should_hide_job_post(job)
    }
    visible_job_ids = [job_id for job_id in job_ids if job_id in jobs_by_id]
    total_count = len(visible_job_ids)
    paginated_job_ids = visible_job_ids[skip: skip + limit]
    if not paginated_job_ids:
        return [], total_count

    ordered_jobs = [jobs_by_id[job_id] for job_id in paginated_job_ids if job_id in jobs_by_id]
    return ordered_jobs, total_count


def _ordered_unique_job_ids_from_interactions(
    interactions: List[JobUserInteraction],
) -> List[UUID]:
    job_ids: List[UUID] = []
    seen: set[UUID] = set()
    for interaction in interactions:
        if interaction.job_post_id in seen:
            continue
        seen.add(interaction.job_post_id)
        job_ids.append(interaction.job_post_id)
    return job_ids


def _ordered_unique_job_ids_from_applications(
    applications: List[JobApplication],
) -> List[UUID]:
    job_ids: List[UUID] = []
    seen: set[UUID] = set()
    for application in applications:
        if application.job_post_id in seen:
            continue
        seen.add(application.job_post_id)
        job_ids.append(application.job_post_id)
    return job_ids


def fetch_user_saved_jobs(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[JobPost], int]:
    skip = max(skip, 0)
    limit = min(max(limit, 1), 100)
    _validate_user_exists(db, user_id)

    query_obj = (
        db.query(JobPost)
        .join(JobUserInteraction, JobUserInteraction.job_post_id == JobPost.id)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.is_saved.is_(True),
            _visible_job_post_expression(),
        )
    )
    total_count = _count_job_query(query_obj)
    jobs = (
        query_obj
        .order_by(
            JobUserInteraction.saved_at.desc().nullslast(),
            JobUserInteraction.updated_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return jobs, total_count


def fetch_user_recently_viewed_jobs(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[JobPost], int]:
    skip = max(skip, 0)
    limit = min(max(limit, 1), 100)
    _validate_user_exists(db, user_id)

    query_obj = (
        db.query(JobPost)
        .join(JobUserInteraction, JobUserInteraction.job_post_id == JobPost.id)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.viewed_at.is_not(None),
            _visible_job_post_expression(),
        )
    )
    total_count = _count_job_query(query_obj)
    jobs = (
        query_obj
        .order_by(
            JobUserInteraction.viewed_at.desc().nullslast(),
            JobUserInteraction.updated_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return jobs, total_count


def fetch_user_applied_jobs(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[JobPost], int]:
    skip = max(skip, 0)
    limit = min(max(limit, 1), 100)
    _validate_user_exists(db, user_id)

    query_obj = (
        db.query(JobPost)
        .join(JobUserInteraction, JobUserInteraction.job_post_id == JobPost.id)
        .filter(
            JobUserInteraction.user_id == user_id,
            JobUserInteraction.viewed_at.is_not(None),
            _visible_job_post_expression(),
        )
    )
    total_count = _count_job_query(query_obj)
    jobs = (
        query_obj
        .order_by(
            JobUserInteraction.viewed_at.desc().nullslast(),
            JobUserInteraction.updated_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return jobs, total_count

