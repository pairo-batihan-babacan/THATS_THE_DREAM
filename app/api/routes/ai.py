import io
import os
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import save_upload_file
from app.core.celery_app import celery_app
from app.core.database import get_session
from app.crud.job import create_job

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Free Groq tier: 6 000 TPM.
# ~4 chars ≈ 1 token → 4 500 chars ≈ 1 125 tokens input.
SAMPLE_CHARS = 4_500

DETAIL_CONFIG = {
    "brief": {
        "max_tokens": 400,
        "instruction": (
            "Be very concise. Write 2-3 sentence overview, then 3-5 bullet points maximum. "
            "Focus only on the most essential points."
        ),
    },
    "standard": {
        "max_tokens": 750,
        "instruction": (
            "Write a clear one-paragraph overview, then 6-8 bullet points covering "
            "the key themes and findings."
        ),
    },
    "detailed": {
        "max_tokens": 1400,
        "instruction": (
            "Write a thorough 2-3 paragraph overview, then a comprehensive list of bullet points "
            "covering all major themes, arguments, key figures, conclusions, and any notable details. "
            "Be as complete as possible."
        ),
    },
}


def _extract_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    parts = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(parts)


def _sample(text: str) -> tuple[str, bool]:
    """Return a representative sample and whether sampling was applied."""
    if len(text) <= SAMPLE_CHARS:
        return text, False

    # 55% from start (intro/abstract), 30% from middle, 15% from end (conclusion)
    start_n = int(SAMPLE_CHARS * 0.55)
    mid_n   = int(SAMPLE_CHARS * 0.30)
    end_n   = SAMPLE_CHARS - start_n - mid_n

    mid_pos = (len(text) - mid_n) // 2
    sampled = (
        text[:start_n]
        + "\n\n[… middle section …]\n\n"
        + text[mid_pos : mid_pos + mid_n]
        + "\n\n[… end section …]\n\n"
        + text[-end_n:]
    )
    return sampled, True


@router.post("/summarize")
async def summarize_pdf(
    file: UploadFile = File(...),
    detail: Literal["brief", "standard", "detailed"] = Form("standard"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Add GROQ_API_KEY to your .env file.",
        )

    content = await file.read()

    try:
        full_text = _extract_text(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF.")

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extractable text found — this may be a scanned image PDF.",
        )

    sample, was_sampled = _sample(full_text)
    page_count = len(PdfReader(io.BytesIO(content)).pages)
    cfg = DETAIL_CONFIG[detail]

    system_prompt = (
        "You are a document analysis assistant. "
        "Detect the language of the document and respond ENTIRELY in that same language. "
        f"{cfg['instruction']}"
    )
    if was_sampled:
        system_prompt += (
            " Note: the text is a representative sample (beginning, middle, end) "
            "of a long document — reflect this in your summary."
        )

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key)

        resp = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": f"Summarize this document:\n\n{sample}"},
            ],
            max_tokens=cfg["max_tokens"],
        )
        summary = resp.choices[0].message.content

    except Exception as exc:
        err = str(exc)
        if "rate_limit_exceeded" in err or "429" in err:
            raise HTTPException(
                status_code=429,
                detail="Rate limit reached. The free Groq tier allows ~6 000 tokens/minute. Wait 60 seconds and try again.",
            )
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    return {
        "summary": summary,
        "pages": page_count,
        "sampled": was_sampled,
        "detail": detail,
    }


@router.post("/translate-pdf")
async def translate_pdf_endpoint(
    file: UploadFile = File(...),
    target_language: str = Form("Spanish"),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    job_id, storage_path = await save_upload_file(file)
    await create_job(session, job_id, "translate_pdf", file.filename)
    celery_app.send_task(
        "app.workers.ai_tasks.translate_pdf_task",
        args=[storage_path, job_id, target_language],
    )
    return {"job_id": job_id, "status": "queued"}
