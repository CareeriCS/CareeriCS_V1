# service/session_report_service.py
import io
import re
from uuid import UUID

from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from fastapi import HTTPException

from db.models import ReportTypeEnum, Session as InterviewSession
from services.reports.report_service import find_user_report_by_filename, save_report
from fastapi.responses import StreamingResponse
from utils.interview.session_ai_analysis import extract_session_data


def _sanitize_filename_fragment(value: str | None) -> str:
    safe_value = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "").strip())
    safe_value = safe_value.strip("._")
    return safe_value or "interview_session"


def build_session_report_filename(session_obj: InterviewSession) -> str:
    safe_name = _sanitize_filename_fragment(session_obj.name)
    return f"{safe_name}_{session_obj.id}_report.pdf"


def _stream_saved_report(report):
    return StreamingResponse(
        io.BytesIO(report.file_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report.filename}"},
    )


def _get_session_or_404(db: Session, session_id: UUID) -> InterviewSession:
    session_obj = db.get(InterviewSession, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_obj


def _ensure_session_has_answers(session_obj: InterviewSession) -> None:
    if not session_obj.answers:
        raise HTTPException(
            status_code=409,
            detail="Interview report is not ready because this session has no submitted answers yet.",
        )


def get_existing_session_report(db: Session, session_obj: InterviewSession):
    return find_user_report_by_filename(
        db=db,
        user_id=session_obj.user_id,
        filename=build_session_report_filename(session_obj),
        report_type=ReportTypeEnum.INTERVIEW_SESSION,
    )


def get_or_create_session_report(
    db: Session,
    session_id: UUID,
    user_id: UUID | None = None,
    *,
    allow_incomplete: bool = False,
):
    session_obj = _get_session_or_404(db, session_id)
    _ensure_session_has_answers(session_obj)

    if user_id is None:
        user_id = session_obj.user_id

    session_status = (session_obj.status or "").strip().lower()
    if not allow_incomplete and session_status != "completed":
        raise HTTPException(
            status_code=409,
            detail="Interview report is not ready until the session is completed.",
        )

    existing_report = get_existing_session_report(db, session_obj)
    if existing_report:
        return existing_report

    data = extract_session_data(db, session_id)
    report_data = data.get("session_report", {})

    summaries = report_data.get("structured_interview_summaries", [])
    num_questions = len(summaries)
    total_score = sum(item.get("score", 0) for item in summaries)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=22, textColor=colors.HexColor("#2E5077"), spaceAfter=12)
    heading_style = ParagraphStyle('HeadingStyle', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor("#4DA1A9"), spaceBefore=10, spaceAfter=10)
    label_style = ParagraphStyle('LabelStyle', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    body_style = styles['Normal']

    elements = []

    # --- Header & Basic Details ---
    elements.append(Paragraph(f"Session Report: {report_data.get('session_name')}", title_style))
    elements.append(Spacer(1, 12))

    basic = report_data.get("basic_details", {})
    details_data = [
        [Paragraph("<b>Name:</b>", body_style), basic.get("user_name")],
        [Paragraph("<b>Interview Type:</b>", body_style), basic.get("interview_type")],
        [Paragraph("<b>Interview Date:</b>", body_style), basic.get("interview_date") or "N/A"]
    ]
    details_table = Table(details_data, colWidths=[120, 300])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 20))

    # --- Structured Interview Summaries ---
    elements.append(Paragraph("Interview Q&A Breakdown", heading_style))
    for item in summaries:
        elements.append(Paragraph(f"Question {item.get('question_number')}: {item.get('question_text')}", label_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"<b>Answer Summary:</b> {item.get('answer_summary')}", body_style))
        elements.append(Spacer(1, 6))
        feedback_box = [
            [Paragraph(f"<b>Score:</b> {item.get('score')}/5", body_style)],
            [Paragraph(f"<b>Feedback:</b> {item.get('feedback')}", body_style)]
        ]
        fb_table = Table(feedback_box, colWidths=[440])
        fb_table.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
            ('BACKGROUND', (0,0), (-1,0), colors.honeydew if item.get('score') >= 3 else colors.mistyrose),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(fb_table)
        elements.append(Spacer(1, 15))

    # --- Behavioral Insights ---
    elements.append(PageBreak())
    elements.append(Paragraph("Behavioral & AI Insights", heading_style))
    beh = report_data.get("behavioral_insights", {})
    insights = [
        [Paragraph("<b>Facial Expression (FER):</b>", body_style), Paragraph(beh.get("FER"), body_style)],
        [Paragraph("<b>Tone Analysis (SER):</b>", body_style), Paragraph(beh.get("SER"), body_style)],
        [Paragraph("<b>Sentiment:</b>", body_style), Paragraph(beh.get("sentiment_analysis"), body_style)],
    ]
    ins_table = Table(insights, colWidths=[150, 310])
    ins_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(ins_table)
    elements.append(Spacer(1, 20))

    # --- Overall Assessment ---
    elements.append(Paragraph("Overall Assessment", heading_style))
    overall = report_data.get("overall_assessment_and_recommendation", {})
    elements.append(Paragraph(f"<b>Overall Score:</b> {total_score} / {num_questions * 5}", body_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Key Strengths:", label_style))
    for s in overall.get("strengths", []):
        elements.append(Paragraph(f"• {s}", body_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Areas for Improvement:", label_style))
    for imp in overall.get("areas_for_improvement", []):
        elements.append(Paragraph(f"• {imp}", body_style))
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("Final Recommendation:", label_style))
    elements.append(Paragraph(overall.get("final_recommendation"), body_style))

    # --- Build PDF ---
    doc.build(elements)
    buffer.seek(0)

    # --- Save PDF to Reports Table ---
    filename = build_session_report_filename(session_obj)
    report_bytes = buffer.getvalue()
    return save_report(
        db=db,
        user_id=user_id,
        file_bytes=report_bytes,
        filename=filename,
        report_type=ReportTypeEnum.INTERVIEW_SESSION,
    )


def build_session_report_pdf(db: Session, session_id: UUID, user_id: UUID | None = None):
    report = get_or_create_session_report(
        db=db,
        session_id=session_id,
        user_id=user_id,
        allow_incomplete=False,
    )
    return _stream_saved_report(report)
