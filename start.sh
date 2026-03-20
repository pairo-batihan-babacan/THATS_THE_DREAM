#!/bin/bash
# Render free tier: run Celery worker + API in the same container.

# Start Celery worker in background (handles both queues)
celery -A app.core.celery_app worker \
  --loglevel=info \
  -Q default,heavy \
  --concurrency=2 &

# Start Celery beat scheduler in background
celery -A app.core.celery_app beat \
  --loglevel=info &

# Start FastAPI (foreground — this is the process Render monitors)
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
