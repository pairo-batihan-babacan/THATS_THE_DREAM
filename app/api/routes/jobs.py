import asyncio
import io
import json
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.database import get_session
from app.crud.job import get_job, update_job_status
from app.models.job import JobStatus
from app.core.config import settings
from app.core import storage

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


async def _get_redis():
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    session: AsyncSession = Depends(get_session),
    r: aioredis.Redis = Depends(_get_redis),
):
    # Check Redis first for real-time status from the worker
    redis_data = await r.get(f"job_status:{job_id}")
    if redis_data:
        data = json.loads(redis_data)
        status = data.get("status")
        output_filename = data.get("output_filename")
        error = data.get("error")

        # Sync the DB record so history is accurate
        job_status = JobStatus(status)
        await update_job_status(session, job_id, job_status, output_filename, error)

        return {
            "job_id": job_id,
            "status": status,
            "output_filename": output_filename,
            "error_message": error,
            "download_url": f"/api/jobs/{job_id}/download" if status == "done" else None,
        }

    # Fallback to DB
    job = await get_job(session, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "output_filename": job.output_filename,
        "error_message": job.error_message,
        "download_url": f"/api/jobs/{job_id}/download" if job.status == JobStatus.DONE else None,
    }


@router.get("/{job_id}/download")
async def download_result(
    job_id: str,
    session: AsyncSession = Depends(get_session),
    r: aioredis.Redis = Depends(_get_redis),
):
    # Check Redis for output filename
    output_filename = None
    redis_data = await r.get(f"job_status:{job_id}")
    if redis_data:
        data = json.loads(redis_data)
        if data.get("status") != "done":
            raise HTTPException(400, f"Job is not done yet (status: {data.get('status')})")
        output_filename = data.get("output_filename")
    else:
        job = await get_job(session, job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        if job.status != JobStatus.DONE:
            raise HTTPException(400, f"Job is not done yet (status: {job.status})")
        output_filename = job.output_filename

    if not output_filename:
        raise HTTPException(404, "Output file not found")

    try:
        data = await asyncio.to_thread(
            storage.download_file,
            settings.SUPABASE_OUTPUTS_BUCKET,
            output_filename,
        )
    except Exception:
        raise HTTPException(404, "Output file has expired or been deleted")

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )
