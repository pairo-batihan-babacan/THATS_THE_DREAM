#!/bin/bash
# Hetzner VPS: 4 CPUs, 8 GB RAM

# Default queue: PDF, image, document tasks — 3 concurrent slots
(sleep 5 && celery -A app.core.celery_app worker \
  --loglevel=info \
  -Q default \
  --concurrency=3 \
  --max-tasks-per-child=20 || true) &

# Heavy queue: video and audio tasks — 1 concurrent (ffmpeg is CPU-bound)
(sleep 5 && celery -A app.core.celery_app worker \
  --loglevel=info \
  -Q heavy \
  --concurrency=1 \
  --max-tasks-per-child=5 || true) &

# Beat scheduler
(sleep 10 && celery -A app.core.celery_app beat \
  --loglevel=info || true) &

# FastAPI — foreground process Coolify monitors
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
