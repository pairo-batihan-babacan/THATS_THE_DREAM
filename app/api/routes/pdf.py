from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.api.deps import allowed_file, save_upload_file, save_multiple_files
from app.core.database import get_session
from app.core.celery_app import celery_app
from app.crud.job import create_job
from app.services.pdf_service import inspect_pdf_metadata

router = APIRouter(prefix="/api/pdf", tags=["PDF"])

PDF_EXTS = ["pdf"]
IMAGE_EXTS = ["jpg", "jpeg", "png"]
OFFICE_EXTS = ["docx", "doc"]
PPT_EXTS = ["pptx", "ppt"]
EXCEL_EXTS = ["xlsx", "xls"]


@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = Form(default="medium"),
    session: AsyncSession = Depends(get_session),
):
    """Compress PDF. quality: low | medium | high"""
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    if quality not in ("low", "medium", "high"):
        quality = "medium"
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_compress", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.compress_pdf_task", args=[saved_path, job_id, quality])
    return {"job_id": job_id, "status": "queued"}


@router.post("/to-word")
async def pdf_to_word(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_to_word", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.pdf_to_word_task", args=[saved_path, job_id])
    return {"job_id": job_id, "status": "queued"}


@router.post("/to-images")
async def pdf_to_images(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_to_images", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.pdf_to_images_task", args=[saved_path, job_id])
    return {"job_id": job_id, "status": "queued"}


@router.post("/from-images")
async def images_to_pdf(
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
):
    for f in files:
        if not allowed_file(f.filename, IMAGE_EXTS):
            raise HTTPException(400, f"{f.filename} is not a supported image (jpg, jpeg, png)")
    job_id, saved_paths = await save_multiple_files(files)
    await create_job(session, job_id, "images_to_pdf", files[0].filename)
    celery_app.send_task("app.workers.pdf_tasks.images_to_pdf_task", args=[saved_paths, job_id])
    return {"job_id": job_id, "status": "queued"}


@router.post("/merge")
async def merge_pdfs(
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
):
    if len(files) < 2:
        raise HTTPException(400, "At least 2 PDF files required to merge")
    for f in files:
        if not allowed_file(f.filename, PDF_EXTS):
            raise HTTPException(400, f"{f.filename} is not a PDF")
    job_id, saved_paths = await save_multiple_files(files)
    await create_job(session, job_id, "pdf_merge", files[0].filename)
    celery_app.send_task("app.workers.pdf_tasks.merge_pdfs_task", args=[saved_paths, job_id])
    return {"job_id": job_id, "status": "queued"}


@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    pages: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Split PDF by page range. pages format: '1-3,5,7-9'"""
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_split", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.split_pdf_task", args=[saved_path, job_id, pages])
    return {"job_id": job_id, "status": "queued"}


@router.post("/strip-metadata")
async def strip_pdf_metadata(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_strip_metadata", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.strip_pdf_metadata_task", args=[saved_path, job_id])
    return {"job_id": job_id, "status": "queued"}


@router.post("/inspect-metadata")
async def inspect_pdf_metadata_endpoint(file: UploadFile = File(...)):
    """Read metadata fields from a PDF without creating a job."""
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    content = await file.read()
    try:
        metadata = inspect_pdf_metadata(content)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    return {"metadata": metadata, "count": len(metadata)}


@router.post("/word-to-pdf")
async def word_to_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not allowed_file(file.filename, OFFICE_EXTS):
        raise HTTPException(400, "Only DOCX/DOC files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "word_to_pdf", file.filename)
    celery_app.send_task(
        "app.workers.pdf_tasks.word_to_pdf_task",
        args=[saved_path, job_id],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/ppt-to-pdf")
async def ppt_to_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Convert PowerPoint (PPT/PPTX) to PDF using LibreOffice."""
    if not allowed_file(file.filename, PPT_EXTS):
        raise HTTPException(400, "Only PPT/PPTX files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "ppt_to_pdf", file.filename)
    celery_app.send_task(
        "app.workers.pdf_tasks.ppt_to_pdf_task",
        args=[saved_path, job_id],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/excel-to-pdf")
async def excel_to_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Convert Excel spreadsheet (XLS/XLSX) to PDF using LibreOffice."""
    if not allowed_file(file.filename, EXCEL_EXTS):
        raise HTTPException(400, "Only XLS/XLSX files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "excel_to_pdf", file.filename)
    celery_app.send_task(
        "app.workers.pdf_tasks.excel_to_pdf_task",
        args=[saved_path, job_id],
        queue="heavy",
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
):
    """Remove password protection from a PDF. Supply the password if known."""
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_unlock", file.filename)
    celery_app.send_task(
        "app.workers.pdf_tasks.unlock_pdf_task",
        args=[saved_path, job_id, password],
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/to-excel")
async def pdf_to_excel(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Extract text content from a PDF and export it as an Excel spreadsheet."""
    if not allowed_file(file.filename, PDF_EXTS):
        raise HTTPException(400, "Only PDF files accepted")
    job_id, saved_path = await save_upload_file(file)
    await create_job(session, job_id, "pdf_to_excel", file.filename)
    celery_app.send_task("app.workers.pdf_tasks.pdf_to_excel_task", args=[saved_path, job_id])
    return {"job_id": job_id, "status": "queued"}
