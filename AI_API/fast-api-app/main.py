import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.config import settings
from core.observability import install_request_timing_middleware
from routers.interview.interview import routers as interview_routers
from routers.cv.cv import routers as cv_routers
from routers.skills.skill import routers as skill_routers
from routers.skill_assessment.sa import routers as skill_assessment_routers
from routers.reports.report_router import router as report_router
from routers.roadmaps.roadmap import routers as roadmap_routers
from routers.career.career import routers as career_quiz_routers
from routers.journey.journey import routers as journey_routers
from routers.job.job import router as job_router
from routers.course import router as course_router
from routers.profile import router as profile_router

app = FastAPI()
install_request_timing_middleware(app)

for path in settings.AUDIO_PATHS.values():
    os.makedirs(path, exist_ok=True)

app.mount("/audio", StaticFiles(directory=settings.AUDIO_BASE), name="audio")

allowed_origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

for router in interview_routers:
    app.include_router(router)

for router in cv_routers:
    app.include_router(router)

for router in skill_routers:
    app.include_router(router)

for router in skill_assessment_routers:
    app.include_router(router)

for router in roadmap_routers:
    app.include_router(router)

for router in journey_routers:
    app.include_router(router)

app.include_router(report_router)

for router in career_quiz_routers:
    app.include_router(router)

app.include_router(job_router)
app.include_router(course_router)
app.include_router(profile_router)
