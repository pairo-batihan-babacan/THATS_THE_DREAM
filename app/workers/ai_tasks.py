from app.core.celery_app import celery_app
from app.workers.pdf_tasks import _run_task, _download_input


@celery_app.task(name="app.workers.ai_tasks.translate_pdf_task")
def translate_pdf_task(storage_path: str, job_id: str, target_language: str):
    from app.services.ai_service import translate_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: translate_pdf(local, job_id, target_language), local)
