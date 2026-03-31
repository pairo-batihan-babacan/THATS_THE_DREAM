import os
import sys
import shutil
import subprocess
import tempfile
import zipfile
from pypdf import PdfWriter, PdfReader
import img2pdf
from app.core.config import settings

GS_BINARY = "/usr/bin/gs"


def _output_path(job_id: str, filename: str) -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, filename)


def compress_pdf(input_path: str, job_id: str, quality: str = "medium") -> str:
    """Compress a PDF using Ghostscript. quality: low | medium | high"""
    output_filename = f"{job_id}_compressed.pdf"
    output_path = _output_path(job_id, output_filename)

    # Map quality level to Ghostscript PDFSETTINGS
    gs_quality = {"low": "/screen", "medium": "/ebook", "high": "/printer"}.get(quality, "/ebook")

    result = subprocess.run(
        [
            GS_BINARY,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_quality}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={output_path}",
            input_path,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return output_filename

    # Ghostscript failed — fall back to pypdf lossless compression
    gs_error = result.stderr.strip() or result.stdout.strip() or "Unknown Ghostscript error"
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        for page in reader.pages:
            page.compress_content_streams()
            writer.add_page(page)
        with open(output_path, "wb") as f:
            writer.write(f)
        return output_filename
    except Exception as fallback_err:
        raise RuntimeError(
            f"PDF compression failed. "
            f"Ghostscript error: {gs_error}. "
            f"Fallback error: {fallback_err}"
        )


def pdf_to_word(input_path: str, job_id: str) -> str:
    """Convert PDF to DOCX with three-tier fallback:
    1. pdf2docx full conversion (layout + images)
    2. pdf2docx with image clipping disabled (handles malformed image PDFs)
    3. PyMuPDF text extraction → python-docx (always works, layout-free)
    """
    output_filename = f"{job_id}_converted.docx"
    output_path = _output_path(job_id, output_filename)

    file_mb = os.path.getsize(input_path) / (1024 * 1024)
    timeout = min(max(int(file_mb * 10), 300), 3000)
    env = {**os.environ, "_IN": input_path, "_OUT": output_path}

    # Tier 1: full conversion
    r1 = subprocess.run(
        [sys.executable, "-c",
         "import os; from pdf2docx import Converter; "
         "cv = Converter(os.environ['_IN']); "
         "cv.convert(os.environ['_OUT']); cv.close()"],
        capture_output=True, timeout=timeout, env=env,
    )
    if r1.returncode == 0:
        return output_filename

    # Tier 2: skip image clipping (fixes PDFs with malformed/indexed-color images)
    r2 = subprocess.run(
        [sys.executable, "-c",
         "import os; from pdf2docx import Converter; "
         "cv = Converter(os.environ['_IN']); "
         "cv.convert(os.environ['_OUT'], clip_image_res_ratio=0.0); cv.close()"],
        capture_output=True, timeout=timeout, env=env,
    )
    if r2.returncode == 0:
        return output_filename

    # Tier 3: text-only fallback via PyMuPDF + python-docx
    try:
        import fitz
        from docx import Document as DocxDocument
        doc = fitz.open(input_path)
        word = DocxDocument()
        word.add_paragraph(
            "Note: This PDF contains complex formatting or images that could not be "
            "fully preserved. Text content has been extracted as-is."
        )
        for page in doc:
            text = page.get_text()
            if text.strip():
                word.add_paragraph(text)
            word.add_page_break()
        doc.close()
        word.save(output_path)
        return output_filename
    except Exception as fallback_err:
        raise RuntimeError(
            f"PDF to Word conversion failed: "
            f"{r2.stderr.decode(errors='replace') or r1.stderr.decode(errors='replace')} "
            f"(fallback also failed: {fallback_err})"
        )


def pdf_to_images(input_path: str, job_id: str) -> str:
    """Convert PDF pages to JPEG images using PyMuPDF, zip and return.
    PyMuPDF is 5-10x faster than poppler and frees each page from RAM immediately."""
    import fitz  # PyMuPDF

    zip_filename = f"{job_id}_pages.zip"
    zip_path = _output_path(job_id, zip_filename)
    mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI

    try:
        doc = fitz.open(input_path)
        with tempfile.TemporaryDirectory() as tmp_dir:
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
                for i, page in enumerate(doc):
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    img_path = os.path.join(tmp_dir, f"page_{i + 1}.jpg")
                    pix.save(img_path)
                    zf.write(img_path, f"{job_id}_page_{i + 1}.jpg")
                    pix = None  # release pixmap memory immediately
        doc.close()
    except Exception as e:
        raise RuntimeError(
            f"Failed to convert PDF to images. "
            f"Ensure the file is a valid PDF. Error: {e}"
        )

    return zip_filename


def images_to_pdf(input_paths: list[str], job_id: str) -> str:
    output_filename = f"{job_id}_merged.pdf"
    output_path = _output_path(job_id, output_filename)
    try:
        with open(output_path, "wb") as f:
            img2pdf.convert(*input_paths, outputstream=f)
    except Exception as e:
        raise RuntimeError(f"Failed to combine images into PDF: {e}")
    return output_filename


def merge_pdfs(input_paths: list[str], job_id: str) -> str:
    output_filename = f"{job_id}_merged.pdf"
    output_path = _output_path(job_id, output_filename)
    writer = PdfWriter()
    for path in input_paths:
        try:
            reader = PdfReader(path)
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            raise RuntimeError(f"Failed to read PDF '{os.path.basename(path)}': {e}")
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_filename


def split_pdf(input_path: str, job_id: str, pages_spec: str) -> str:
    """
    pages_spec format: '1-3,5,7-9' (1-indexed)
    Returns a zip of the extracted pages as a single PDF.
    """
    try:
        reader = PdfReader(input_path)
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF: {e}")

    page_numbers = _parse_page_spec(pages_spec, len(reader.pages))
    if not page_numbers:
        raise ValueError(
            f"Page spec '{pages_spec}' produced no valid pages. "
            f"The PDF has {len(reader.pages)} page(s)."
        )

    writer = PdfWriter()
    for n in page_numbers:
        writer.add_page(reader.pages[n])

    output_filename = f"{job_id}_split.pdf"
    output_path = _output_path(job_id, output_filename)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_filename


def _parse_page_spec(spec: str, total: int) -> list[int]:
    """Convert '1-3,5,7-9' to zero-indexed page list."""
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-")
            pages.extend(range(int(start) - 1, int(end)))
        else:
            pages.append(int(part) - 1)
    return [p for p in pages if 0 <= p < total]


def strip_pdf_metadata(input_path: str, job_id: str) -> str:
    output_filename = f"{job_id}_clean.pdf"
    output_path = _output_path(job_id, output_filename)
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.add_metadata({})  # clears all metadata
        with open(output_path, "wb") as f:
            writer.write(f)
    except Exception as e:
        raise RuntimeError(f"Failed to strip PDF metadata: {e}")
    return output_filename


def _libreoffice_to_pdf(input_path: str, job_id: str) -> str:
    """Convert any LibreOffice-compatible document to PDF (shared helper)."""
    output_filename = f"{job_id}_converted.pdf"
    output_dir = settings.OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    # Each job gets its own LibreOffice HOME to prevent concurrent profile lock conflicts
    lo_home = f"/tmp/lo_home_{job_id}"
    os.makedirs(lo_home, exist_ok=True)

    env = os.environ.copy()
    env["HOME"] = lo_home

    try:
        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--norestore",
                "--nofirststartwizard",
                "--convert-to", "pdf",
                "--outdir", output_dir,
                input_path,
            ],
            capture_output=True,
            text=True,
            env=env,
            timeout=120,
        )
    finally:
        shutil.rmtree(lo_home, ignore_errors=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"LibreOffice failed to convert '{os.path.basename(input_path)}' to PDF. "
            f"Error: {result.stderr.strip() or result.stdout.strip() or 'Unknown error'}"
        )

    # LibreOffice names the output after the input filename (without extension)
    base = os.path.splitext(os.path.basename(input_path))[0]
    libreoffice_output = os.path.join(output_dir, f"{base}.pdf")
    final_path = os.path.join(output_dir, output_filename)

    if not os.path.exists(libreoffice_output):
        raise RuntimeError(
            f"LibreOffice reported success but output file was not found "
            f"(expected: {libreoffice_output}). stdout: {result.stdout.strip()}"
        )

    os.rename(libreoffice_output, final_path)
    return output_filename


