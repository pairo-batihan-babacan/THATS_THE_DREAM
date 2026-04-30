import os
import time
from app.core.celery_app import celery_app
from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _download_input(local_path: str, job_id: str, index: int = 0) -> str:
    """
    File is already on local disk (uploaded directly to UPLOAD_DIR).
    Returns the path as-is.
    """
    return local_path


def _run_task(job_id: str, conversion_fn, local_input_paths):
    """
    1. Sets job status to 'processing' in Redis.
    2. Runs conversion_fn() — must return output_filename written to OUTPUT_DIR.
    3. Sets job status to 'done' in Redis.
    4. Deletes the local input file(s).
    Output file stays on disk until the cleanup task removes it after TTL.

    local_input_paths: str or list[str]
    """
    import redis as redis_lib
    import json

    r = redis_lib.from_url(settings.REDIS_URL)
    status_key = f"job_status:{job_id}"
    r.set(status_key, json.dumps({"status": "processing"}), ex=3600)

    try:
        output_filename = conversion_fn()

        r.set(
            status_key,
            json.dumps({"status": "done", "output_filename": output_filename}),
            ex=3600,
        )

        inputs = local_input_paths if isinstance(local_input_paths, list) else [local_input_paths]
        for p in inputs:
            if p and os.path.exists(p):
                os.remove(p)

    except Exception as e:
        r.set(
            status_key,
            json.dumps({"status": "failed", "error": str(e)}),
            ex=3600,
        )


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@celery_app.task(name="app.workers.pdf_tasks.compress_pdf_task")
def compress_pdf_task(local_path: str, job_id: str, quality: str = "medium"):
    from app.services.pdf_service import compress_pdf
    _run_task(job_id, lambda: compress_pdf(local_path, job_id, quality), local_path)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_word_task")
def pdf_to_word_task(local_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_word
    _run_task(job_id, lambda: pdf_to_word(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_images_task")
def pdf_to_images_task(local_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_images
    _run_task(job_id, lambda: pdf_to_images(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.images_to_pdf_task")
def images_to_pdf_task(local_paths: list[str], job_id: str):
    from app.services.pdf_service import images_to_pdf
    _run_task(job_id, lambda: images_to_pdf(local_paths, job_id), local_paths)


@celery_app.task(name="app.workers.pdf_tasks.merge_pdfs_task")
def merge_pdfs_task(local_paths: list[str], job_id: str):
    from app.services.pdf_service import merge_pdfs
    _run_task(job_id, lambda: merge_pdfs(local_paths, job_id), local_paths)


@celery_app.task(name="app.workers.pdf_tasks.split_pdf_task")
def split_pdf_task(local_path: str, job_id: str, pages: str):
    from app.services.pdf_service import split_pdf
    _run_task(job_id, lambda: split_pdf(local_path, job_id, pages), local_path)


@celery_app.task(name="app.workers.pdf_tasks.strip_pdf_metadata_task")
def strip_pdf_metadata_task(local_path: str, job_id: str):
    from app.services.pdf_service import strip_pdf_metadata
    _run_task(job_id, lambda: strip_pdf_metadata(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.word_to_pdf_task")
def word_to_pdf_task(local_path: str, job_id: str):
    from app.services.pdf_service import word_to_pdf
    _run_task(job_id, lambda: word_to_pdf(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.ppt_to_pdf_task")
def ppt_to_pdf_task(local_path: str, job_id: str):
    from app.services.pdf_service import ppt_to_pdf
    _run_task(job_id, lambda: ppt_to_pdf(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.excel_to_pdf_task")
def excel_to_pdf_task(local_path: str, job_id: str):
    from app.services.pdf_service import excel_to_pdf
    _run_task(job_id, lambda: excel_to_pdf(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.unlock_pdf_task")
def unlock_pdf_task(local_path: str, job_id: str, password: str = ""):
    from app.services.pdf_service import unlock_pdf
    _run_task(job_id, lambda: unlock_pdf(local_path, job_id, password), local_path)


@celery_app.task(name="app.workers.pdf_tasks.rotate_pdf_task")
def rotate_pdf_task(local_path: str, job_id: str, rotations: dict):
    from app.services.pdf_service import rotate_pdf
    _run_task(job_id, lambda: rotate_pdf(local_path, job_id, rotations), local_path)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_excel_task")
def pdf_to_excel_task(local_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_excel
    _run_task(job_id, lambda: pdf_to_excel(local_path, job_id), local_path)


@celery_app.task(name="app.workers.pdf_tasks.cleanup_expired_files")
def cleanup_expired_files():
    """Delete files older than FILE_TTL_MINUTES from UPLOAD_DIR and OUTPUT_DIR."""
    cutoff = time.time() - (settings.FILE_TTL_MINUTES * 60)
    deleted = 0

    for directory in (settings.UPLOAD_DIR, settings.OUTPUT_DIR):
        if not os.path.isdir(directory):
            continue
        for fname in os.listdir(directory):
            fpath = os.path.join(directory, fname)
            try:
                if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
                    os.remove(fpath)
                    deleted += 1
            except OSError:
                pass

    return {"deleted_files": deleted}
