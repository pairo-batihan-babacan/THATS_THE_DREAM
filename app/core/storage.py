"""
MinIO / S3-compatible storage client.
Sync — safe to call from both Celery workers and FastAPI routes (via asyncio.to_thread).
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone
from typing import Union, BinaryIO

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.MINIO_USE_SSL else 'http'}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        _ensure_buckets()
    return _client


def _ensure_buckets() -> None:
    for bucket in (settings.MINIO_UPLOADS_BUCKET, settings.MINIO_OUTPUTS_BUCKET):
        try:
            _client.head_bucket(Bucket=bucket)
        except ClientError:
            _client.create_bucket(Bucket=bucket)


def upload_file(bucket: str, path: str, data: Union[bytes, BinaryIO]) -> str:
    """Upload bytes or a file-like object to bucket/path. Returns the storage path."""
    client = get_client()
    if isinstance(data, (bytes, bytearray)):
        data = io.BytesIO(data)
    client.upload_fileobj(data, bucket, path)
    return path


def download_file(bucket: str, path: str) -> bytes:
    """Download file from bucket/path and return raw bytes."""
    client = get_client()
    buf = io.BytesIO()
    client.download_fileobj(bucket, path, buf)
    return buf.getvalue()


def download_file_to_path(bucket: str, path: str, local_path: str) -> None:
    """Stream download directly to local_path — no bytes held in RAM."""
    client = get_client()
    client.download_file(bucket, path, local_path)


def get_object_body(bucket: str, path: str):
    """Return the boto3 StreamingBody for bucket/path. Caller must read/close it."""
    client = get_client()
    response = client.get_object(Bucket=bucket, Key=path)
    return response["Body"]


def delete_file(bucket: str, path: str) -> None:
    """Delete a single file from bucket/path."""
    client = get_client()
    client.delete_object(Bucket=bucket, Key=path)


def delete_old_files(bucket: str, ttl_minutes: int) -> int:
    """
    List all files in the bucket and delete those older than ttl_minutes.
    Returns the count of deleted files.
    """
    client = get_client()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    to_delete = []

    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            if obj["LastModified"] < cutoff:
                to_delete.append({"Key": obj["Key"]})

    if to_delete:
        client.delete_objects(Bucket=bucket, Delete={"Objects": to_delete})

    return len(to_delete)
