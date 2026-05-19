import os
import json
import markdown
import pytesseract
from pytesseract import Output
import pandas as pd
from PIL import Image
from weasyprint import HTML
from app.core.config import settings


def _output_path(job_id: str, filename: str) -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, filename)


_OCR_CONFIDENCE_THRESHOLD = 60
_OCR_MIN_WORDS = 3


def ocr_image(input_path: str, job_id: str) -> str:
    try:
        img = Image.open(input_path)
        data = pytesseract.image_to_data(img, output_type=Output.DICT)
    except pytesseract.TesseractNotFoundError:
        raise RuntimeError(
            "Tesseract OCR engine is not installed or not in PATH. "
            "Expected at: /usr/bin/tesseract"
        )
    except Exception as e:
        raise RuntimeError(f"OCR failed: {e}")

    # Keep only words with a real confidence score and non-empty text
    confident_words = [
        data["text"][i]
        for i in range(len(data["text"]))
        if int(data["conf"][i]) >= _OCR_CONFIDENCE_THRESHOLD
        and data["text"][i].strip()
    ]

    if len(confident_words) < _OCR_MIN_WORDS:
        text = "No readable text was found in this image."
    else:
        text = " ".join(confident_words)

    output_filename = f"{job_id}_ocr.txt"
    output_path = _output_path(job_id, output_filename)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    return output_filename


def markdown_to_pdf(input_path: str, job_id: str) -> str:
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            md_content = f.read()
        html_content = markdown.markdown(md_content)
        output_filename = f"{job_id}_converted.pdf"
        output_path = _output_path(job_id, output_filename)
        HTML(string=html_content).write_pdf(output_path)
    except Exception as e:
        raise RuntimeError(f"Markdown to PDF conversion failed: {e}")
    return output_filename


def html_to_pdf(input_path: str, job_id: str) -> str:
    output_filename = f"{job_id}_converted.pdf"
    output_path = _output_path(job_id, output_filename)
    try:
        HTML(filename=input_path).write_pdf(output_path)
    except Exception as e:
        raise RuntimeError(f"HTML to PDF conversion failed: {e}")
    return output_filename


def csv_to_json(input_path: str, job_id: str) -> str:
    try:
        df = pd.read_csv(input_path)
    except Exception as e:
        raise RuntimeError(f"Failed to parse CSV: {e}")
    output_filename = f"{job_id}_converted.json"
    output_path = _output_path(job_id, output_filename)
    df.to_json(output_path, orient="records", indent=2)
    return output_filename


def json_to_csv(input_path: str, job_id: str) -> str:
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        df = pd.DataFrame(data)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON file: {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to parse JSON: {e}")
    output_filename = f"{job_id}_converted.csv"
    output_path = _output_path(job_id, output_filename)
    df.to_csv(output_path, index=False)
    return output_filename
