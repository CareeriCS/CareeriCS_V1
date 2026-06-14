import json
from typing import List
from ai.schemas import *


# ============================================================
# Extract CV
# ============================================================
def extract_cv_prompt(cv_text: str) -> str:
    return (
        "You are an advanced CV Extractor engine.\n\n"
        "Extract structured information from the CV text below.\n\n"
        "IMPORTANT RULES:\n"
        "- Return ONLY valid JSON.\n"
        "- Do NOT include explanations or markdown.\n"
        "- Do NOT omit fields.\n"
        "- If a section does not exist, return an empty array [].\n"
        "- If a field does not exist, return empty string \"\".\n"
        "- Follow the schema EXACTLY.\n\n"
        f"SCHEMA:\n{json.dumps(cv_schema, indent=2)}\n\n"
        f"CV TEXT:\n{cv_text}"
    )


# ============================================================
# Enhance CV
# ============================================================
def enhance_cv_prompt(cv_text: str) -> str:
    return (
        "You are an advanced CV Enhancer engine.\n\n"
        "Directly improve the CV text below by:\n"
        "- Rewriting descriptions for clarity, impact, and professionalism.\n"
        "- Highlighting skills and achievements.\n"
        "- Normalizing formatting, dates, and titles.\n"
        "- Completing missing fields when possible.\n\n"
        "IMPORTANT RULES:\n"
        "- Return ONLY valid JSON.\n"
        "- Do NOT include explanations or markdown.\n"
        "- Do NOT omit fields.\n"
        "- If a section does not exist, return an empty array [].\n"
        "- If a field does not exist, return empty string \"\".\n"
        "- Follow the schema EXACTLY.\n\n"
        f"SCHEMA:\n{json.dumps(cv_schema, indent=2)}\n\n"
        f"CV TEXT:\n{cv_text}"
    )


# ============================================================
# Evaluate Answer
# ============================================================
def evaluate_answer_prompt(
    question_text: str,
    user_answer: str,
    interview_type: str,
    is_followup: bool
) -> str:

    followup_instruction = (
        "Set followup_required to true ONLY when the answer is too vague, incomplete, unclear, off-topic, "
        "or missing critical information needed to properly evaluate the candidate.\n"
        "Do NOT ask a follow-up just because the answer could be better, more detailed, or more polished.\n"
        "If the answer is acceptable and understandable, set followup_required to false.\n"
        "If followup_required is false, improvement must be an empty string.\n"
        "Only provide improvement suggestions when followup_required is true.\n"
        "Prefer followup_required = false unless a follow-up is truly necessary."
    )

    return (
        f"Question:\n{question_text}\n\n"
        f"User Answer:\n{user_answer}\n\n"
        "Role:\n"
        f"You are a professional {interview_type} interviewer.\n\n"
        "Objective:\n"
        "Evaluate the user's answer naturally and professionally.\n\n"
        "Instructions:\n"
        "- Score from 0 to 5 (integer only)\n"
        "- Provide constructive feedback\n"
        f"- {followup_instruction}\n\n"
        "Return ONLY valid JSON following this exact schema:\n"
        f"{json.dumps(evaluate_answer_schema, indent=2)}\n\n"
        "IMPORTANT:\n"
        "- No markdown\n"
        "- No extra text\n"
        "- No additional keys\n"
        "- Output must be valid JSON"
    )


