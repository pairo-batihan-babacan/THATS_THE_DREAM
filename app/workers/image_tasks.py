from app.core.celery_app import celery_app
from app.workers.pdf_tasks import _run_task, _download_input


@celery_app.task(name="app.workers.image_tasks.convert_image_task")
def convert_image_task(storage_path: str, job_id: str, target_format: str):
    from app.services.image_service import convert_image
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: convert_image(local, job_id, target_format), local)


@celery_app.task(name="app.workers.image_tasks.compress_image_task")
def compress_image_task(storage_path: str, job_id: str, quality: int):
    from app.services.image_service import compress_image
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: compress_image(local, job_id, quality), local)


@celery_app.task(name="app.workers.image_tasks.resize_image_task")
def resize_image_task(storage_path: str, job_id: str, width: int, height: int):
    from app.services.image_service import resize_image
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: resize_image(local, job_id, width, height), local)


@celery_app.task(name="app.workers.image_tasks.strip_metadata_task")
def strip_metadata_task(storage_path: str, job_id: str):
    from app.services.image_service import strip_image_metadata
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: strip_image_metadata(local, job_id), local)


@celery_app.task(name="app.workers.image_tasks.svg_to_png_task")
def svg_to_png_task(storage_path: str, job_id: str):
    from app.services.image_service import svg_to_png
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: svg_to_png(local, job_id), local)
