import os
from app.core.celery_app import celery_app
from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _download_input(storage_path: str, job_id: str, index: int = 0) -> str:
    """
    Stream a file from the uploads bucket directly to a local temp path.
    Returns the local file path. No bytes are held in RAM.
    """
    from app.core.storage import download_file_to_path

    ext = os.path.splitext(storage_path)[1]
    local_path = f"/tmp/{job_id}_input_{index}{ext}"
    download_file_to_path(settings.MINIO_UPLOADS_BUCKET, storage_path, local_path)
    return local_path


def _run_task(job_id: str, conversion_fn, local_input_paths):
    """
    Wrapper that:
    1. Updates job status in Redis.
    2. Runs conversion_fn() which returns output_filename (written to OUTPUT_DIR).
    3. Uploads the output file to Supabase Storage outputs bucket.
    4. Cleans up local temp files.

    local_input_paths: str or list[str] — local paths to delete after success.
    """
    import redis as redis_lib
    import json
    from app.core.storage import upload_file, delete_file

    r = redis_lib.from_url(settings.REDIS_URL)
    status_key = f"job_status:{job_id}"
    r.set(status_key, json.dumps({"status": "processing"}), ex=3600)

    try:
        output_filename = conversion_fn()

        # Upload output to Supabase Storage via file handle — no bytes in RAM
        local_output_path = os.path.join(settings.OUTPUT_DIR, output_filename)
        with open(local_output_path, "rb") as f:
            upload_file(settings.MINIO_OUTPUTS_BUCKET, output_filename, f)

        r.set(
            status_key,
            json.dumps({"status": "done", "output_filename": output_filename}),
            ex=3600,
        )

        # Clean up local input file(s)
        inputs = local_input_paths if isinstance(local_input_paths, list) else [local_input_paths]
        for p in inputs:
            if p and os.path.exists(p):
                os.remove(p)

        # Clean up local output file
        if os.path.exists(local_output_path):
            os.remove(local_output_path)

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
def compress_pdf_task(storage_path: str, job_id: str, quality: str = "medium"):
    from app.services.pdf_service import compress_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: compress_pdf(local, job_id, quality), local)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_word_task")
def pdf_to_word_task(storage_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_word
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: pdf_to_word(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_images_task")
def pdf_to_images_task(storage_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_images
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: pdf_to_images(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.images_to_pdf_task")
def images_to_pdf_task(storage_paths: list[str], job_id: str):
    from app.services.pdf_service import images_to_pdf
    local_paths = [_download_input(sp, job_id, i) for i, sp in enumerate(storage_paths)]
    _run_task(job_id, lambda: images_to_pdf(local_paths, job_id), local_paths)


@celery_app.task(name="app.workers.pdf_tasks.merge_pdfs_task")
def merge_pdfs_task(storage_paths: list[str], job_id: str):
    from app.services.pdf_service import merge_pdfs
    local_paths = [_download_input(sp, job_id, i) for i, sp in enumerate(storage_paths)]
    _run_task(job_id, lambda: merge_pdfs(local_paths, job_id), local_paths)


@celery_app.task(name="app.workers.pdf_tasks.split_pdf_task")
def split_pdf_task(storage_path: str, job_id: str, pages: str):
    from app.services.pdf_service import split_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: split_pdf(local, job_id, pages), local)


@celery_app.task(name="app.workers.pdf_tasks.strip_pdf_metadata_task")
def strip_pdf_metadata_task(storage_path: str, job_id: str):
    from app.services.pdf_service import strip_pdf_metadata
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: strip_pdf_metadata(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.word_to_pdf_task")
def word_to_pdf_task(storage_path: str, job_id: str):
    from app.services.pdf_service import word_to_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: word_to_pdf(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.ppt_to_pdf_task")
def ppt_to_pdf_task(storage_path: str, job_id: str):
    from app.services.pdf_service import ppt_to_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: ppt_to_pdf(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.excel_to_pdf_task")
def excel_to_pdf_task(storage_path: str, job_id: str):
    from app.services.pdf_service import excel_to_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: excel_to_pdf(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.unlock_pdf_task")
def unlock_pdf_task(storage_path: str, job_id: str, password: str = ""):
    from app.services.pdf_service import unlock_pdf
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: unlock_pdf(local, job_id, password), local)


@celery_app.task(name="app.workers.pdf_tasks.pdf_to_excel_task")
def pdf_to_excel_task(storage_path: str, job_id: str):
    from app.services.pdf_service import pdf_to_excel
    local = _download_input(storage_path, job_id)
    _run_task(job_id, lambda: pdf_to_excel(local, job_id), local)


@celery_app.task(name="app.workers.pdf_tasks.cleanup_expired_files")
def cleanup_expired_files():
    """Delete files older than FILE_TTL_MINUTES from both Supabase Storage buckets."""
    from app.core.storage import delete_old_files

    deleted = 0
    deleted += delete_old_files(settings.MINIO_UPLOADS_BUCKET, settings.FILE_TTL_MINUTES)
    deleted += delete_old_files(settings.MINIO_OUTPUTS_BUCKET, settings.FILE_TTL_MINUTES)
    return {"deleted_files": deleted}
