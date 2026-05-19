import datetime
import uuid
from sqlalchemy import (
    TIMESTAMP,
    Column,
    Date,
    Enum,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    JSON,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
    Float,
    Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, BYTEA, JSONB, UUID
from sqlalchemy.sql import func

from db.base import Base

from enum import Enum as enum


# =========================
# USER
# =========================
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    professional_title = Column(String)
    email = Column(String)
    phone = Column(String)
    city = Column(String)
    country = Column(String)
    linkedin = Column(String)
    github = Column(String)
    portfolio = Column(String)
    summary = Column(Text)
    username = Column(String)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    experiences = relationship("Experience", back_populates="user", cascade="all, delete-orphan")
    education = relationship("Education", back_populates="user", cascade="all, delete-orphan")
    certifications = relationship("Certification", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    languages = relationship("Language", back_populates="user", cascade="all, delete-orphan")
    awards = relationship("Award", back_populates="user", cascade="all, delete-orphan")
    references = relationship("Reference", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user",cascade="all, delete-orphan")
    assessment = relationship("RoadmapAssessmentResult", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("UserRoadmapBookmark", back_populates="user", cascade="all, delete-orphan")
    career_sessions = relationship("CareerSession", back_populates="user", cascade="all, delete-orphan")


# ###########################################################################################################################
# INTERVIEW
# ###########################################################################################################################

# =========================
# QUESTION
# =========================
class Question(Base):
    __tablename__ = "interview_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False)
    question_text = Column(String, nullable=False)
    question_audio = Column(String, nullable=True)

    answers = relationship("Answer", back_populates="question")


# =========================
# SESSION
# =========================
class Session(Base):
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    user = relationship("User", back_populates="sessions")
    answers = relationship("Answer", back_populates="session", cascade="all, delete-orphan")


# =========================
# ANSWER
# =========================
class Answer(Base):
    __tablename__ = "interview_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    answer_text = Column(String, nullable=True)
    answer_audio = Column(String, nullable=True)
    answer_video = Column(String, nullable=True)

    feedback = Column(String, nullable=True)
    grade = Column(String, nullable=True)
    isfollowup = Column(Boolean, default=False)

    emotion_evaluation = Column(JSON, nullable=True)
    tone_evaluation = Column(JSON, nullable=True)
    sentiment_evaluation = Column(JSON, nullable=True)

    question_id = Column(UUID(as_uuid=True), ForeignKey("interview_questions.id"), nullable=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False)

    question = relationship("Question", back_populates="answers")
    session = relationship("Session", back_populates="answers")

    followup = relationship(
        "Followup",
        back_populates="answer",
        uselist=False,
        cascade="all, delete-orphan"
    )


# =========================
# FOLLOWUP
# =========================
class Followup(Base):
    __tablename__ = "interview_followups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fquestion_text = Column(String, nullable=False)
    fquestion_audio = Column(String, nullable=True)

    answer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_answers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    answer = relationship("Answer", back_populates="followup")



# ###########################################################################################################################
# CV
# ###########################################################################################################################

# =========================
# SKILL
# =========================
class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name = Column(String, nullable=False, unique=True)
    
    user_skills = relationship("UserSkill", back_populates="skill")
    job_post_skills = relationship("JobPostSkill", back_populates="skill")

# =========================
# USER SKILLS
# =========================
class UserSkill(Base):
    __tablename__ = "user_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)

    isCV = Column(Boolean, nullable=False, default=False)
    proficiency = Column(String)
    score = Column(Integer, nullable=True)

    user = relationship("User", back_populates="skills")
    skill = relationship("Skill", back_populates="user_skills")

    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skill"),
    )


# =========================
# EXPERIENCE
# =========================
class Experience(Base):
    __tablename__ = "user_experiences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    organization = Column(String)
    period = Column(String)
    responsibilities = Column(JSON, nullable=True)
    achievements = Column(Text)

    user = relationship("User", back_populates="experiences")


# =========================
# EDUCATION
# =========================
class Education(Base):
    __tablename__ = "user_education"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    qualification = Column(String)
    institution = Column(String)
    period = Column(String)
    details = Column(Text)

    user = relationship("User", back_populates="education")


# =========================
# CERTIFICATION
# =========================
class Certification(Base):
    __tablename__ = "user_certifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String)
    organization = Column(String)
    period = Column(String)

    user = relationship("User", back_populates="certifications")


# =========================
# PROJECT
# =========================
class Project(Base):
    __tablename__ = "user_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String)
    description = Column(Text)
    role = Column(String)
    technologies = Column(ARRAY(String))
    achievements = Column(Text)

    user = relationship("User", back_populates="projects")


# =========================
# LANGUAGE
# =========================
class Language(Base):
    __tablename__ = "user_languages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    language = Column(String)
    proficiency = Column(String)

    user = relationship("User", back_populates="languages")


# =========================
# AWARD
# =========================
class Award(Base):
    __tablename__ = "user_awards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String)
    organization = Column(String)
    date = Column(String)
    description = Column(Text)

    user = relationship("User", back_populates="awards")


# =========================
# REFERENCE
# =========================
class Reference(Base):
    __tablename__ = "user_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String)
    role = Column(String)
    organization = Column(String)
    contact_info = Column(String)

    user = relationship("User", back_populates="references")


# ###########################################################################################################################
# SKILL_ASSESSMENT
# ###########################################################################################################################

# =========================
# SKILL ASSESSMENT SESSION
# =========================
class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    # Keep optional because section/step/roadmap assessments don't always have a direct skill FK.
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=True)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id"), nullable=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_sections.id"), nullable=True)
    step_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_steps.id"), nullable=True)

    total_questions = Column(Integer, nullable=False)
    score = Column(Integer, default=0)
    status = Column(String, default="in_progress")  # in_progress, submitted
    type = Column(String, nullable=False)  # skill, roadmap, section, step

    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    assessment_questions = relationship(
        "AssessmentQuestion", back_populates="session", cascade="all, delete"
    )
    assessment_answers = relationship(
        "AssessmentAnswer", back_populates="session", cascade="all, delete"
    )

    # Optional relationships to roadmap entities (read-only)
    roadmap = relationship("Roadmap", foreign_keys=[roadmap_id])
    section = relationship("RoadmapSection", foreign_keys=[section_id])
    step = relationship("RoadmapStep", foreign_keys=[step_id])


