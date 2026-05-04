import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.api.deps import allowed_file, save_upload_file
from app.core.database import get_session
from app.core.celery_app import celery_app
from app.crud.job import create_job
from app.services.audio_service import inspect_audio_metadata

router = APIRouter(prefix="/api/audio", tags=["Audio"])

AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "flac", "aac", "aiff"]
VIDEO_EXTS = ["mp4", "mov", "mkv", "avi", "webm"]
AUDIO_FORMATS = {"mp3", "wav", "ogg", "m4a", "flac", "aac", "aiff"}
QUALITIES = {"low", "medium", "high"}


@router.post("/convert")
async def convert_audio(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    quality: str = Form(default="high"),
    session: AsyncSession = Depends(get_session),
):
    """Convert audio to target format. quality: high (192k) | medium (128k) | low (96k)."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    if target_format not in AUDIO_FORMATS:
        raise HTTPException(400, f"Unsupported target format. Allowed: {sorted(AUDIO_FORMATS)}")
    if quality not in QUALITIES:
        quality = "high"
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, f"audio_convert_{target_format}", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.convert_audio_task",
        args=[saved_path, job_id, target_format, quality],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/compress")
async def compress_audio(
    file: UploadFile = File(...),
    bitrate: str = Form(default="128k"),
    session: AsyncSession = Depends(get_session),
):
    """Compress audio. Lossy formats: reduce bitrate. WAV/AIFF: transcode to MP3. FLAC: max lossless compression."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    if bitrate not in {"64k", "96k", "128k", "192k", "320k"}:
        bitrate = "128k"
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_compress", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.compress_audio_task",
        args=[saved_path, job_id, bitrate],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/trim")
async def trim_audio(
    file: UploadFile = File(...),
    start: str = Form(default="0"),
    end: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Trim audio to [start, end]. Accept 'MM:SS' or plain seconds ('90')."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    if not end:
        raise HTTPException(400, "End time is required")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_trim", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.trim_audio_task",
        args=[saved_path, job_id, start.strip(), end.strip()],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/normalize")
async def normalize_audio(
    file: UploadFile = File(...),
    target_loudness: str = Form(default="-16"),
    session: AsyncSession = Depends(get_session),
):
    """Normalize audio loudness. target_loudness: LUFS value (-14, -16, -23)."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    try:
        lufs = float(target_loudness)
        if not (-50 <= lufs <= -1):
            lufs = -16.0
    except (ValueError, TypeError):
        lufs = -16.0
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_normalize", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.normalize_audio_task",
        args=[saved_path, job_id, lufs],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/change-speed")
async def change_speed_audio(
    file: UploadFile = File(...),
    speed: str = Form(default="1.5"),
    session: AsyncSession = Depends(get_session),
):
    """Change audio speed without pitch shift. speed: 0.25–4.0 (1.0 = original)."""
    if not allowed_file(file.filename, AUDIO_EXTS):
        raise HTTPException(400, f"Unsupported audio format. Allowed: {AUDIO_EXTS}")
    try:
        speed_float = float(speed)
        if not (0.25 <= speed_float <= 4.0):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(400, "Speed must be between 0.25 and 4.0")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_change_speed", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.change_speed_audio_task",
        args=[saved_path, job_id, speed_float],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


AUDIO_OUTPUT_FORMATS = {"mp3", "aac", "wav", "ogg", "flac", "m4a"}
AUDIO_QUALITIES = {"low", "medium", "high"}


@router.post("/extract-from-video")
async def extract_audio_from_video(
    file: UploadFile = File(...),
    format: str = Form(default="mp3"),
    quality: str = Form(default="high"),
    session: AsyncSession = Depends(get_session),
):
    """Extract audio track from a video file."""
    if not allowed_file(file.filename, VIDEO_EXTS):
        raise HTTPException(400, f"Unsupported video format. Allowed: {', '.join(VIDEO_EXTS)}")
    if format not in AUDIO_OUTPUT_FORMATS:
        format = "mp3"
    if quality not in AUDIO_QUALITIES:
        quality = "high"
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "audio_extract", file.filename)
    celery_app.send_task(
        "app.workers.audio_tasks.extract_audio_task",
        args=[saved_path, job_id, format, quality],
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
