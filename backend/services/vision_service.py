# -*- coding: utf-8 -*-
"""
services/vision_service.py — Vision AI provider for VayuDrishti
=================================================================
Analyses a dust/pollution image and returns a structured VisualAnalysis.

Supported providers (controlled by VISION_PROVIDER env var):
  "mock"    → deterministic fake response  (default, always safe)
  "bedrock" → AWS Bedrock Claude Haiku     (requires Bedrock model access)
  "openai"  → OpenAI GPT-4o-mini Vision   (requires OPENAI_API_KEY)

Design rule: this service NEVER raises an exception to the caller.
If any provider fails, it returns VisualAnalysis.failed() so the report
pipeline is never blocked by a broken vision call.
"""

from __future__ import annotations

import base64
import json
import logging
import random
from typing import Optional

from models.report import DustCategory, SeverityLevel, VisualAnalysis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared prompt sent to every real vision provider
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """
You are an environmental analysis AI for VayuDrishti, an urban dust-pollution
monitoring system. Analyse the provided image and return ONLY a valid JSON
object with these exact keys (no markdown, no explanation):

{
  "dust_detected": <true|false>,
  "dust_category": <"construction"|"road_dust"|"industrial"|"vehicle_emissions"|"open_burning"|"unknown">,
  "severity": <"low"|"moderate"|"high"|"critical">,
  "confidence": <0.0 to 1.0>,
  "description": "<one sentence describing what you see>",
  "suggested_action": "<one sentence recommending follow-up action>"
}

Be conservative: only set dust_detected=true if pollution is clearly visible.
""".strip()


# ---------------------------------------------------------------------------
# Mock provider — deterministic, no network calls
# ---------------------------------------------------------------------------

def _analyse_mock(image_bytes: Optional[bytes] = None) -> VisualAnalysis:
    """
    Returns a realistic-looking but hard-coded mock response.
    Useful during development / when Bedrock access is pending.

    If image_bytes is provided the mock adds a tiny random variation
    based on the byte-sum so different images give different scores.
    """
    # Slight variation per image so the UI doesn't look totally static
    seed = sum(image_bytes[:64]) if image_bytes else 42
    rng = random.Random(seed)

    categories = list(DustCategory)
    severities = [SeverityLevel.LOW, SeverityLevel.MODERATE,
                  SeverityLevel.HIGH, SeverityLevel.CRITICAL]

    category  = rng.choice(categories[:-1])        # exclude UNKNOWN for mock
    severity  = rng.choice(severities[:3])          # exclude CRITICAL for mock
    confidence = round(rng.uniform(0.72, 0.95), 2)

    descriptions = {
        DustCategory.CONSTRUCTION:      "Heavy construction activity with visible dust cloud rising from the site.",
        DustCategory.ROAD_DUST:         "Unpaved road surface generating dust from vehicle movement.",
        DustCategory.INDUSTRIAL:        "Industrial smoke and particulate matter visible near factory area.",
        DustCategory.VEHICLE_EMISSIONS: "Dense vehicle exhaust fumes visible at a traffic intersection.",
        DustCategory.OPEN_BURNING:      "Open burning of waste material producing thick smoke and ash.",
    }
    actions = {
        SeverityLevel.LOW:      "Monitor the area; schedule routine inspection within 7 days.",
        SeverityLevel.MODERATE: "Notify local authority; schedule inspection within 48 hours.",
        SeverityLevel.HIGH:     "Flag for priority inspection; escalate to area supervisor.",
    }

    return VisualAnalysis(
        dust_detected=True,
        dust_category=category,
        severity=severity,
        confidence=confidence,
        description=descriptions.get(category, "Dust pollution observed in the image."),
        suggested_action=actions.get(severity, "Review and take appropriate action."),
        analysis_failed=False,
    )


# ---------------------------------------------------------------------------
# Bedrock provider — AWS Claude Haiku
# ---------------------------------------------------------------------------

def _analyse_bedrock(image_bytes: bytes, model_id: str, region: str,
                     boto3_kwargs: dict) -> VisualAnalysis:
    """
    Calls AWS Bedrock (Claude Haiku) with the image encoded as base64.
    Requires:
      - Bedrock model access enabled in the AWS console
      - IAM permission: bedrock:InvokeModel
    """
    try:
        import boto3  # type: ignore
    except ImportError:
        logger.error("boto3 not installed — cannot use Bedrock provider.")
        return VisualAnalysis.failed()

    # Bedrock may be in a different region from the main AWS_REGION
    bedrock_kwargs = {**boto3_kwargs, "region_name": region}
    bedrock_kwargs.pop("endpoint_url", None)  # LocalStack doesn't support Bedrock

    try:
        client = boto3.client("bedrock-runtime", **bedrock_kwargs)
    except Exception as exc:
        logger.error("Failed to create Bedrock client: %s", exc)
        return VisualAnalysis.failed()

    # Encode image as base64
    b64_image = base64.standard_b64encode(image_bytes).decode("utf-8")

    # Detect MIME type from magic bytes
    mime = "image/jpeg"
    if image_bytes[:4] == b"\x89PNG":
        mime = "image/png"
    elif image_bytes[:4] == b"GIF8":
        mime = "image/gif"
    elif image_bytes[:2] == b"BM":
        mime = "image/bmp"

    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "system": _SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Analyse this image for dust/air pollution. Reply with JSON only.",
                    },
                ],
            }
        ],
    }

    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload),
        )
        body = json.loads(response["body"].read())
        raw_text = body["content"][0]["text"].strip()
        return _parse_vision_json(raw_text)

    except Exception as exc:
        logger.error("Bedrock invoke_model failed: %s", exc)
        return VisualAnalysis.failed()


