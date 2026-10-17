from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.models.job import Job, JobStatus
from datetime import datetime, timedelta, timezone
from app.core.config import settings


async def create_job(
    session: AsyncSession,
    job_id: str,
    conversion_type: str,
    input_filename: str,
    user_id: int | None = None,
) -> Job:
    job = Job(
        job_id=job_id,
        conversion_type=conversion_type,
        input_filename=input_filename,
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.FILE_TTL_MINUTES),
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def get_job(session: AsyncSession, job_id: str) -> Job | None:
    result = await session.exec(select(Job).where(Job.job_id == job_id))
    return result.first()


async def update_job_status(
    session: AsyncSession,
    job_id: str,
    status: JobStatus,
    output_filename: str | None = None,
    error_message: str | None = None,
) -> None:
    result = await session.exec(select(Job).where(Job.job_id == job_id))
    job = result.first()
    if job:
        job.status = status
        if output_filename:
            job.output_filename = output_filename
        if error_message:
            job.error_message = error_message
        session.add(job)
        await session.commit()


async def get_expired_jobs(session: AsyncSession) -> list[Job]:
    result = await session.exec(
        select(Job).where(Job.expires_at < datetime.now(timezone.utc))
    )
    return list(result.all())