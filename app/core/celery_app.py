from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "fileconvert",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.pdf_tasks",
        "app.workers.image_tasks",
        "app.workers.audio_tasks",
        "app.workers.video_tasks",
        "app.workers.document_tasks",
        "app.workers.ai_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.pdf_tasks.*": {"queue": "default"},
        "app.workers.image_tasks.*": {"queue": "default"},
        "app.workers.audio_tasks.*": {"queue": "heavy"},
        "app.workers.video_tasks.*": {"queue": "heavy"},
        "app.workers.document_tasks.*": {"queue": "default"},
        "app.workers.ai_tasks.*": {"queue": "default"},
    },
    beat_schedule={
        "cleanup-expired-files": {
            "task": "app.workers.pdf_tasks.cleanup_expired_files",
            "schedule": 900.0,  # every 15 minutes
        },
    },
)
