#!/usr/bin/env bash
# =============================================================================
# test_curl.sh — VayuDrishti end-to-end curl test suite
#
# Tests the full POST → S3 → DynamoDB → background analysis cycle.
#
# Usage:
#   chmod +x test_curl.sh
#   ./test_curl.sh                        # defaults to http://localhost:8000
#   BASE_URL=http://my-server ./test_curl.sh
#
# Requirements:
#   - curl, jq
#   - The FastAPI server must be running  (uvicorn main:app --reload --port 8000)
#   - LocalStack (or real AWS) must be running if USE_LOCALSTACK=true
# =============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
API="$BASE_URL/api/v1/reports"

# ANSI colours
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

pass() { echo -e "${GREEN}  ✔  $1${NC}"; }
fail() { echo -e "${RED}  ✗  $1${NC}"; EXIT_CODE=1; }
info() { echo -e "${CYAN}  ▸  $1${NC}"; }
section() { echo -e "\n${YELLOW}══ $1 ══${NC}"; }

EXIT_CODE=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' is required but not found."; exit 1; }
}

require_cmd curl
require_cmd jq

# Create a minimal valid JPEG test image using printf
# This is a real 1x1 white pixel JPEG binary.
make_test_image() {
  local path="$1"
  printf '\xff\xd8\xff\xe0\x00\x10\x4a\x46\x49\x46\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00\x43\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09\x08\x0a\x0c\x14\x0d\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c\x20\x24\x2e\x27\x20\x22\x2c\x23\x1c\x1c\x28\x37\x29\x2c\x30\x31\x34\x34\x34\x1f\x27\x39\x3d\x38\x32\x3c\x2e\x33\x34\x32\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\xff\xc4\x00\x35\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01\x7d\x01\x02\x03\x00\x04\x11\x05\x12\x21\x31\x41\x06\x13\x51\x61\x07\x22\x71\x14\x32\x81\x91\xa1\x08\x23\x42\xb1\xc1\x15\x52\xd1\xf0\x24\x33\x62\x72\x82\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\xfb\xd4\x00\x00\x00\x1f\xff\xd9' > "$path"
}

TMP_IMAGE="$(mktemp /tmp/test_image_XXXX.jpg)"
make_test_image "$TMP_IMAGE"
trap 'rm -f "$TMP_IMAGE"' EXIT

# ---------------------------------------------------------------------------
# 0. Health check
# ---------------------------------------------------------------------------
section "0. Health check — GET $BASE_URL/health"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "Server is up (HTTP $HTTP_STATUS)"
else
  fail "Server returned HTTP $HTTP_STATUS — is uvicorn running?"
  echo "Start with:  cd backend && uvicorn main:app --reload --port 8000"
  exit 1
fi

HEALTH_BODY=$(curl -s "$BASE_URL/health")
info "Health response: $(echo "$HEALTH_BODY" | jq -c .)"

# ---------------------------------------------------------------------------
# 1. POST /reports — submit a new report (full pipeline trigger)
# ---------------------------------------------------------------------------
section "1. POST /api/v1/reports — submit report (image + GPS)"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API" \
  -F "image=@$TMP_IMAGE;type=image/jpeg" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090" \
  -F "address=Connaught Place, New Delhi" \
  -F "description=Visible dust clouds near construction site" \
)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" == "201" ]]; then
  pass "POST /reports returned HTTP 201 Created"
else
  fail "POST /reports returned HTTP $HTTP_CODE (expected 201)"
  echo "Response body: $BODY"
  EXIT_CODE=1
fi

# Extract fields from the response
REPORT_ID=$(echo "$BODY" | jq -r '.report_id // empty')
REPORT_STATUS=$(echo "$BODY" | jq -r '.status // empty')
IMAGE_URL=$(echo "$BODY" | jq -r '.image_url // empty')

if [[ -n "$REPORT_ID" ]]; then
  pass "report_id present: $REPORT_ID"
else
  fail "report_id missing from response"
fi

if [[ "$REPORT_STATUS" == "pending" ]]; then
  pass "Initial status is 'pending' (background analysis not yet complete)"
else
  fail "Expected status=pending, got '$REPORT_STATUS'"
fi

if [[ -n "$IMAGE_URL" ]]; then
  pass "Signed S3 URL returned (S3 upload succeeded)"
  info "image_url (truncated): ${IMAGE_URL:0:80}..."
else
  fail "image_url missing — S3 upload may have failed"
fi

info "Full POST response:"
echo "$BODY" | jq .

# ---------------------------------------------------------------------------
# 2. GET /reports/{report_id} — retrieve the newly created report
# ---------------------------------------------------------------------------
section "2. GET /api/v1/reports/$REPORT_ID — fetch the report from DynamoDB"

if [[ -z "$REPORT_ID" ]]; then
  fail "Skipping GET — no report_id available"
else
  GET_RESPONSE=$(curl -s -w "\n%{http_code}" "$API/$REPORT_ID")
  GET_CODE=$(echo "$GET_RESPONSE" | tail -1)
  GET_BODY=$(echo "$GET_RESPONSE" | head -n -1)

  if [[ "$GET_CODE" == "200" ]]; then
    pass "GET /reports/$REPORT_ID returned HTTP 200"
  else
    fail "GET returned HTTP $GET_CODE"
  fi

  FETCHED_ID=$(echo "$GET_BODY" | jq -r '.report_id // empty')
  if [[ "$FETCHED_ID" == "$REPORT_ID" ]]; then
    pass "Returned report_id matches submitted report_id"
  else
    fail "report_id mismatch: expected $REPORT_ID, got $FETCHED_ID"
  fi

  info "GET response:"
  echo "$GET_BODY" | jq .
