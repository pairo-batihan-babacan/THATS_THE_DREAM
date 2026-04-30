from app.core.celery_app import celery_app
from app.workers.pdf_tasks import _run_task, _download_input


@celery_app.task(name="app.workers.audio_tasks.convert_audio_task")
def convert_audio_task(storage_path: str, job_id: str, target_format: str):
    from app.services.audio_service import convert_audio
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: convert_audio(local, job_id, target_format), local)


@celery_app.task(name="app.workers.audio_tasks.compress_audio_task")
def compress_audio_task(storage_path: str, job_id: str, bitrate: str):
    from app.services.audio_service import compress_audio
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: compress_audio(local, job_id, bitrate), local)


@celery_app.task(name="app.workers.audio_tasks.extract_audio_task")
def extract_audio_task(storage_path: str, job_id: str, fmt: str = "mp3", quality: str = "high"):
    from app.services.audio_service import extract_audio
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: extract_audio(local, job_id, fmt, quality), local)


@celery_app.task(name="app.workers.audio_tasks.strip_metadata_task")
def strip_metadata_task(storage_path: str, job_id: str):
    from app.services.audio_service import strip_audio_metadata
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: strip_audio_metadata(local, job_id), local)
