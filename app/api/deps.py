import os
import re
import uuid
import unicodedata
from fastapi import UploadFile, HTTPException
from app.core.config import settings

# Manual transliteration for characters that NFKD decomposition doesn't handle
_TRANSLITERATION = str.maketrans(
    "ıİğĞüÜşŞöÖçÇ",
    "iIgGuUsSoOcC",
)


def sanitize_filename(filename: str) -> str:
    """Make a filename safe (ASCII-only, no spaces/specials)."""
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
    Stream the uploaded file directly to UPLOAD_DIR on disk.
    Returns (job_id, local_path).
    """
    job_id = str(uuid.uuid4())
    original = os.path.basename(file.filename or "upload")
    filename = f"{job_id}_{sanitize_filename(original)}"
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    local_path = os.path.join(settings.UPLOAD_DIR, filename)

    total = 0
    try:
        with open(local_path, "wb") as f:
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
                f.write(chunk)
    except HTTPException:
        if os.path.exists(local_path):
            os.unlink(local_path)
        raise

    return job_id, local_path


async def save_multiple_files(files: list[UploadFile]) -> tuple[str, list[str]]:
    """
    Save multiple files to UPLOAD_DIR under a shared job_id.
    Returns (job_id, list_of_local_paths).
    """
    job_id = str(uuid.uuid4())
    local_paths = []
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    for i, file in enumerate(files):
        original = os.path.basename(file.filename or "upload")
        filename = f"{job_id}_{i}_{sanitize_filename(original)}"
        local_path = os.path.join(settings.UPLOAD_DIR, filename)

        total = 0
        try:
            with open(local_path, "wb") as f:
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
                    f.write(chunk)
        except HTTPException:
            if os.path.exists(local_path):
                os.unlink(local_path)
            raise

        local_paths.append(local_path)

    return job_id, local_paths
