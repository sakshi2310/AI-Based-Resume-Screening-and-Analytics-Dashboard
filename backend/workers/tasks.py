from __future__ import annotations

from celery import Celery

from config.settings import get_settings
from models.job import JobCreate
from ml.pipeline import ResumeScreeningPipeline

settings = get_settings()
celery_app = Celery("resume_intelligence", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_always_eager = settings.celery_task_always_eager
pipeline = ResumeScreeningPipeline()


@celery_app.task(name="workers.tasks.screen_resume_text")
def screen_resume_text_task(resume_text: str, job_payload: dict, source_name: str = "async_resume.txt") -> dict:
    job = JobCreate.model_validate(job_payload)
    response = pipeline.screen_resume_text(resume_text=resume_text, job=job, source_name=source_name)
    return response.model_dump(mode="json")
