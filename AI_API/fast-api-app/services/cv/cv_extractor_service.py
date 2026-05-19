import os
import json
from uuid import UUID
import tempfile
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from services.skills.skill_service import save_mapped_skills_to_db, reset_user_cv_skills

from db.models import (
    User,
    Experience,
    Education,
    Certification,
    Project,
    Language,
    Award,
    Reference,
    UserSkill
)


from utils.util import (
    extract_text,
    parse_and_enhance_cv,
    safe_list,
    clean_str,
    ensure_list,
)

# =========================
# Upload CV to DB
# =========================

def upload_cv_to_db(db: Session, user_id: UUID, cv_data: dict):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # =========================
    # Update User Fields
    # =========================
    #user.full_name = clean_str(cv_data.get("full_name"))
    user.professional_title = clean_str(cv_data.get("professional_title"))
    #user.email = clean_str(cv_data.get("contact", {}).get("email"))
    #user.phone = clean_str(cv_data.get("contact", {}).get("phone"))
    #user.city = clean_str(cv_data.get("contact", {}).get("city"))
    #user.country = clean_str(cv_data.get("contact", {}).get("country"))
    user.linkedin = clean_str(cv_data.get("contact", {}).get("linkedin"))
    user.github = clean_str(cv_data.get("contact", {}).get("github"))
    user.portfolio = clean_str(cv_data.get("contact", {}).get("portfolio"))
    user.summary = clean_str(cv_data.get("summary"))

    # =========================
    # Clear Existing Relations
    # =========================
    user.experiences.clear()
    user.education.clear()
    user.certifications.clear()
    user.projects.clear()
    user.languages.clear()
    user.awards.clear()
    user.references.clear()
    reset_user_cv_skills(db, user.id)

    db.flush()

    # =========================
    # Experiences
    # =========================
    for exp in safe_list(cv_data, "experiences"):
        db.add(Experience(
            user_id=user.id,
            role=clean_str(exp.get("role")),
            organization=clean_str(exp.get("organization")),
            period=clean_str(exp.get("period")),
            responsibilities=ensure_list(exp.get("responsibilities")),
            achievements=clean_str(exp.get("achievements")),
        ))

    # =========================
    # Education
    # =========================
    for edu in safe_list(cv_data, "education"):
        db.add(Education(
            user_id=user.id,
            qualification=clean_str(edu.get("qualification")),
            institution=clean_str(edu.get("institution")),
            period=clean_str(edu.get("period")),
            details=clean_str(edu.get("details")),
        ))

    # =========================
    # Certifications
    # =========================
    for cert in safe_list(cv_data, "certifications"):
        db.add(Certification(
            user_id=user.id,
            title=clean_str(cert.get("title")),
            organization=clean_str(cert.get("organization")),
            period=clean_str(cert.get("period")),
        ))

    # =========================
    # Projects
    # =========================
    for proj in safe_list(cv_data, "projects"):
        db.add(Project(
            user_id=user.id,
            title=clean_str(proj.get("title")),
            description=clean_str(proj.get("description")),
            role=clean_str(proj.get("role")),
            technologies=ensure_list(proj.get("technologies")),
            achievements=clean_str(proj.get("achievements")),
        ))

    # =========================
    # Languages
    # =========================
    for lang in safe_list(cv_data, "languages"):
        db.add(Language(
            user_id=user.id,
            language=clean_str(lang.get("language")),
            proficiency=clean_str(lang.get("proficiency")),
        ))

    # =========================
    # Awards
    # =========================
    for award in safe_list(cv_data, "awards"):
        db.add(Award(
            user_id=user.id,
            title=clean_str(award.get("title")),
            organization=clean_str(award.get("organization")),
            date=clean_str(award.get("date")),
            description=clean_str(award.get("description")),
        ))

    # =========================
    # References
    # =========================
    for ref in safe_list(cv_data, "references"):
        db.add(Reference(
            user_id=user.id,
            name=clean_str(ref.get("name")),
            role=clean_str(ref.get("role")),
            organization=clean_str(ref.get("organization")),
            contact_info=clean_str(ref.get("contact_info")),
        ))

    return user


# =========================
# Handle Upload Endpoint
# =========================

async def handle_cv(
    file: UploadFile,
    user_id: UUID,
    db: Session,
    type: str,
):
    suffix = os.path.splitext(file.filename)[1].lower()

    if suffix not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported."
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        file_path = tmp.name

    try:
        cv_text = extract_text(file_path)

        if not cv_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Text extraction failed."
            )

        cv_data = parse_and_enhance_cv(cv_text, type=type)

        if isinstance(cv_data, str):
            cv_data = json.loads(cv_data)

        raw_skills = safe_list(cv_data, "skills")

        skills = []

        for item in raw_skills:
            if isinstance(item, str):
                skills.append(item)
            elif isinstance(item, dict):
                # adjust key depending on your structure
                skills.append(item.get("skill_name"))

        # Save data
        upload_cv_to_db(db, user_id, cv_data)

        # Save mapped skills
        save_mapped_skills_to_db(db, user_id, skills)

        db.commit()

        return {"message": "CV uploaded and processed successfully"}

    except Exception:
        db.rollback()
        raise

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)



async def handle_cv_for_builder(
    cv_text: str,
    user_id: UUID,
    db: Session,
    type: str,
):
    cv_data = parse_and_enhance_cv(cv_text, type=type)

    if isinstance(cv_data, str):
        cv_data = json.loads(cv_data)

    raw_skills = safe_list(cv_data, "skills")

    skills = []

    for item in raw_skills:
        if isinstance(item, str):
            skills.append(item)
        elif isinstance(item, dict):
            # adjust key depending on your structure
            skills.append(item.get("skill_name"))

    # Save data
    upload_cv_to_db(db, user_id, cv_data)

    # Save mapped skills
    save_mapped_skills_to_db(db, user_id, skills)

    db.commit()

    return {"message": "CV extracted and processed successfully"}