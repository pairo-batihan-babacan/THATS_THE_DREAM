FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# Tools the conversion services shell out to. LibreOffice goes in component by
# component: the `libreoffice` metapackage drags in Java and the full suite,
# which roughly doubles the image for filters this app never calls.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    poppler-utils \
    tesseract-ocr \
    ghostscript \
    libreoffice-core \
    libreoffice-common \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu-core \
    libgl1 \
    libglib2.0-0 \
    potrace \
    redis-server \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && libreoffice --version

WORKDIR /app

# build-essential is only needed to compile wheels that have no binary build;
# it is purged in the same layer so it never ships in the image.
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN chmod +x start.sh

EXPOSE 10000

CMD ["./start.sh"]
