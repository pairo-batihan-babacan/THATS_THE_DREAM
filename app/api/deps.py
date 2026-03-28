import os
import re
import uuid
import asyncio
import tempfile
import unicodedata
from fastapi import UploadFile, HTTPException
from app.core.config import settings
from app.core import storage

# Manual transliteration for characters that NFKD decomposition doesn't handle
_TRANSLITERATION = str.maketrans(
    "ıİğĞüÜşŞöÖçÇ",
    "iIgGuUsSoOcC",
)


def sanitize_filename(filename: str) -> str:
    """Make a filename safe for cross-container use (ASCII-only, no spaces/specials)."""
    name, ext = os.path.splitext(filename)
    name = name.translate(_TRANSLITERATION)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    if not name:
        name = "upload"
    ext = ext.lower()
    ext = re.sub(r"[^a-z0-9.]", "", ext)
    return name + ext


def allowed_file(filename: str, allowed: list[str]) -> bool:
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    return ext in allowed


async def save_upload_file(file: UploadFile) -> tuple[str, str]:
    """
    Stream the uploaded file to a temp file on disk, enforce size limit, then upload
    to Supabase Storage from a file handle — never loads the full file into RAM.
    Returns (job_id, storage_path).
    """
    job_id = str(uuid.uuid4())
    original = os.path.basename(file.filename or "upload")
    storage_path = f"{job_id}_{sanitize_filename(original)}"
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    suffix = os.path.splitext(original)[1]
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        total = 0
        with os.fdopen(fd, "wb") as tmp:
            while True:
                chunk = await file.read(256 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB.",
                    )
                tmp.write(chunk)

        with open(tmp_path, "rb") as f:
            await asyncio.to_thread(
                storage.upload_file,
                settings.MINIO_UPLOADS_BUCKET,
                storage_path,
                f,
            )
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return job_id, storage_path


async def save_multiple_files(files: list[UploadFile]) -> tuple[str, list[str]]:
    """
    Save multiple files to Supabase Storage under a shared job_id.
    Streams each file to disk before uploading to keep RAM usage flat.
    Returns (job_id, list_of_storage_paths).
    """
    job_id = str(uuid.uuid4())
    storage_paths = []
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    for i, file in enumerate(files):
        original = os.path.basename(file.filename or "upload")
        storage_path = f"{job_id}_{i}_{sanitize_filename(original)}"

        suffix = os.path.splitext(original)[1]
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        try:
            total = 0
            with os.fdopen(fd, "wb") as tmp:
                while True:
                    chunk = await file.read(256 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"{file.filename} too large. Max {settings.MAX_FILE_SIZE_MB}MB.",
                        )
                    tmp.write(chunk)

            with open(tmp_path, "rb") as f:
                await asyncio.to_thread(
                    storage.upload_file,
                    settings.MINIO_UPLOADS_BUCKET,
                    storage_path,
                    f,
                )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        storage_paths.append(storage_path)

    return job_id, storage_paths