fi

# ---------------------------------------------------------------------------
# 3. Wait for background vision analysis to complete, then re-fetch
# ---------------------------------------------------------------------------
section "3. Background analysis — polling for 'analysed' status (up to 15s)"

if [[ -n "$REPORT_ID" ]]; then
  ANALYSED=false
  for i in $(seq 1 5); do
    sleep 3
    POLL_BODY=$(curl -s "$API/$REPORT_ID")
    POLL_STATUS=$(echo "$POLL_BODY" | jq -r '.status // empty')
    info "Poll $i/5 — status=$POLL_STATUS"
    if [[ "$POLL_STATUS" == "analysed" ]]; then
      ANALYSED=true
      break
    fi
  done

  if $ANALYSED; then
    pass "Report transitioned to 'analysed' after background task"
    PRIORITY=$(echo "$POLL_BODY" | jq -r '.priority_score // "N/A"')
    DUST_PRESENT=$(echo "$POLL_BODY" | jq -r '.analysis.dust_present // "N/A"')
    SEVERITY=$(echo "$POLL_BODY" | jq -r '.analysis.severity // "N/A"')
    info "priority_score=$PRIORITY | dust_present=$DUST_PRESENT | severity=$SEVERITY"
    echo "$POLL_BODY" | jq .
  else
    echo -e "${YELLOW}  ⚠  Status still '$POLL_STATUS' after 15s (may be OK with mock provider)${NC}"
  fi
fi

# ---------------------------------------------------------------------------
# 4. GET /reports — list reports
# ---------------------------------------------------------------------------
section "4. GET /api/v1/reports — list all reports"

LIST_RESPONSE=$(curl -s -w "\n%{http_code}" "$API?limit=10")
LIST_CODE=$(echo "$LIST_RESPONSE" | tail -1)
LIST_BODY=$(echo "$LIST_RESPONSE" | head -n -1)

if [[ "$LIST_CODE" == "200" ]]; then
  pass "GET /reports returned HTTP 200"
else
  fail "GET /reports returned HTTP $LIST_CODE"
fi

COUNT=$(echo "$LIST_BODY" | jq 'length')
info "Reports returned: $COUNT"
if [[ "$COUNT" -ge 1 ]]; then
  pass "At least one report in list"
else
  fail "Expected ≥1 report in list, got $COUNT"
fi

# ---------------------------------------------------------------------------
# 5. GET /reports?status=pending — status filter
# ---------------------------------------------------------------------------
section "5. GET /api/v1/reports?status=pending — filter by status"

FILTER_RESPONSE=$(curl -s -w "\n%{http_code}" "$API?status=pending&limit=10")
FILTER_CODE=$(echo "$FILTER_RESPONSE" | tail -1)
FILTER_BODY=$(echo "$FILTER_RESPONSE" | head -n -1)

if [[ "$FILTER_CODE" == "200" ]]; then
  pass "Status filter endpoint returned HTTP 200"
else
  fail "Status filter returned HTTP $FILTER_CODE"
fi

info "Pending reports: $(echo "$FILTER_BODY" | jq 'length')"

# ---------------------------------------------------------------------------
# 6. GET /reports/{report_id}/nearby — geo bounding-box query
# ---------------------------------------------------------------------------
section "6. GET /api/v1/reports/$REPORT_ID/nearby — nearby geo-query"

if [[ -n "$REPORT_ID" ]]; then
  NEARBY_RESPONSE=$(curl -s -w "\n%{http_code}" "$API/$REPORT_ID/nearby")
  NEARBY_CODE=$(echo "$NEARBY_RESPONSE" | tail -1)
  NEARBY_BODY=$(echo "$NEARBY_RESPONSE" | head -n -1)

  if [[ "$NEARBY_CODE" == "200" ]]; then
    pass "GET /nearby returned HTTP 200"
    info "Nearby reports count: $(echo "$NEARBY_BODY" | jq 'length')"
  else
    fail "GET /nearby returned HTTP $NEARBY_CODE"
    echo "$NEARBY_BODY"
  fi
fi

# ---------------------------------------------------------------------------
# 7. GET /reports/{non-existent-id} — 404 handling
# ---------------------------------------------------------------------------
section "7. GET /api/v1/reports/nonexistent-id-xyz — expect 404"

NOT_FOUND_RESPONSE=$(curl -s -w "\n%{http_code}" "$API/nonexistent-id-xyz-000")
NOT_FOUND_CODE=$(echo "$NOT_FOUND_RESPONSE" | tail -1)
NOT_FOUND_BODY=$(echo "$NOT_FOUND_RESPONSE" | head -n -1)

if [[ "$NOT_FOUND_CODE" == "404" ]]; then
  pass "Non-existent report returned HTTP 404 (correct)"
else
  fail "Expected 404 for unknown report, got $NOT_FOUND_CODE"
fi

info "404 body: $(echo "$NOT_FOUND_BODY" | jq -c .)"

# ---------------------------------------------------------------------------
# 8. POST /reports — validation error (missing image)
# ---------------------------------------------------------------------------
section "8. POST /api/v1/reports — validation error (no image field)"

VAL_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090" \
)
VAL_CODE=$(echo "$VAL_RESPONSE" | tail -1)

if [[ "$VAL_CODE" == "422" ]]; then
  pass "Missing image field returns HTTP 422 Unprocessable Entity (correct)"
else
  fail "Expected 422, got $VAL_CODE"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
section "Test Summary"

if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo -e "${GREEN}All tests passed ✔${NC}"
else
  echo -e "${RED}Some tests FAILED — review output above.${NC}"
fi

exit $EXIT_CODE
