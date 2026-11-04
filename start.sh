#!/bin/bash
# Two deploy profiles, picked with DEPLOY_PROFILE:
#   vps  (default) — a real VPS in one container: separate queues, concurrency
#                    from CELERY_DEFAULT_CONCURRENCY / CELERY_HEAVY_CONCURRENCY.
#                    Expects an external Redis via REDIS_URL. For the split
#                    container layout use docker-compose.prod.yml instead.
#   free           — one small container: Redis in-process, a single lean worker.
set -e

PROFILE="${DEPLOY_PROFILE:-vps}"

if [ "$PROFILE" = "free" ]; then
  # Free plans come with no managed Redis, so run one in the container. Nothing
  # is persisted: the broker only holds in-flight jobs and uploads expire in
  # 30 minutes anyway.
  redis-server --daemonize yes --port 6379 \
    --save '' --appendonly no \
    --maxmemory 64mb --maxmemory-policy noeviction

  # One worker takes both queues with beat embedded (-B), so the whole stack is
  # two processes instead of four — 512 MB of RAM does not stretch further.
  (sleep 5 && celery -A app.core.celery_app worker \
    --loglevel=info \
    -Q default,heavy \
    --concurrency=1 \
    --max-tasks-per-child=5 \
    -B -s /tmp/celerybeat-schedule || true) &
else
  # Default queue: PDF, image, document tasks.
  (sleep 5 && celery -A app.core.celery_app worker \
    --loglevel=info \
    -Q default \
    --concurrency="${CELERY_DEFAULT_CONCURRENCY:-3}" \
    --max-tasks-per-child=20 || true) &

  # Heavy queue: video and audio tasks — ffmpeg is CPU-bound.
  (sleep 5 && celery -A app.core.celery_app worker \
    --loglevel=info \
    -Q heavy \
    --concurrency="${CELERY_HEAVY_CONCURRENCY:-1}" \
    --max-tasks-per-child=5 || true) &

  # Beat scheduler.
  (sleep 10 && celery -A app.core.celery_app beat \
    --loglevel=info -s /tmp/celerybeat-schedule || true) &
fi

# FastAPI — foreground process the platform monitors.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
