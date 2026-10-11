# -*- coding: utf-8 -*-
"""
services/s3_service.py — S3 image upload and pre-signed URL generation.

Responsibilities
----------------
1. Ensure the configured bucket exists (create-on-first-use for LocalStack /
   dev environments; skipped gracefully on real AWS).
2. Upload a raw image ``bytes`` object under a structured S3 key and return
   that key.
3. Generate a short-lived pre-signed GET URL for the stored object so the
   frontend can display the image without exposing credentials.

Design notes
------------
- A single ``boto3.client`` is created lazily on first call and cached for the
  process lifetime (``@lru_cache`` on the factory function).
- All AWS / boto3 errors are caught and re-raised as the custom
  ``S3ServiceError`` so callers never have to import ``botocore``.
- ``USE_LOCALSTACK=true`` routes every call through the LocalStack endpoint
  defined in ``config.py``; no other code changes are needed.
- When a real ``ClientError`` occurs on bucket creation we silently ignore
  ``BucketAlreadyOwnedByYou`` and ``BucketAlreadyExists`` — both indicate the
  bucket is fine.
"""

from __future__ import annotations

import logging
import mimetypes
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from config import Settings, get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class S3ServiceError(RuntimeError):
    """Raised for any S3 operation failure."""


# ---------------------------------------------------------------------------
# Client factory (cached per process)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_s3_client(settings_hash: int):  # noqa: ARG001  (hash forces cache invalidation in tests)
    """
    Return a cached ``boto3`` S3 client configured from *settings*.

    The ``settings_hash`` parameter is not used directly — it exists solely so
    that test suites can bust the cache by passing a different value.
    """
    settings: Settings = get_settings()
    return boto3.client("s3", **settings.boto3_kwargs)


def _client():
    """Convenience wrapper that always uses the current settings singleton."""
    settings = get_settings()
    return _get_s3_client(id(settings))


# ---------------------------------------------------------------------------
# Bucket bootstrap
# ---------------------------------------------------------------------------

def _ensure_bucket(bucket: str, region: str, use_localstack: bool) -> None:
    """
    Create *bucket* if it does not exist.

    On real AWS in us-east-1, ``CreateBucketConfiguration`` must **not** be
    sent (AWS quirk).  For every other region, or when LocalStack is active,
    we include it.

    Already-exists errors are silently swallowed; all other ``ClientError``
    values are re-raised as :class:`S3ServiceError`.
    """
    client = _client()
    _benign = {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}

    kwargs: dict = {"Bucket": bucket}
    if use_localstack or region != "us-east-1":
        kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}

    try:
        client.create_bucket(**kwargs)
        logger.info("s3_service: created bucket '%s'", bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code not in _benign:
            raise S3ServiceError(f"Failed to create bucket '{bucket}': {exc}") from exc
        logger.debug("s3_service: bucket '%s' already exists — continuing", bucket)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upload_image(
    image_bytes: bytes,
    content_type: Optional[str] = None,
    *,
    report_id: Optional[str] = None,
    extension: str = "jpg",
) -> tuple[str, str]:
    """
    Upload *image_bytes* to S3 and return ``(s3_key, bucket_name)``.

    Parameters
    ----------
    image_bytes:
        Raw image data (JPEG, PNG, WebP, …).
    content_type:
        MIME type string.  If ``None``, guessed from *extension*; falls back
        to ``"image/jpeg"``.
    report_id:
        UUID string of the associated report.  When omitted a new UUID is
        generated so that each upload gets a unique key.
    extension:
        File extension **without** the leading dot (default ``"jpg"``).

    Returns
    -------
    tuple[str, str]
        ``(s3_key, bucket_name)`` — the S3 object key and the bucket name.

    Raises
    ------
    S3ServiceError
        If the upload fails for any reason.
    """
    settings = get_settings()
    bucket = settings.S3_BUCKET_NAME
    region = settings.AWS_REGION

    # Resolve content-type
    if not content_type:
        guessed, _ = mimetypes.guess_type(f"file.{extension}")
        content_type = guessed or "image/jpeg"

    # Build a time-scoped, unique S3 key
    rid = report_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    s3_key = f"reports/{now.year}/{now.month:02d}/{now.day:02d}/{rid}.{extension}"

    # Ensure bucket exists (idempotent)
    try:
        _ensure_bucket(bucket, region, settings.USE_LOCALSTACK)
    except S3ServiceError:
        raise
    except Exception as exc:
        raise S3ServiceError(f"Bucket setup failed: {exc}") from exc

    # Upload
    client = _client()
    try:
        client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=image_bytes,
            ContentType=content_type,
            # Prevent public access — signed URLs are used for reads
            ACL="private",
        )
        logger.info(
            "s3_service: uploaded %d bytes → s3://%s/%s",
            len(image_bytes),
            bucket,
            s3_key,
        )
    except (ClientError, BotoCoreError) as exc:
        raise S3ServiceError(f"Upload failed for key '{s3_key}': {exc}") from exc

    return s3_key, bucket


