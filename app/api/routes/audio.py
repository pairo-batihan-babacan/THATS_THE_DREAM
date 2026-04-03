import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.api.deps import allowed_file, save_upload_file
from app.core.database import get_session
from app.core.celery_app import celery_app
from app.crud.job import create_job
from app.services.audio_service import inspect_audio_metadata

router = APIRouter(prefix="/api/audio", tags=["Audio"])

AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "flac", "aac"]
VIDEO_EXTS = ["mp4", "mov", "mkv", "avi", "webm"]


@router.post("/convert")
async def convert_audio(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Convert audio to target format. target_format: mp3, wav, ogg, m4a, flac"""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    if target_format not in AUDIO_EXTS:
        raise HTTPException(400, f"Unsupported target format. Allowed: {AUDIO_EXTS}")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, f"audio_convert_{target_format}", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.convert_audio_task",
        args=[saved_path, job_id, target_format],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/compress")
async def compress_audio(
    file: UploadFile = File(...),
    bitrate: str = Form(default="128k"),
    session: AsyncSession = Depends(get_session),
):
    """Compress audio by reducing bitrate. bitrate: 64k, 128k, 192k, 320k"""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_compress", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.compress_audio_task",
        args=[saved_path, job_id, bitrate],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/extract-from-video")
async def extract_audio(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Extract MP3 audio from a video file."""
    if not allowed_file(file.filename, VIDEO_EXTS):
        raise HTTPException(400, f"Unsupported video format. Allowed: {VIDEO_EXTS}")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_extract", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.extract_audio_task",
        args=[saved_path, job_id],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/strip-metadata")
async def strip_audio_metadata(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Remove all ID3 tags / metadata from audio file."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_strip_metadata", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.strip_metadata_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/inspect-metadata")
async def inspect_audio_metadata_endpoint(file: UploadFile = File(...)):
    """Read ID3/metadata tags from an audio file without creating a job."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    content = await file.read()
    try:
        metadata = inspect_audio_metadata(content, ext)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    return {"metadata": metadata, "count": len(metadata)}
