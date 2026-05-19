from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from typing import List, Literal

# ======================================================
# USER
# ======================================================

class UserBase(BaseModel):
    job_title: str
    username: str


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# QUESTION
# ======================================================

class QuestionBase(BaseModel):
    type: str
    question_text: str
    question_audio: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionRead(QuestionBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# SESSION
# ======================================================

class SessionBase(BaseModel):
    name: str
    type: str
    status: str


class SessionCreate(SessionBase):
    user_id: UUID


class SessionUpdate(BaseModel):
    status: Optional[str] = None


class SessionRead(SessionBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None
    sentiment_evaluation: Optional[Dict] = None
    model_config = ConfigDict(from_attributes=True)


class CompleteInterviewSessionResponse(BaseModel):
    session: SessionRead
    report: "ReportSchema"


class InterviewArchiveItemRead(BaseModel):
    session_id: UUID
    session_name: str
    session_type: str
    session_created_at: Optional[datetime] = None
    report_id: UUID
    report_filename: str
    report_created_at: datetime


# ======================================================
# FOLLOWUP
# ======================================================

class FollowupBase(BaseModel):
    fquestion_text: str
    fquestion_audio: Optional[str] = None


class FollowupCreate(FollowupBase):
    answer_id: UUID


class FollowupRead(FollowupBase):
    id: UUID
    answer_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# ANSWER
# ======================================================

class AnswerBase(BaseModel):
    answer_text: Optional[str] = None
    answer_audio: Optional[str] = None
    answer_video: Optional[str] = None
    feedback: Optional[str] = None
    grade: Optional[str] = None
    isfollowup: bool = False
    emotion_evaluation: Optional[Dict] = None
    tone_evaluation: Optional[Dict] = None
    sentiment_evaluation: Optional[Dict] = None


class AnswerCreate(AnswerBase):
    session_id: UUID
    question_id: Optional[UUID] = None
    followup_id: Optional[UUID] = None


class AnswerRead(AnswerBase):
    id: UUID
    session_id: UUID
    question_id: Optional[UUID] = None
    followup_id: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# SKILLS SCHEMAS
# ======================================================

class SkillBase(BaseModel):
    skill_name: str


class SkillCreate(SkillBase):
    pass


class SkillRead(SkillBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class UserSkillWithSkillRead(BaseModel):
    id: UUID
    isCV: bool
    proficiency: Optional[str] = None
    skill: SkillRead
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# EXPERIENCE
# ======================================================

class ExperienceSchema(BaseModel):
    id: Optional[UUID] = None
    role: str
    organization: Optional[str] = None
    period: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    achievements: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# EDUCATION
# ======================================================

class EducationSchema(BaseModel):
    id: Optional[UUID] = None
    qualification: Optional[str] = None
    institution: Optional[str] = None
    period: Optional[str] = None
    details: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# CERTIFICATION
# ======================================================

class CertificationSchema(BaseModel):
    id: Optional[UUID] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    period: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# PROJECT
# ======================================================

class ProjectSchema(BaseModel):
    id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    technologies: Optional[List[str]] = None
    achievements: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# LANGUAGE
# ======================================================

class LanguageSchema(BaseModel):
    id: Optional[UUID] = None
    language: str
    proficiency: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# AWARD
# ======================================================

class AwardSchema(BaseModel):
    id: Optional[UUID] = None
    title: str
    organization: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# REFERENCE
# ======================================================

class ReferenceSchema(BaseModel):
    id: Optional[UUID] = None
    name: str
    role: Optional[str] = None
    organization: Optional[str] = None
    contact_info: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ======================================================
# USER SCHEMA
# ======================================================

class UserSchema(BaseModel):
    id: Optional[UUID] = None
    full_name: str
    professional_title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    summary: Optional[str] = None

    skills: List[UserSkillWithSkillRead] = Field(default_factory=list)
    experiences: List[ExperienceSchema] = Field(default_factory=list)
    education: List[EducationSchema] = Field(default_factory=list)
    certifications: List[CertificationSchema] = Field(default_factory=list)
    projects: List[ProjectSchema] = Field(default_factory=list)
    languages: List[LanguageSchema] = Field(default_factory=list)
    awards: List[AwardSchema] = Field(default_factory=list)
    references: List[ReferenceSchema] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# =====================================================
# SKILL ASSESSMENT QUESTION SCHEMAS
# =====================================================

class SAQuestionBase(BaseModel):
    question_text: str
    skill_id: UUID


class SAQuestionCreate(SAQuestionBase):
    pass


class SAQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    skill_id: Optional[UUID] = None


class SAAnswerOutShort(BaseModel):
    id: UUID
    answer_text: Optional[str]
    score: float
    feedback: Optional[str]

    class Config:
        from_attributes = True


class SAQuestionOut(SAQuestionBase):
    id: UUID
    answers: Optional[List[SAAnswerOutShort]] = []

    class Config:
        from_attributes = True


# =====================================================
# ASSESSMENT SCHEMAS
# =====================================================

# =====================================================
# START ASSESSMENT
# =====================================================
class StartAssessmentRequest(BaseModel):
    target_id: UUID
    num_questions: int = Field(gt=4, le=20)  # max 20 questions
    session_type: Literal["skills", "roadmap", "section", "step"]


class AssessmentQuestionResponse(BaseModel):
    id: UUID
    question_text: str
    options: List[str]

    class Config:
        from_attributes = True


class StartAssessmentResponse(BaseModel):
    session_id: UUID
    questions: List[AssessmentQuestionResponse]


class AssessmentSessionSummary(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    skill_id: Optional[UUID] = None
    roadmap_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    step_id: Optional[UUID] = None
    total_questions: int
    score: int
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# =====================================================
# SUBMIT ASSESSMENT
# =====================================================
class AssessmentAnswerInput(BaseModel):
    question_id: UUID
    selected_answer: str


class SubmitAssessmentRequest(BaseModel):
    session_id: UUID
    answers: List[AssessmentAnswerInput]


# =====================================================
# RESULT / FEEDBACK
# =====================================================
class AssessmentQuestionResult(BaseModel):
    question_id: UUID
    selected_answer: str
    correct_answer: str
    explanation: str
    is_correct: bool


class SubmitAssessmentResponse(BaseModel):
    session_id: UUID
    score: int  # percentage
    total_questions: int
    results: List[AssessmentQuestionResult]


# =====================================================
# REPORT SCHEMAS
# =====================================================
class ReportSchema(BaseModel):
    id: UUID
    filename: str
    created_at: datetime
    type: str

    class Config:
        from_attributes = True


CompleteInterviewSessionResponse.model_rebuild()


# =====================================================
# CV BUILD REQUEST SCHEMA
# =====================================================
class CVBuildRequest(BaseModel):
    cv_text: str


# =====================================================
# ROADMAP IMPORT/READ/PROGRESS SCHEMAS
# =====================================================

class RoadmapResourceSchema(BaseModel):
    resourceType: str
    title: str
    url: str


class RoadmapStepImportSchema(BaseModel):
    title: str
    description: Optional[str] = ""
    resources: List[RoadmapResourceSchema] = Field(default_factory=list)


class RoadmapSectionImportSchema(BaseModel):
    title: str
    description: Optional[str] = ""
    steps: List[RoadmapStepImportSchema] = Field(default_factory=list)


class RoadmapImportPayloadSchema(BaseModel):
    title: str
    description: Optional[str] = ""
    sections: List[RoadmapSectionImportSchema] = Field(default_factory=list)


class RoadmapImportRequestSchema(BaseModel):
    roadmap: Optional[RoadmapImportPayloadSchema] = None
    roadmaps: Optional[List[RoadmapImportPayloadSchema]] = None


class RoadmapImportFromPathRequestSchema(BaseModel):
    path: str
    recursive: bool = False


class RoadmapImportItemResultSchema(BaseModel):
    title: str
    status: str
    sections_count: int = 0
    steps_count: int = 0
    message: Optional[str] = None


class BulkRoadmapImportResponseSchema(BaseModel):
    imported: int
    updated: int
    failed: int
    results: List[RoadmapImportItemResultSchema]


class CourseIngestionProviderRawItemSchema(BaseModel):
    provider: Literal["coursera", "udemy", "udacity"]
    title: str
    url: str
    description: Optional[str] = None
    language: Optional[str] = None
    is_free: Optional[bool] = None
    rating: Optional[float] = None
    provider_course_id: Optional[str] = None
    rank_in_provider: Optional[int] = None
    source_payload: Dict[str, Any] = Field(default_factory=dict)


class RoadmapCourseIngestionRequestSchema(BaseModel):
    section_ids: Optional[List[UUID]] = None
    section_limit: Optional[int] = Field(default=None, gt=0)
    top_k_per_provider: int = Field(default=3, ge=1, le=10)


class CourseIngestionProviderSummarySchema(BaseModel):
    provider: Literal["coursera", "udemy", "udacity"]
    fetched: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: List[str] = Field(default_factory=list)


class RoadmapCourseIngestionSectionSummarySchema(BaseModel):
    section_id: UUID
    section_title: str
    roadmap_id: UUID
    roadmap_title: str
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    providers: List[CourseIngestionProviderSummarySchema] = Field(default_factory=list)


class RoadmapCourseIngestionResponseSchema(BaseModel):
    sections_processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    results: List[RoadmapCourseIngestionSectionSummarySchema] = Field(default_factory=list)


class RoadmapStepReadSchema(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = ""
    order: int
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class RoadmapSectionReadSchema(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = ""
    order: int
    courses_count: int = 0
    steps: List[RoadmapStepReadSchema] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class RoadmapReadSchema(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = ""
    sections: List[RoadmapSectionReadSchema] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class RoadmapCourseReadSchema(BaseModel):
    id: UUID
    provider: str
    title: str
    url: str
    description: Optional[str] = None
    language: Optional[str] = None
    is_free: Optional[bool] = None
    rating: Optional[float] = None
    provider_course_id: Optional[str] = None
    rank_in_provider: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class RoadmapSectionCoursesReadSchema(BaseModel):
    section_id: UUID
    section_title: str
    order: int
    courses: List[RoadmapCourseReadSchema] = Field(default_factory=list)


class RoadmapCoursesReadSchema(BaseModel):
    roadmap_id: UUID
    roadmap_title: str
    sections: List[RoadmapSectionCoursesReadSchema] = Field(default_factory=list)


class RoadmapListItemSchema(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = ""
    sections_count: int
    steps_count: int


class UserRoadmapBookmarkReadSchema(BaseModel):
    roadmap_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UserRoadmapBookmarkListSchema(BaseModel):
    user_id: UUID
    bookmarks: List[UserRoadmapBookmarkReadSchema] = Field(default_factory=list)


class UserRoadmapBookmarkToggleSchema(BaseModel):
    roadmap_id: UUID
    bookmarked: bool


class StepProgressUpsertRequestSchema(BaseModel):
    completion_status: str = Field(pattern="^(not_started|in_progress|completed)$")
    score: Optional[int] = None
    proficiency: Optional[str] = None


class StepProgressReadSchema(BaseModel):
    step_id: UUID
    completion_status: str
    completed_at: Optional[datetime] = None
    score: Optional[int] = None
    proficiency: Optional[str] = None


class SectionProgressSummarySchema(BaseModel):
    section_id: UUID
    title: str
    completion_status: str
    completed_steps: int
    total_steps: int
    completion_percent: int
    steps: List[StepProgressReadSchema] = Field(default_factory=list)


class RoadmapProgressSummarySchema(BaseModel):
    roadmap_id: UUID
    title: str
    completion_status: str
    completed_sections: int
    total_sections: int
    completed_steps: int
    total_steps: int
    completion_percent: int
    sections: List[SectionProgressSummarySchema] = Field(default_factory=list)


class UserRoadmapProgressItemSchema(BaseModel):
    roadmap_id: UUID
    title: str
    completion_status: str
    completion_percent: int


class UserRoadmapProgressListSchema(BaseModel):
    user_id: UUID
    roadmaps: List[UserRoadmapProgressItemSchema] = Field(default_factory=list)


class CurrentRoadmapLearningSchema(BaseModel):
    roadmap_id: UUID
    roadmap_title: str
    section_id: Optional[UUID] = None
    section_title: Optional[str] = None
    step_id: Optional[UUID] = None
    step_title: Optional[str] = None
    progress_percent: int


# =====================================================
# CAREER QUIZ SCHEMAS
# =====================================================
class CareerSessionBase(BaseModel):
    user_id: UUID
    status: str = "in_progress"

class CareerSessionCreate(BaseModel):
    user_id: UUID
    status: Optional[str] = "in_progress"

class CareerSessionRead(CareerSessionBase):
    id: UUID
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CareerSessionStatusUpdate(BaseModel):
    status: str

class CareerAnswerBase(BaseModel):
    question_id: UUID
    answer: int = Field(ge=1, le=5)

class CareerAnswerCreate(BaseModel):
    answers: List[CareerAnswerBase]

class CareerAnswerRead(BaseModel):
    id: UUID
    session_id: UUID
    question_id: UUID
    answer: int

    class Config:
        from_attributes = True

# Single question response
class CareerQuestionResponse(BaseModel):
    id: UUID
    hobby_id: Optional[UUID]
    technical_skill_id: Optional[UUID]
    text: str
    type: str

    class Config:
        from_attributes = True

# Questions for a single card
class CardQuestions(BaseModel):
    card_id: UUID
    questions: List[str]

# Payload for multiple cards
class CareerQuestionsCreateMultiple(BaseModel):
    cards: List[CardQuestions]

class CareerCardBase(BaseModel):
    name: str
    description: Optional[str] = None

class CareerCardCreate(CareerCardBase):
    pass

class CareerCardRead(CareerCardBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

class CareerCardSelectionItem(BaseModel):
    id: UUID
    type: Literal["hobby", "technical"]

class CareerCardSelectionMultiple(BaseModel):
    cards: List[CareerCardSelectionItem]

class CareerSelectedCardRead(BaseModel):
    type: Literal["hobby", "technical"]
    id: UUID
    name: str
    model_config = ConfigDict(from_attributes=True)

class CareerTrackRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CareerTrackScoreRead(BaseModel):
    track_id: UUID
    track_name: str
    track_description: Optional[str] = None
    roadmap_id: Optional[UUID] = None
    score: int = Field(ge=0, le=100)

class CareerEvaluationRead(BaseModel):
    track_scores: List[CareerTrackScoreRead]


# =====================================================
# JOB SCHEMAS
# =====================================================

class JobPostBase(BaseModel):
    job_title: str
    company_name: Optional[str] = None
    job_url: Optional[str] = None
    source: Optional[str] = None
    location: Optional[str] = None
    posted_date: Optional[date] = None
    career_level: Optional[str] = None
    work_type: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[str] = None
    description_about_role: Optional[str] = None
    description_key_responsibilities: Optional[str] = None
    description_requirements: Optional[str] = None
    description_nice_to_have: Optional[str] = None


class JobPostCreate(JobPostBase):
    pass


class JobBulkImportItem(JobPostBase):
    skills: Optional[List[str]] = None
    posted_date: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class JobBulkImportRequest(BaseModel):
    jobs: List[JobBulkImportItem]


class JobPostResponse(JobPostBase):
    id: UUID
    location_country: Optional[str] = None
    location_city: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    skills: List[str] = Field(default_factory=list)
    match_percentage: Optional[float] = None
    is_saved: bool = False
    saved_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    view_count: int = 0
    last_interaction_at: Optional[datetime] = None
    application_status: Optional[str] = None
    applied_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class JobFilterOptionResponse(BaseModel):
    id: str
    title: str
    count: int


class JobFilterOptionsResponse(BaseModel):
    countries: List[JobFilterOptionResponse] = Field(default_factory=list)
    cities: List[JobFilterOptionResponse] = Field(default_factory=list)
    job_types: List[JobFilterOptionResponse] = Field(default_factory=list)
    work_types: List[JobFilterOptionResponse] = Field(default_factory=list)
    career_levels: List[JobFilterOptionResponse] = Field(default_factory=list)


class JobListResponse(BaseModel):
    query: Optional[str] = None
    total: int
    skip: int
    limit: int
    page: int = 1
    total_pages: int = 0
    filters: JobFilterOptionsResponse = Field(default_factory=JobFilterOptionsResponse)
    jobs: List[JobPostResponse]


class JobInteractionResponse(BaseModel):
    id: UUID
    job_post_id: UUID
    user_id: UUID
    viewed_at: Optional[datetime] = None
    is_saved: bool
    saved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


JobApplicationStatus = Literal["applied", "interview", "offer", "rejected", "saved"]


class JobApplicationUpsertRequest(BaseModel):
    status: JobApplicationStatus = "applied"


class JobApplicationResponse(BaseModel):
    id: UUID
    job_post_id: UUID
    user_id: UUID
    status: JobApplicationStatus
    applied_at: Optional[datetime] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UserJobsListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    page: int = 1
    total_pages: int = 0
    filters: JobFilterOptionsResponse = Field(default_factory=JobFilterOptionsResponse)
    jobs: List[JobPostResponse]


# =====================================================
# COURSE SCHEMAS
# =====================================================

class CourseBase(BaseModel):
    platform: Optional[str] = None
    title: str
    instructor: Optional[str] = None
    tags: Optional[List[str]] = None
    duration: Optional[str] = None
    url: str
    category: Optional[str] = None
    level: Optional[str] = None
    price: Optional[str] = None
    language: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


CourseStatus = Literal["saved", "enrolled", "completed"]


class CourseStatusUpdateRequest(BaseModel):
    status: CourseStatus


class CourseProgressResponse(BaseModel):
    id: UUID
    course_id: UUID
    user_id: UUID
    status: CourseStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    saved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BulkCourseImportResult(BaseModel):
    inserted: int
    skipped: int
    total_processed: int
    duplicates: List[str]


# =====================================================
# CAREER LEVEL (Blog/Details) SCHEMAS
# =====================================================

class CareerLevelBase(BaseModel):
    job_title: str
    level: Literal["Entry", "Junior", "Senior"]
    salary: Optional[str] = None
    demand: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    fit_reasons: Optional[List[str]] = None
    skills: Optional[List[str]] = None


class CareerLevelCreate(CareerLevelBase):
    pass


class CareerLevelRead(CareerLevelBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class CareerLevelDetailResponse(BaseModel):
    """Response for a single level (Entry/Junior/Senior)"""
    salary: str
    demand: str
    demandColor: str
    responsibilities: List[str]
    fitReason: List[str]


class CareerBlogDetailsResponse(BaseModel):
    """Full career blog details response with all levels"""
    jobTitle: str
    skills: List[str]
    levels: Dict[str, CareerLevelDetailResponse]



class UserCoursesListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    courses: List[CourseResponse]