def word_to_pdf(input_path: str, job_id: str) -> str:
    return _libreoffice_to_pdf(input_path, job_id)


def ppt_to_pdf(input_path: str, job_id: str) -> str:
    """Convert PPT/PPTX presentation to PDF using LibreOffice."""
    return _libreoffice_to_pdf(input_path, job_id)


def excel_to_pdf(input_path: str, job_id: str) -> str:
    """Convert XLS/XLSX spreadsheet to PDF using LibreOffice."""
    return _libreoffice_to_pdf(input_path, job_id)


def unlock_pdf(input_path: str, job_id: str, password: str = "") -> str:
    """Remove password protection from a PDF file."""
    output_filename = f"{job_id}_unlocked.pdf"
    output_path = _output_path(job_id, output_filename)
    try:
        reader = PdfReader(input_path)
        if reader.is_encrypted:
            if not reader.decrypt(password):
                raise RuntimeError("Incorrect password — could not unlock this PDF")
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        with open(output_path, "wb") as f:
            writer.write(f)
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to unlock PDF: {e}")
    return output_filename


def pdf_to_excel(input_path: str, job_id: str) -> str:
    """Extract text content from a PDF and export it as an Excel spreadsheet."""
    import pandas as pd  # pandas is already in requirements

    output_filename = f"{job_id}_data.xlsx"
    output_path = _output_path(job_id, output_filename)
    try:
        reader = PdfReader(input_path)
        rows = []
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if line:
                    rows.append({"Page": page_num, "Content": line})
        if not rows:
            rows = [{"Page": 1, "Content": "No extractable text found in this PDF"}]
        df = pd.DataFrame(rows)
        df.to_excel(output_path, index=False)
    except Exception as e:
        raise RuntimeError(f"Failed to extract data from PDF: {e}")
    return output_filename
