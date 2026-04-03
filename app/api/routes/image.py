from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.api.deps import allowed_file, save_upload_file, save_multiple_files
from app.core.database import get_session
from app.core.celery_app import celery_app
from app.crud.job import create_job
from app.services.image_service import inspect_image_metadata

router = APIRouter(prefix="/api/image", tags=["Image"])

IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "gif", "bmp", "tiff"]
SVG_EXTS = ["svg"]


@router.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Convert image to target format. target_format: jpg, png, webp, bmp, tiff"""
    if not allowed_file(file.filename, IMAGE_EXTS + SVG_EXTS):
        raise HTTPException(400, "Unsupported image format")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, f"image_convert_{target_format}", file.filename)
    celery_app.send_task(
        "app.workers.image_tasks.convert_image_task",
        args=[saved_path, job_id, target_format],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/compress")
async def compress_image(
    file: UploadFile = File(...),
    quality: int = Form(default=75),
    session: AsyncSession = Depends(get_session),
):
    """Compress image. quality: 1-95 (lower = smaller file)"""
    if not allowed_file(file.filename, IMAGE_EXTS):
        raise HTTPException(400, "Unsupported image format")
    if not 1 <= quality <= 95:
        raise HTTPException(400, "Quality must be between 1 and 95")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "image_compress", file.filename)
    celery_app.send_task(
        "app.workers.image_tasks.compress_image_task",
        args=[saved_path, job_id, quality],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/resize")
async def resize_image(
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, IMAGE_EXTS):
        raise HTTPException(400, "Unsupported image format")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "image_resize", file.filename)
    celery_app.send_task(
        "app.workers.image_tasks.resize_image_task",
        args=[saved_path, job_id, width, height],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/strip-metadata")
async def strip_image_metadata(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Remove EXIF metadata (GPS, camera model, timestamp) from image."""
    if not allowed_file(file.filename, IMAGE_EXTS):
        raise HTTPException(400, "Unsupported image format")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "image_strip_metadata", file.filename)
    celery_app.send_task(
        "app.workers.image_tasks.strip_metadata_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/inspect-metadata")
async def inspect_image_metadata_endpoint(file: UploadFile = File(...)):
    """Read EXIF/metadata fields from an image without creating a job."""
    if not allowed_file(file.filename, IMAGE_EXTS):
        raise HTTPException(400, "Unsupported image format")
    content = await file.read()
    try:
        metadata = inspect_image_metadata(content)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    return {"metadata": metadata, "count": len(metadata)}


@router.post("/to-pdf")
async def images_to_pdf(
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
):
    for f in files:
        if not allowed_file(f.filename, ["jpg", "jpeg", "png"]):
            raise HTTPException(400, f"{f.filename} is not a supported image (jpg, png)")
    job_id, saved_paths = await save_multiple_files(files)
    await create_job(session, job_id, "images_to_pdf", files[0].filename)
    celery_app.send_task(
        "app.workers.pdf_tasks.images_to_pdf_task",
        args=[saved_paths, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/svg-to-png")
async def svg_to_png(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, SVG_EXTS):
        raise HTTPException(400, "Only SVG files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "svg_to_png", file.filename)
    celery_app.send_task(
        "app.workers.image_tasks.svg_to_png_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}
