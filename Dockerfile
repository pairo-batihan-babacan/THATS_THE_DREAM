FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    poppler-utils \
    tesseract-ocr \
    ghostscript \
    libreoffice \
    libgl1 \
    libglib2.0-0 \
    potrace \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x start.sh

EXPOSE 10000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]