# =========================
# SKILL ASSESSMENT QUESTION
# =========================
class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("assessment_sessions.id"), nullable=False)

    question_text = Column(Text, nullable=False)
    options = Column(JSONB, nullable=False)
    correct_answer = Column(String, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("AssessmentSession", back_populates="assessment_questions")
    assessment_answers = relationship("AssessmentAnswer", back_populates="question")


# =========================
# SKILL ASSESSMENT ANSWER
# =========================
class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("assessment_sessions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("assessment_questions.id"), nullable=False)

    selected_answer = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("AssessmentSession", back_populates="assessment_answers")
    question = relationship("AssessmentQuestion", back_populates="assessment_answers")


# =========================
# Reports
# =========================
class ReportTypeEnum(str, enum):
    CV = "cv"
    INTERVIEW_SESSION = "interview_session"
    SKILL_ASSESSMENT = "skill_assessment"
    OTHER = "other"


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(ReportTypeEnum), nullable=False)
    filename = Column(String, nullable=False)
    file_data = Column(BYTEA, nullable=False)  
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    user = relationship("User", back_populates="reports")  


# ###########################################################################################################################
# ROADMAP
# ###########################################################################################################################

# =========================
# ROADMAP
# =========================
class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)

    section = relationship("RoadmapSection", back_populates="roadmap", cascade="all, delete-orphan")
    assessment = relationship("RoadmapAssessmentResult", back_populates="roadmap")
    bookmarks = relationship("UserRoadmapBookmark", back_populates="roadmap", cascade="all, delete-orphan")


# =========================
# ROADMAP BOOKMARK
# =========================
class UserRoadmapBookmark(Base):
    __tablename__ = "user_roadmap_bookmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="bookmarks")
    roadmap = relationship("Roadmap", back_populates="bookmarks")

    __table_args__ = (
        UniqueConstraint("user_id", "roadmap_id", name="uq_user_roadmap_bookmarks_user_roadmap"),
        Index("ix_user_roadmap_bookmarks_user_id", "user_id"),
        Index("ix_user_roadmap_bookmarks_roadmap_id", "roadmap_id"),
    )


