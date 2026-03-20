import os
import re
import uuid
import asyncio
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
    Read the uploaded file, enforce size limit, upload to Supabase Storage.
    Returns (job_id, storage_path) where storage_path is the key inside the uploads bucket.
    """
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)

    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB.",
        )

    job_id = str(uuid.uuid4())
    original = os.path.basename(file.filename or "upload")
    storage_path = f"{job_id}_{sanitize_filename(original)}"

    await asyncio.to_thread(
        storage.upload_file,
        settings.SUPABASE_UPLOADS_BUCKET,
        storage_path,
        contents,
    )

    return job_id, storage_path


async def save_multiple_files(files: list[UploadFile]) -> tuple[str, list[str]]:
    """
    Save multiple files to Supabase Storage under a shared job_id.
    Returns (job_id, list_of_storage_paths).
    """
    job_id = str(uuid.uuid4())
    storage_paths = []

    for i, file in enumerate(files):
        contents = await file.read()
        size_mb = len(contents) / (1024 * 1024)

        if size_mb > settings.MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"{file.filename} too large. Max {settings.MAX_FILE_SIZE_MB}MB.",
            )

        original = os.path.basename(file.filename or "upload")
        storage_path = f"{job_id}_{i}_{sanitize_filename(original)}"

        await asyncio.to_thread(
            storage.upload_file,
            settings.SUPABASE_UPLOADS_BUCKET,
            storage_path,
            contents,
        )

        storage_paths.append(storage_path)

    return job_id, storage_paths