def generate_signed_url(
    s3_key: str,
    *,
    bucket: Optional[str] = None,
    expiry_seconds: Optional[int] = None,
) -> str:
    """
    Generate a pre-signed GET URL for *s3_key*.

    Parameters
    ----------
    s3_key:
        The S3 object key (as returned by :func:`upload_image`).
    bucket:
        Bucket name.  Defaults to ``settings.S3_BUCKET_NAME``.
    expiry_seconds:
        How long the URL should remain valid.  Defaults to
        ``settings.S3_SIGNED_URL_EXPIRY_SECONDS`` (3 600 s = 1 hour).

    Returns
    -------
    str
        A fully-qualified HTTPS URL.

    Raises
    ------
    S3ServiceError
        If boto3 cannot generate the URL (e.g., key does not exist or
        credentials are missing).
    """
    settings = get_settings()
    bucket = bucket or settings.S3_BUCKET_NAME
    expiry = expiry_seconds if expiry_seconds is not None else settings.S3_SIGNED_URL_EXPIRY_SECONDS

    client = _client()
    try:
        url: str = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": s3_key},
            ExpiresIn=expiry,
        )
        logger.debug(
            "s3_service: signed URL generated for s3://%s/%s (expires in %ds)",
            bucket,
            s3_key,
            expiry,
        )
        return url
    except (ClientError, BotoCoreError) as exc:
        raise S3ServiceError(
            f"Could not generate signed URL for '{s3_key}': {exc}"
        ) from exc


def upload_and_sign(
    image_bytes: bytes,
    content_type: Optional[str] = None,
    *,
    report_id: Optional[str] = None,
    extension: str = "jpg",
    expiry_seconds: Optional[int] = None,
) -> tuple[str, str, str]:
    """
    Convenience wrapper: upload then immediately sign.

    Returns
    -------
    tuple[str, str, str]
        ``(s3_key, bucket_name, signed_url)``

    This is the primary function called by ``routers/reports.py``.
    """
    s3_key, bucket = upload_image(
        image_bytes,
        content_type,
        report_id=report_id,
        extension=extension,
    )
    signed_url = generate_signed_url(s3_key, bucket=bucket, expiry_seconds=expiry_seconds)
    return s3_key, bucket, signed_url


def delete_object(s3_key: str, *, bucket: Optional[str] = None) -> None:
    """
    Delete an object from S3 (used when rolling back a failed report creation).

    Raises
    ------
    S3ServiceError
        If the deletion fails for any reason other than the object not
        existing (a missing object is silently ignored).
    """
    settings = get_settings()
    bucket = bucket or settings.S3_BUCKET_NAME
    client = _client()

    try:
        client.delete_object(Bucket=bucket, Key=s3_key)
        logger.info("s3_service: deleted s3://%s/%s", bucket, s3_key)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code == "NoSuchKey":
            logger.debug("s3_service: delete_object — key '%s' not found, ignoring", s3_key)
            return
        raise S3ServiceError(f"Failed to delete '{s3_key}': {exc}") from exc
    except BotoCoreError as exc:
        raise S3ServiceError(f"Failed to delete '{s3_key}': {exc}") from exc