# =========================
# ROADMAP SECTION
# =========================
class RoadmapSection(Base):
    __tablename__ = "roadmap_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order = Column(Integer, nullable=False)

    roadmap = relationship("Roadmap", back_populates="section")
    steps = relationship("RoadmapStep", back_populates="section", cascade="all, delete-orphan")
    courses = relationship("RoadmapCourse", back_populates="section", cascade="all, delete-orphan")
    assessment = relationship("RoadmapAssessmentResult", back_populates="section")

    __table_args__ = (
        UniqueConstraint("roadmap_id", "order", name="uq_roadmap_sections_roadmap_order"),
    )


# =========================
# ROADMAP STEP
# =========================
class RoadmapStep(Base):
    __tablename__ = "roadmap_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_sections.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    resources = Column(JSONB, nullable=True)
    order = Column(Integer, nullable=False)

    section = relationship("RoadmapSection", back_populates="steps")
    assessment = relationship("RoadmapAssessmentResult", back_populates="step")

    __table_args__ = (
        UniqueConstraint("section_id", "order", name="uq_roadmap_steps_section_order"),
    )


# =========================
# ROADMAP COURSE
# =========================
class RoadmapCourse(Base):
    __tablename__ = "roadmap_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("roadmap_sections.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider = Column(String, nullable=False)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    normalized_url = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    language = Column(String, nullable=True)
    is_free = Column(Boolean, nullable=True)
    rating = Column(Float, nullable=True)
    provider_course_id = Column(String, nullable=True)
    rank_in_provider = Column(Integer, nullable=True)
    source_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    section = relationship("RoadmapSection", back_populates="courses")

    __table_args__ = (
        UniqueConstraint("section_id", "normalized_url", name="uq_roadmap_courses_section_normalized_url"),
        Index("ix_roadmap_courses_section_id", "section_id"),
        Index("ix_roadmap_courses_provider", "provider"),
    )


# =========================
# ROADMAP ASSESSMENT RESULT
# =========================
class RoadmapAssessmentResult(Base):
    __tablename__ = "roadmap_assessment_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id"), nullable=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_sections.id"), nullable=True)
    step_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_steps.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    type = Column(String, nullable=False)
    proficiency = Column(String, nullable=True)
    score = Column(Integer, nullable=True)
    completion_status = Column(String, nullable=False, default="not_started")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    roadmap = relationship("Roadmap", back_populates="assessment")
    section = relationship("RoadmapSection", back_populates="assessment")
    step = relationship("RoadmapStep", back_populates="assessment")
    user = relationship("User", back_populates="assessment")

    __table_args__ = (
        Index(
            "uq_roadmap_assessment_results_target",
            "user_id",
            "type",
            "roadmap_id",
            "section_id",
            "step_id",
            unique=True,
        ),
    )


# ###########################################################################################################################
# CAREER QUIZ
# ###########################################################################################################################

# =========================
# CAREER SESSION
# =========================
class CareerSession(Base):
    __tablename__ = "career_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String, default="in_progress")  # in_progress, submitted
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="career_sessions")
    selected_cards = relationship("CareerSelectedCard", back_populates="session", cascade="all, delete-orphan")
    track_results = relationship("CareerTrackResult", back_populates="session", cascade="all, delete-orphan")
    answers = relationship("CareerAnswer", back_populates="session", cascade="all, delete-orphan")


# =========================
# CAREER TRACKS
# =========================
class CareerTrack(Base):
    __tablename__ = "career_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)

    track_results = relationship("CareerTrackResult", back_populates="track", cascade="all, delete-orphan")


# =========================
# CAREER HOBBY
# =========================
class CareerHobby(Base):
    __tablename__ = "career_hobbies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)

    questions = relationship("CareerQuestion", back_populates="hobby", cascade="all, delete-orphan")
    selected_cards = relationship("CareerSelectedCard", back_populates="hobby", cascade="all, delete-orphan")


# =========================
# CAREER TECHNICAL SKILL
# =========================
class CareerTechnicalSkill(Base):
    __tablename__ = "career_technical_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)

    questions = relationship("CareerQuestion", back_populates="technical_skill", cascade="all, delete-orphan")
    selected_cards = relationship("CareerSelectedCard", back_populates="technical_skill", cascade="all, delete-orphan")