# ============================================================
# Interview Session
# ============================================================
def interview_session_fields_prompt(session_json: dict) -> str:
    return f"""
        You are an elite AI interview evaluator and professional hiring report generator.

        You are given a raw interview session JSON containing:
        - interview metadata
        - questions and answers
        - feedback
        - emotional analysis
        - tone analysis
        - sentiment analysis

        INPUT SESSION JSON:
        {json.dumps(session_json, indent=2)}

        Your task is to analyze the interview deeply and generate a complete professional interview report.

        You MUST fill the following schema EXACTLY:
        {json.dumps(interview_session_schema, indent=2)}

        STRICT OUTPUT RULES:
        1. Return ONLY valid JSON.
        2. Do NOT wrap the response in markdown.
        3. Do NOT include explanations, comments, headings, or extra text.
        4. Follow the schema EXACTLY.
        5. Never add extra fields.
        6. Preserve all field names exactly as provided.
        7. All arrays must always exist.
        8. Missing string values must be "".
        9. Missing arrays must be [].
        10. Missing numeric values must be null.

        SCORING RULES:
        - Each question score is an integer from 0 to 5.
        - Evaluate scores based on:
        - technical accuracy
        - communication clarity
        - confidence
        - completeness
        - relevance
        - professionalism
        - Be realistic and critical.
        - Avoid giving perfect scores unless strongly deserved.
        - overall_score = sum of all question scores.
        - Maximum overall_score = number_of_questions * 5.

        QUESTION SUMMARY RULES:
        - Auto enumerate question_number starting from 1.
        - answer_summary must:
        - be concise
        - summarize the candidate's actual answer
        - avoid repetition
        - avoid hallucinations
        - feedback must:
        - be actionable
        - identify strengths and weaknesses
        - explain why the score was given

        SKILLS EXTRACTION RULES:
        - Extract ONLY meaningful professional skills demonstrated in answers.
        - Include both technical and soft skills when applicable.
        - Avoid duplicates.
        - Return concise skill names only.

        BEHAVIORAL INSIGHTS RULES:
        - FER should summarize facial/emotional expression patterns if available.
        - SER should summarize speech emotion/tone patterns if available.
        - sentiment_analysis should summarize the overall emotional sentiment of the interview.
        - Keep all behavioral summaries concise and professional.

        OVERALL ASSESSMENT RULES:
        - strengths:
        - list the candidate's strongest demonstrated qualities
        - use short bullet-style statements
        - areas_for_improvement:
        - identify genuine weaknesses or missing areas
        - be constructive and specific
        - final_recommendation:
        - provide a concise hiring recommendation
        - examples:
            - "Strong Hire"
            - "Hire"
            - "Consider"
            - "Weak Consider"
            - "No Hire"
        - recommendation must align with the actual performance

        QUALITY RULES:
        - Maintain professional HR/interviewer language.
        - Be objective and evidence-based.
        - Do not invent information not supported by the input.
        - Avoid generic filler statements.
        - Keep summaries concise but insightful.
    """


# ============================================================
# Skill Assessment
# ============================================================
def skill_assessment_questions_prompt(skill_name: str, num_questions: int) -> str:
    return (
        "You are a Computer Science expert Skill Assessment Question Generator.\n\n"
        f"Generate {num_questions} multiple-choice questions to assess {skill_name} skill.\n\n"
        "Return a JSON array that contains EXACTLY "
        f"{num_questions} question objects.\n\n"
        "Each question object must have:\n"
        "- A clear and concise question text\n"
        "- Exactly 4 answer options\n"
        "- One correct answer that matches one of the options\n"
        "- A brief explanation of the correct answer\n\n"
        "Output rules:\n"
        "- The top-level response MUST be a JSON array (not an object)\n"
        f"- The array length MUST be exactly {num_questions}\n"
        "- Every object must follow the schema keys exactly\n"
        "- Do not include markdown\n"
        "- Do not include any text before or after the JSON array\n\n"
        "Return ONLY valid JSON in this format:\n"
        f"{json.dumps(skill_assessment_questions_schema, indent=2)}\n\n"
        "IMPORTANT:\n"
        "- No markdown\n"
        "- No extra text\n"
        "- Output must be valid JSON"
    )


