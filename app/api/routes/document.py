from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.api.deps import allowed_file, save_upload_file
from app.core.database import get_session
from app.core.celery_app import celery_app
from app.crud.job import create_job

router = APIRouter(prefix="/api/document", tags=["Document"])


@router.post("/ocr")
async def image_to_text(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Extract text from image using OCR (Tesseract)."""
    if not allowed_file(file.filename, ["jpg", "jpeg", "png", "webp", "tiff", "bmp"]):
        raise HTTPException(400, "Unsupported format. Use jpg, png, webp, tiff, or bmp")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "ocr", file.filename)
    celery_app.send_task(
        "app.workers.document_tasks.ocr_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/markdown-to-pdf")
async def markdown_to_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, ["md", "markdown"]):
        raise HTTPException(400, "Only Markdown (.md) files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "markdown_to_pdf", file.filename)
    celery_app.send_task(
        "app.workers.document_tasks.markdown_to_pdf_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/html-to-pdf")
async def html_to_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, ["html", "htm"]):
        raise HTTPException(400, "Only HTML files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "html_to_pdf", file.filename)
    celery_app.send_task(
        "app.workers.document_tasks.html_to_pdf_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/csv-to-json")
async def csv_to_json(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, ["csv"]):
        raise HTTPException(400, "Only CSV files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "csv_to_json", file.filename)
    celery_app.send_task(
        "app.workers.document_tasks.csv_to_json_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/json-to-csv")
async def json_to_csv(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, ["json"]):
        raise HTTPException(400, "Only JSON files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "json_to_csv", file.filename)
    celery_app.send_task(
        "app.workers.document_tasks.json_to_csv_task",
        args=[saved_path, job_id],
    )
    return {"job_id": job_id, "status": "queued"}
