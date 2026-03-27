#!/bin/bash
# Render free tier: API + Celery in one container, 512 MB RAM.
# concurrency=1 prevents two heavy conversions (LibreOffice, pdf2docx, ffmpeg)
# from running simultaneously and exhausting memory mid-task.

# Give Redis a moment to be reachable before Celery connects
(sleep 5 && celery -A app.core.celery_app worker \
  --loglevel=info \
  -Q default,heavy \
  --concurrency=1 || true) &

(sleep 10 && celery -A app.core.celery_app beat \
  --loglevel=info || true) &

# FastAPI — foreground process Render monitors
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