# ---------------------------------------------------------------------------
# OpenAI provider — GPT-4o-mini Vision
# ---------------------------------------------------------------------------

def _analyse_openai(image_bytes: bytes, api_key: str, model: str) -> VisualAnalysis:
    """
    Calls the OpenAI Chat Completions API with a base64-encoded image.
    Requires:
      - OPENAI_API_KEY set in .env
      - pip install openai
    """
    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        logger.error("openai package not installed — pip install openai")
        return VisualAnalysis.failed()

    b64_image = base64.standard_b64encode(image_bytes).decode("utf-8")

    # Detect MIME type
    mime = "image/jpeg"
    if image_bytes[:4] == b"\x89PNG":
        mime = "image/png"

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            max_tokens=512,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64_image}"},
                        },
                        {
                            "type": "text",
                            "text": "Analyse this image for dust/air pollution. Reply with JSON only.",
                        },
                    ],
                },
            ],
        )
        raw_text = response.choices[0].message.content.strip()
        return _parse_vision_json(raw_text)

    except Exception as exc:
        logger.error("OpenAI vision call failed: %s", exc)
        return VisualAnalysis.failed()


# ---------------------------------------------------------------------------
# JSON parser — shared by Bedrock + OpenAI
# ---------------------------------------------------------------------------

def _parse_vision_json(raw: str) -> VisualAnalysis:
    """
    Parse the model's JSON output into a VisualAnalysis.
    Strips markdown code fences if the model adds them.
    Falls back to VisualAnalysis.failed() on any parse error.
    """
    # Strip possible ```json ... ``` wrapper
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        )

    try:
        data = json.loads(raw)
        return VisualAnalysis(
            dust_detected    = bool(data.get("dust_detected", False)),
            dust_category    = DustCategory(data.get("dust_category", "unknown")),
            severity         = SeverityLevel(data.get("severity", "low")),
            confidence       = float(data.get("confidence", 0.0)),
            description      = str(data.get("description", ""))[:1000],
            suggested_action = str(data.get("suggested_action", ""))[:500],
            analysis_failed  = False,
        )
    except Exception as exc:
        logger.error("Failed to parse vision model JSON: %s | raw=%r", exc, raw[:300])
        return VisualAnalysis.failed()


# ---------------------------------------------------------------------------
# Public API — single entry point
# ---------------------------------------------------------------------------

def analyse_image(
    image_bytes: Optional[bytes] = None,
    provider: Optional[str] = None,
) -> VisualAnalysis:
    """
    Analyse an image for dust/air pollution.

    Parameters
    ----------
    image_bytes : bytes | None
        Raw image bytes. May be None when using the mock provider.
    provider : str | None
        Override the VISION_PROVIDER env var. Useful in tests.

    Returns
    -------
    VisualAnalysis
        Always returns a valid object — never raises.
    """
    # Lazy import to avoid circular imports at module level
    from config import get_settings
    settings = get_settings()

    chosen_provider = (provider or settings.VISION_PROVIDER).lower()
    logger.info("Vision provider: %s", chosen_provider)

    # ── Mock ─────────────────────────────────────────────────────────────
    if chosen_provider == "mock":
        result = _analyse_mock(image_bytes)
        logger.info("Mock analysis complete: %s / %s", result.dust_category, result.severity)
        return result

    # Real providers require actual image bytes
    if not image_bytes:
        logger.warning("No image bytes provided for provider '%s'; falling back to mock.", chosen_provider)
        return _analyse_mock(None)

    # ── Bedrock ──────────────────────────────────────────────────────────
    if chosen_provider == "bedrock":
        result = _analyse_bedrock(
            image_bytes  = image_bytes,
            model_id     = settings.BEDROCK_MODEL_ID,
            region       = settings.BEDROCK_REGION,
            boto3_kwargs = settings.boto3_kwargs,
        )

    # ── OpenAI ───────────────────────────────────────────────────────────
    elif chosen_provider == "openai":
        result = _analyse_openai(
            image_bytes = image_bytes,
            api_key     = settings.OPENAI_API_KEY,
            model       = settings.OPENAI_MODEL,
        )

    # ── Unknown provider — safe fallback ─────────────────────────────────
    else:
        logger.error("Unknown VISION_PROVIDER '%s'; falling back to mock.", chosen_provider)
        result = _analyse_mock(image_bytes)

    if result.analysis_failed:
        logger.warning("Vision analysis failed for provider '%s'; returned safe default.", chosen_provider)
    else:
        logger.info(
            "Vision analysis OK: dust=%s category=%s severity=%s confidence=%.2f",
            result.dust_detected,
            result.dust_category,
            result.severity,
            result.confidence,
        )
    return result