# =========================
# CAREER SELECTED CARD
# =========================
class CareerSelectedCard(Base):
    __tablename__ = "career_selected_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("career_sessions.id"), nullable=False)
    card_type = Column(String, nullable=False)  # hobby, technical
    hobby_id = Column(UUID(as_uuid=True), ForeignKey("career_hobbies.id"), nullable=True)
    technical_skill_id = Column(UUID(as_uuid=True), ForeignKey("career_technical_skills.id"), nullable=True)

    session = relationship("CareerSession", back_populates="selected_cards")
    hobby = relationship("CareerHobby", back_populates="selected_cards")
    technical_skill = relationship("CareerTechnicalSkill", back_populates="selected_cards")


# =========================
# CAREER QUESTION
# =========================
class CareerQuestion(Base):
    __tablename__ = "career_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hobby_id = Column(UUID(as_uuid=True), ForeignKey("career_hobbies.id"), nullable=True)
    technical_skill_id = Column(UUID(as_uuid=True), ForeignKey("career_technical_skills.id"), nullable=True)
    text = Column(String, nullable=False)
    type = Column(String, nullable=False)  # hobby, technical

    hobby = relationship("CareerHobby", back_populates="questions")
    technical_skill = relationship("CareerTechnicalSkill", back_populates="questions")
    answers = relationship("CareerAnswer", back_populates="question", cascade="all, delete-orphan")


# =========================
# CAREER ANSWER
# =========================
class CareerAnswer(Base):
    __tablename__ = "career_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("career_sessions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("career_questions.id"), nullable=False)
    answer = Column(String, nullable=False)

    session = relationship("CareerSession", back_populates="answers")
    question = relationship("CareerQuestion", back_populates="answers")


# =========================
# CAREER TRACK RESULT
# =========================
class CareerTrackResult(Base):
    __tablename__ = "career_track_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("career_sessions.id"), nullable=False)
    track_id = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id"), nullable=False)
    score = Column(Integer, nullable=False)

    session = relationship("CareerSession", back_populates="track_results")
    track = relationship("CareerTrack", back_populates="track_results")


# ###########################################################################################################################
# JOBS
# ###########################################################################################################################

# =========================
# JOB POSTS
# =========================
class JobPost(Base):
    __tablename__ = "job_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_title = Column(String, nullable=False, index=True)
    company_name = Column(String, nullable=True, index=True)
    job_url = Column(String, nullable=True, unique=True)
    source = Column(String, nullable=True)
    location = Column(Text, nullable=True)
    posted_date = Column(Date, nullable=True)
    career_level = Column(String, nullable=True)
    work_type = Column(String, nullable=True)
    employment_type = Column(String, nullable=True)
    description_about_role = Column(Text, nullable=True)
    description_key_responsibilities = Column(Text, nullable=True)
    description_requirements = Column(Text, nullable=True)
    description_nice_to_have = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    updated_at = Column(
        DateTime(timezone=False),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Matches existing DB column `salary` (nullable text)
    salary = Column(String, nullable=True)

    user_interactions = relationship("JobUserInteraction", back_populates="job_post", cascade="all, delete-orphan")
    skills = relationship("JobPostSkill", back_populates="job_post", cascade="all, delete-orphan")
    applications = relationship("JobApplication", back_populates="job_post", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_job_post_title_company", "job_title", "company_name"),
        Index("idx_job_post_created_at", "created_at"),
    )


# =========================
# JOB POSTS <-> SKILLS (uses unified Skill table)
# =========================
class JobPostSkill(Base):
    __tablename__ = "job_post_skills"

    job_post_id = Column(UUID(as_uuid=True), ForeignKey("job_posts.id", ondelete="CASCADE"), primary_key=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)

    job_post = relationship("JobPost", back_populates="skills")
    skill = relationship("Skill", back_populates="job_post_skills")

    __table_args__ = (
        Index("idx_job_skills_skill_id", "skill_id"),
    )


# =========================
# JOB USER INTERACTIONS
# =========================
class JobUserInteraction(Base):
    __tablename__ = "job_user_interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_post_id = Column(UUID(as_uuid=True), ForeignKey("job_posts.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    viewed_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, nullable=False, default=0)
    is_saved = Column(Boolean, nullable=False, default=False)
    saved_at = Column(DateTime(timezone=True), nullable=True)
    last_interaction_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    job_post = relationship("JobPost", back_populates="user_interactions")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "job_post_id", name="unique_user_job_interaction"),
        Index("idx_job_user_interactions_user_saved", "user_id", "is_saved"),
        Index("idx_job_user_interactions_user_viewed_at", "user_id", "viewed_at"),
    )