# ============================================================
# Career Quiz Evaluation
# ============================================================
def career_quiz_evaluation_prompt(
    selected_cards,
    answers,
    tracks
):
    return (
        "You are a professional AI career recommendation engine.\n"
        "Your task is to analyze the user's selected skills, interests, and question responses "
        "to determine the most suitable career tracks.\n\n"

        "SYSTEM OBJECTIVE:\n"
        "- Recommend the TOP 3 most suitable career tracks.\n"
        "- Recommendations must be evidence-based.\n"
        "- Recommendations must prioritize technical alignment, interests, and behavioral patterns.\n"
        "- Recommendations must be ranked from highest fit to lowest fit.\n\n"

        "INPUT DEFINITIONS:\n"
        "- Selected Cards:\n"
        "  Represent technologies, domains, tools, or interests selected by the user.\n\n"

        "- Question Responses:\n"
        "  Represent the user's agreement level with statements related to the selected cards.\n\n"

        "- Career Tracks:\n"
        "  Represent the available career paths that can be recommended.\n\n"

        "QUESTION RESPONSE RULES:\n"
        "- Each question response uses a 1–5 agreement scale.\n"
        "- These ratings represent how strongly the user agrees or disagrees with each statement.\n\n"

        "QUESTION RESPONSE SCALE:\n"
        "- 1 = Strongly Disagree\n"
        "- 2 = Disagree\n"
        "- 3 = Neutral\n"
        "- 4 = Agree\n"
        "- 5 = Strongly Agree\n\n"

        "QUESTION RESPONSE INTERPRETATION:\n"
        "- Ratings of 4–5 indicate strong positive alignment with the related skill, interest, or behavior.\n"
        "- Rating 5 represents very strong alignment.\n"
        "- Rating 4 represents moderate positive alignment.\n"
        "- Rating 3 is neutral and should contribute minimal scoring impact.\n"
        "- Ratings of 1–2 indicate negative alignment.\n"
        "- Rating 2 represents moderate misalignment.\n"
        "- Rating 1 represents strong misalignment.\n\n"

        "QUESTION RESPONSE SCORING RULES:\n"
        "- Technical skill responses are more important than general interest responses.\n"
        "- Multiple high ratings across related cards should significantly increase confidence.\n"
        "- Consistent positive response patterns are stronger than isolated high ratings.\n"
        "- Contradictory responses should reduce confidence.\n"
        "- Neutral responses should have low influence on recommendations.\n"
        "- Strong negative responses should substantially reduce compatibility scores.\n"
        "- Recommendations must be based on overall response patterns, not single answers.\n"
        "- Avoid inflated scores.\n"
        "- Scores above 90 should be rare and require exceptionally strong alignment.\n"
        "- Scores below 60 indicate weak fit.\n\n"

        "FIT SCORE GUIDELINES:\n"
        "- 90–100 = Exceptional fit\n"
        "- 75–89 = Strong fit\n"
        "- 60–74 = Moderate fit\n"
        "- Below 60 = Weak fit\n\n"

        "SELECTED CARDS:\n"
        + "\n".join([
            f"- {card['type']}: {card['name']}"
            for card in selected_cards
        ]) + "\n\n"

        "QUESTION RESPONSES:\n"
        + "\n".join([
            f"- {item['card_name']} | Question: {item['question_text']} | Rating: {item['answer']}"
            for item in answers
        ]) + "\n\n"

        "AVAILABLE CAREER TRACKS:\n"
        + "\n".join([
            f"- {track.name} | id={track.id} | description={track.description}"
            for track in tracks
        ]) + "\n\n"

        "EVALUATION PROCESS:\n"
        "1. Analyze dominant technical skill patterns.\n"
        "2. Analyze dominant interests and preferences.\n"
        "3. Detect recurring positive and negative response patterns.\n"
        "4. Compare user patterns against career track descriptions.\n"
        "5. Rank career tracks by compatibility strength.\n"
        "6. Return ONLY the best 3 tracks.\n\n"

        "IMPORTANT RULES:\n"
        "- Return EXACTLY 3 career tracks.\n"
        "- Recommendations must be sorted from highest score to lowest score.\n"
        "- Scores must be realistic and differentiated.\n"
        "- Do NOT assign identical scores unless absolutely necessary.\n"
        "- Do NOT recommend unrelated tracks.\n"
        "- Use ONLY the provided track IDs.\n"
        "- Never invent new tracks.\n"
        "- Output must be valid JSON only.\n"
        "- Output must be a JSON ARRAY.\n"
        "- No markdown.\n"
        "- No explanations.\n"
        "- No extra text.\n\n"

        "OUTPUT FORMAT MUST MATCH THIS SCHEMA EXACTLY:\n"
        f"{json.dumps(career_quiz_evaluation_schema, indent=2)}"
    )