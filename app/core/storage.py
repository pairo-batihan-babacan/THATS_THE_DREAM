"""
Supabase Storage client.
Sync — safe to call from both Celery workers (sync) and FastAPI
routes (via asyncio.to_thread).
"""
from __future__ import annotations

from typing import Union, BinaryIO
from supabase import create_client, Client
from app.core.config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def upload_file(bucket: str, path: str, data: Union[bytes, BinaryIO]) -> str:
    """Upload bytes or a file-like object to bucket/path. Returns the storage path."""
    client = get_client()
    client.storage.from_(bucket).upload(
        path, data, {"upsert": "true"}
    )
    return path


def download_file(bucket: str, path: str) -> bytes:
    """Download file from bucket/path and return raw bytes."""
    client = get_client()
    return client.storage.from_(bucket).download(path)


def download_file_to_path(bucket: str, path: str, local_path: str) -> None:
    """Stream download from Supabase directly to local_path — no bytes held in RAM."""
    import httpx
    client = get_client()
    result = client.storage.from_(bucket).create_signed_url(path, 120)
    url = result.get("signedURL") or result.get("signedUrl") or ""
    if not url:
        raise RuntimeError(f"Could not get signed URL for {path} in bucket {bucket}")
    with httpx.stream("GET", url, follow_redirects=True) as response:
        response.raise_for_status()
        with open(local_path, "wb") as f:
            for chunk in response.iter_bytes(chunk_size=256 * 1024):
                f.write(chunk)


def delete_file(bucket: str, path: str) -> None:
    """Delete a single file from bucket/path."""
    client = get_client()
    client.storage.from_(bucket).remove([path])


def delete_old_files(bucket: str, ttl_minutes: int) -> int:
    """
    List all files in the bucket and delete those older than ttl_minutes.
    Returns the count of deleted files.
    """
    from datetime import datetime, timedelta, timezone

    client = get_client()
    files = client.storage.from_(bucket).list()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    to_delete = []
    for f in files:
        created_at_str = f.get("created_at", "")
        if created_at_str:
            created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            if created_at < cutoff:
                to_delete.append(f["name"])
    if to_delete:
        client.storage.from_(bucket).remove(to_delete)
    return len(to_delete)
