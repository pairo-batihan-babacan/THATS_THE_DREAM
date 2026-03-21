#!/bin/bash
# Render free tier: API + Celery in one container.
# Celery failures are fully isolated — they cannot crash uvicorn.

# Give Redis a moment to be reachable before Celery connects
(sleep 5 && celery -A app.core.celery_app worker \
  --loglevel=info \
  -Q default,heavy \
  --concurrency=2 || true) &

(sleep 10 && celery -A app.core.celery_app beat \
  --loglevel=info || true) &

# FastAPI — foreground process Render monitors
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
