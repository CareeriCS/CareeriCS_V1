# ============================================================
# Extract CV
# ============================================================
cv_schema = {
    "full_name": "",
    "professional_title": "",
    "contact": {
        "email": "",
        "phone": "",
        "city": "",
        "country": "",
        "linkedin": "",
        "portfolio": ""
    },
    "summary": "",
    "skills": [{"skill_name": "", "proficiency": ""}],
    "experiences": [{"role": "", "organization": "", "period": "", "responsibilities": [], "achievements": ""}],
    "education": [{"qualification": "", "institution": "", "period": "", "details": ""}],
    "certifications": [{"title": "", "organization": "", "period": ""}],
    "projects": [{"title": "", "description": "", "role": "", "technologies": [], "achievements": ""}],
    "languages": [{"language": "", "proficiency": ""}],
    "awards": [{"title": "", "organization": "", "date": "", "description": ""}],
    "references": [{"name": "", "role": "", "organization": "", "contact_info": ""}]
}


# ============================================================
# Interview Session
# ============================================================
interview_session_schema = {
    "session_report": {
        "session_name": "",
        "basic_details": {
            "user_name": "",
            "interview_date": "",
            "interview_type": ""
        },
        "structured_interview_summaries": [
            {
                "question_number": None,
                "question_text": "",
                "answer_summary": "",
                "score": None,
                "feedback": ""
            }
        ],
        "skills": [],
        "behavioral_insights": {
            "FER": "",
            "SER": "",
            "sentiment_analysis": ""
        },
        "overall_assessment_and_recommendation": {
            "overall_score": None,
            "strengths": [],
            "areas_for_improvement": [],
            "final_recommendation": ""
        }
    }
}


# ============================================================
# Evaluate Answer
# ============================================================
evaluate_answer_schema = {
    "score": 0,
    "feedback": "",
    "improvement": "",
    "followup_required": False
}

# ============================================================
# Skill Assessment
# ============================================================
skill_assessment_questions_schema = [
    {
        "question": "",
        "options": ["", "", "", ""],
        "correct_answer": "",
        "explanation": "",
        "difficulty": "easy || medium || hard"
    }
]


# ============================================================
# Career Quiz Evaluation
# ============================================================
career_quiz_evaluation_schema = [
    {
        "track_id": "UUID",
        "score": "integer (0-100)"
    }
]