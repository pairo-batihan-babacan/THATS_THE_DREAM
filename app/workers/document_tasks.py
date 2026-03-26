from app.core.celery_app import celery_app
from app.workers.pdf_tasks import _run_task, _download_input


@celery_app.task(name="app.workers.document_tasks.ocr_task")
def ocr_task(storage_path: str, job_id: str):
    from app.services.document_service import ocr_image
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: ocr_image(local, job_id), local)


@celery_app.task(name="app.workers.document_tasks.markdown_to_pdf_task")
def markdown_to_pdf_task(storage_path: str, job_id: str):
    from app.services.document_service import markdown_to_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: markdown_to_pdf(local, job_id), local)


@celery_app.task(name="app.workers.document_tasks.html_to_pdf_task")
def html_to_pdf_task(storage_path: str, job_id: str):
    from app.services.document_service import html_to_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: html_to_pdf(local, job_id), local)


@celery_app.task(name="app.workers.document_tasks.csv_to_json_task")
def csv_to_json_task(storage_path: str, job_id: str):
    from app.services.document_service import csv_to_json
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: csv_to_json(local, job_id), local)


@celery_app.task(name="app.workers.document_tasks.json_to_csv_task")
def json_to_csv_task(storage_path: str, job_id: str):
    from app.services.document_service import json_to_csv
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: json_to_csv(local, job_id), local)
