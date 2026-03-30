from app.core.celery_app import celery_app
from app.workers.pdf_tasks import _run_task, _download_input


@celery_app.task(name="app.workers.video_tasks.convert_video_task")
def convert_video_task(storage_path: str, job_id: str, target_format: str):
    from app.services.video_service import convert_video
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: convert_video(local, job_id, target_format), local)


@celery_app.task(name="app.workers.video_tasks.compress_video_task")
def compress_video_task(storage_path: str, job_id: str, quality: str):
    from app.services.video_service import compress_video
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: compress_video(local, job_id, quality), local)