# =========================
# JOB APPLICATIONS
# =========================
class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    job_post_id = Column(UUID(as_uuid=True), ForeignKey("job_posts.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False)
    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    job_post = relationship("JobPost", back_populates="applications")
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("status IN ('applied','interview','offer','rejected','saved')", name="ck_job_applications_status"),
    )


# ###########################################################################################################################
# COURSES
# ###########################################################################################################################

# =========================
# COURSES
# =========================
class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform = Column(String, nullable=True)
    title = Column(String, nullable=False, index=True)
    instructor = Column(String, nullable=True)
    tags = Column(ARRAY(Text), nullable=True)
    duration = Column(String, nullable=True)
    url = Column(Text, nullable=False, unique=True)
    category = Column(String, nullable=True, index=True)
    level = Column(String, nullable=True, index=True)
    price = Column(String, nullable=True)
    language = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    user_progress = relationship("CourseUserProgress", back_populates="course", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_course_category_level", "category", "level"),
        Index("idx_course_created_at", "created_at"),
    )


# =========================
# COURSE USER PROGRESS
# =========================
class CourseUserProgress(Base):
    __tablename__ = "course_user_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    saved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    course = relationship("Course", back_populates="user_progress")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="unique_user_course"),
        Index("idx_course_user_progress_user_status", "user_id", "status"),
        Index("idx_course_user_progress_saved_at", "saved_at"),
    )


# ###########################################################################################################################
# BLOG CAREER LEVELS (Existing tables)
# ###########################################################################################################################

# =========================
# BLOG CAREER LEVEL
# =========================
class BlogCareerLevel(Base):
    __tablename__ = "blog_career_levels"

    id = Column(UUID(as_uuid=True), primary_key=True)
    career_id = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id"), nullable=False)
    level = Column(String, nullable=False)  # "Entry", "Junior", "Senior"
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    market_demand = Column(String, nullable=True)  # "Low", "Medium", "High"
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    career = relationship("CareerTrack")
    skills = relationship("BlogCareerLevelSkill", back_populates="career_level", cascade="all, delete-orphan")
    responsibilities = relationship("BlogCareerLevelResponsibility", back_populates="career_level", cascade="all, delete-orphan")
    fit_profiles = relationship("BlogCareerLevelFitProfile", back_populates="career_level", cascade="all, delete-orphan")


# =========================
# BLOG CAREER LEVEL SKILL
# =========================
class BlogCareerLevelSkill(Base):
    __tablename__ = "blog_career_level_skills"

    id = Column(UUID(as_uuid=True), primary_key=True)
    career_level_id = Column(UUID(as_uuid=True), ForeignKey("blog_career_levels.id", ondelete="CASCADE"), nullable=False)
    skill_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)

    career_level = relationship("BlogCareerLevel", back_populates="skills")


# =========================
# BLOG CAREER LEVEL RESPONSIBILITY
# =========================
class BlogCareerLevelResponsibility(Base):
    __tablename__ = "blog_career_level_responsibilities"

    id = Column(UUID(as_uuid=True), primary_key=True)
    career_level_id = Column(UUID(as_uuid=True), ForeignKey("blog_career_levels.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)

    career_level = relationship("BlogCareerLevel", back_populates="responsibilities")


# =========================
# BLOG CAREER LEVEL FIT PROFILE
# =========================
class BlogCareerLevelFitProfile(Base):
    __tablename__ = "blog_career_level_fit_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)
    career_level_id = Column(UUID(as_uuid=True), ForeignKey("blog_career_levels.id", ondelete="CASCADE"), nullable=False)
    statement = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)

    career_level = relationship("BlogCareerLevel", back_populates="fit_profiles")
