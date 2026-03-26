import os
import html as html_lib
from app.core.config import settings


def _output_path(job_id: str, filename: str) -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, filename)


# Keep well under 6 000 TPM free-tier limit (~10 k chars ≈ 2 500 tokens input)
MAX_TRANSLATE_CHARS = 10_000


def translate_pdf(input_path: str, job_id: str, target_language: str) -> str:
    """Extract text from a PDF, translate with Groq, return path to translated PDF."""
    from pypdf import PdfReader
    from weasyprint import HTML
    from groq import Groq

    # ── extract text ──────────────────────────────────────────────────────────
    reader = PdfReader(input_path)
    pages_text = [p.extract_text() or "" for p in reader.pages]
    full_text = "\n\n".join(t.strip() for t in pages_text if t.strip())

    if not full_text.strip():
        raise RuntimeError(
            "No extractable text found in this PDF. "
            "It may be a scanned image — try OCR first."
        )

    truncated = len(full_text) > MAX_TRANSLATE_CHARS
    if truncated:
        full_text = full_text[:MAX_TRANSLATE_CHARS]

    # ── translate with Groq ───────────────────────────────────────────────────
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "AI translation is not configured. Add GROQ_API_KEY to your environment."
        )

    client = Groq(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a professional translator. "
                        f"Translate the following text to {target_language}. "
                        "Preserve all paragraph breaks and structure. "
                        "Output ONLY the translated text — no preamble, no explanations."
                    ),
                },
                {"role": "user", "content": full_text},
            ],
            max_tokens=4096,
        )
        translated = resp.choices[0].message.content or ""
    except Exception as exc:
        err = str(exc)
        if "rate_limit_exceeded" in err or "429" in err:
            raise RuntimeError(
                "Translation rate limit reached. "
                "The free Groq tier allows ~6 000 tokens/minute. Wait 60 seconds and try again."
            )
        raise RuntimeError(f"Translation failed: {exc}")

    if truncated:
        translated += (
            "\n\n[Note: This document was long — only the first portion was translated.]"
        )

    # ── build PDF from translated text ────────────────────────────────────────
    paragraphs_html = "".join(
        f"<p>{html_lib.escape(para)}</p>"
        for para in translated.split("\n\n")
        if para.strip()
    )

    html_doc = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    margin: 2.5cm;
    line-height: 1.7;
    color: #222;
  }}
  p {{ margin: 0 0 0.9em; }}
</style>
</head>
<body>{paragraphs_html}</body>
</html>"""

    output_filename = f"{job_id}_translated.pdf"
    output_path = _output_path(job_id, output_filename)
    try:
        HTML(string=html_doc).write_pdf(output_path)
    except Exception as exc:
        raise RuntimeError(f"Failed to create translated PDF: {exc}")

    return output_filename
