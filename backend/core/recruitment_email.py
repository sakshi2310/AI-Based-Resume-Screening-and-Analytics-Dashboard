from __future__ import annotations

import asyncio
import smtplib
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage

from bson import ObjectId

from config.settings import get_settings
from core.candidate_records import build_resume_record
from db.collections import get_resumes_collection


@dataclass(frozen=True)
class EmailTemplate:
    subject: str
    text: str
    html: str


def _skills_html(skills: list[str], fallback: str, tone: str) -> str:
    if not skills:
        return f"<p style=\"margin:0;color:{tone};\">{fallback}</p>"
    items = "".join(
        f"<span style=\"display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:{tone};color:#ffffff;font-size:12px;\">{skill}</span>"
        for skill in skills
    )
    return f"<div style=\"margin-top:8px;\">{items}</div>"


def _skills_text(skills: list[str], fallback: str) -> str:
    return ", ".join(skills) if skills else fallback


def build_candidate_status_email(candidate) -> EmailTemplate:
    name = candidate.candidate_name or "Candidate"
    role = candidate.job_title or "the role"
    matched = candidate.matched_skills[:5]
    missing = candidate.missing_skills[:5]
    matched_text = _skills_text(matched, "general alignment with the role requirements")
    missing_text = _skills_text(missing, "no major gaps were identified")

    if candidate.final_status == "Shortlisted":
        subject = f"You have been shortlisted for {role}"
        text = (
            f"Hello {name},\n\n"
            f"Congratulations. You have been shortlisted for {role}.\n"
            "Our HR team will contact you soon with the next steps, which may include an interview or technical round.\n\n"
            f"Key strengths we observed: {matched_text}.\n\n"
            "Thank you for applying.\n"
            "ResumeAI Recruitment Team"
        )
        html = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2 style="color:#166534;">Congratulations, {name}.</h2>
          <p>You have been shortlisted for <strong>{role}</strong>.</p>
          <p>Our HR team will reach out soon with the next steps, which may include an interview or technical round.</p>
          <p><strong>Key strengths we observed</strong></p>
          {_skills_html(matched, "Strong alignment across the job requirements.", "#15803d")}
          <p style="margin-top:24px;">Thank you for applying.</p>
          <p style="margin-top:0;">ResumeAI Recruitment Team</p>
        </div>
        """
        return EmailTemplate(subject=subject, text=text, html=html)

    if candidate.final_status == "Rejected":
        subject = f"Update on your application for {role}"
        text = (
            f"Hello {name},\n\n"
            f"Thank you for your interest in {role}. We appreciate the time you invested in your application.\n\n"
            f"Preferred strengths we noticed: {matched_text}.\n"
            f"Areas we recommend improving for similar roles: {missing_text}.\n\n"
            "We encourage you to keep building these skills and apply again in the future.\n"
            "ResumeAI Recruitment Team"
        )
        html = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2 style="color:#991b1b;">Thank you for applying, {name}.</h2>
          <p>We appreciate your interest in <strong>{role}</strong> and the time you invested in the process.</p>
          <p><strong>Preferred strengths we noticed</strong></p>
          {_skills_html(matched, "Your profile showed several positive signals.", "#0f766e")}
          <p style="margin-top:16px;"><strong>Areas to strengthen for similar roles</strong></p>
          {_skills_html(missing, "No single missing skill stood out strongly.", "#b91c1c")}
          <p style="margin-top:16px;">We encourage you to keep building these skills and apply again in the future.</p>
          <p style="margin-top:0;">ResumeAI Recruitment Team</p>
        </div>
        """
        return EmailTemplate(subject=subject, text=text, html=html)

    subject = f"Your application for {role} is still under review"
    text = (
        f"Hello {name},\n\n"
        f"Thank you for applying for {role}. Your profile is still under review by our HR team.\n"
        "We will share the next update as soon as the review is complete.\n\n"
        "ResumeAI Recruitment Team"
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h2 style="color:#a16207;">Your application is still under review.</h2>
      <p>Thank you for applying for <strong>{role}</strong>, {name}.</p>
      <p>Your profile is still being reviewed by our HR team, and we will share the next update as soon as the review is complete.</p>
      <p style="margin-top:24px;">ResumeAI Recruitment Team</p>
    </div>
    """
    return EmailTemplate(subject=subject, text=text, html=html)


def _compose_email(recipient_email: str, template: EmailTemplate) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = template.subject
    message["From"] = f"{settings.email_from_name} <{settings.email_from_address}>"
    message["To"] = recipient_email
    message.set_content(template.text)
    message.add_alternative(template.html, subtype="html")
    return message


def _send_email_blocking(message: EmailMessage) -> None:
    settings = get_settings()
    timeout = settings.smtp_timeout_seconds

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=timeout, context=ssl.create_default_context()) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout) as server:
        if settings.smtp_use_tls:
            server.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


async def send_email(recipient_email: str, template: EmailTemplate) -> None:
    message = _compose_email(recipient_email, template)
    await asyncio.to_thread(_send_email_blocking, message)


async def process_candidate_confirmation_email(candidate_id: str) -> None:
    settings = get_settings()
    collection = get_resumes_collection()

    try:
        object_id = ObjectId(candidate_id)
    except Exception:
        return

    document = await collection.find_one({"_id": object_id})
    if document is None:
        return

    candidate = build_resume_record(document)
    if candidate.final_status is None:
        return

    if candidate.final_status == "Under Review" and not settings.send_under_review_emails:
        await collection.update_one(
            {"_id": object_id},
            {"$set": {"email_status": None, "email_error": None, "updated_at": datetime.now(timezone.utc)}},
        )
        return

    recipient_email = candidate.parsed_data.email if candidate.parsed_data else None
    if not recipient_email:
        await collection.update_one(
            {"_id": object_id},
            {
                "$set": {
                    "email_status": "failed",
                    "email_error": "Candidate email address is missing.",
                    "updated_at": datetime.now(timezone.utc),
                },
                "$inc": {"email_attempts": 1},
            },
        )
        return

    template = build_candidate_status_email(candidate)
    last_error: str | None = None
    attempts = settings.email_retry_count + 1

    for attempt in range(1, attempts + 1):
        try:
            await send_email(recipient_email, template)
            now = datetime.now(timezone.utc)
            await collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "email_status": "sent",
                        "email_error": None,
                        "email_sent_at": now,
                        "updated_at": now,
                    },
                    "$inc": {"email_attempts": 1},
                },
            )
            return
        except Exception as exc:
            last_error = str(exc)
            if attempt < attempts:
                await asyncio.sleep(settings.email_retry_delay_seconds)

    await collection.update_one(
        {"_id": object_id},
        {
            "$set": {
                "email_status": "failed",
                "email_error": last_error or "Unknown email delivery failure.",
                "updated_at": datetime.now(timezone.utc),
            },
            "$inc": {"email_attempts": 1},
        },
    )
