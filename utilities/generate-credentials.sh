#!/usr/bin/env bash
#
# generate-credentials.sh — Generate an AlgoArena API key
#
# Requires: curl, jq, and a running AlgoArena API server.
#
# Usage:
#   ./docs/generate-credentials.sh                          # auto-reads MASTER_KEY from .env
#   ./docs/generate-credentials.sh --master-key <key>       # explicit master key
#
# Options:
#   --master-key <key>    Master key (or set MASTER_KEY env var)
#   --base-url <url>      API base URL (default: http://localhost:3000/api/v1)
#   --label <label>       Label for the API key
#   --help                Show this help message

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
MASTER_KEY="${MASTER_KEY:-}"
LABEL=""

usage() {
  sed -n '2,/^$/s/^# \?//p' "$0"
  exit 0
}

die() { echo -e "${RED}Error: $1${RESET}" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --master-key) MASTER_KEY="$2"; shift 2 ;;
    --base-url)   BASE_URL="$2"; shift 2 ;;
    --label)      LABEL="$2"; shift 2 ;;
    --help|-h)    usage ;;
    *)            die "Unknown option: $1" ;;
  esac
done

# Check dependencies
for cmd in curl jq; do
  command -v "$cmd" &>/dev/null || die "'$cmd' is required but not found."
done

# Resolve master key
if [[ -z "$MASTER_KEY" ]]; then
  # Try loading from .env at repo root
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="$SCRIPT_DIR/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    MASTER_KEY=$(grep -E '^MASTER_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')
  fi
fi

if [[ -z "$MASTER_KEY" ]]; then
  die "No master key found. Pass --master-key <key>, set MASTER_KEY env var, or add it to .env"
fi

echo -e "${BOLD}AlgoArena API Key Generator${RESET}"
echo -e "Server: ${CYAN}${BASE_URL}${RESET}\n"

# ── Create API Key ──────────────────────────────────────────────────────

echo -e "Creating API key..."

KEY_BODY='{}'
if [[ -n "$LABEL" ]]; then
  KEY_BODY=$(jq -n --arg l "$LABEL" '{"label": $l}')
fi

KEY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${BASE_URL}/auth/api-keys" \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: ${MASTER_KEY}" \
  -d "$KEY_BODY")

HTTP_CODE=$(echo "$KEY_RESPONSE" | tail -1)
KEY_BODY_RESP=$(echo "$KEY_RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "201" ]]; then
  echo -e "${RED}Failed to create API key (HTTP $HTTP_CODE):${RESET}"
  echo "$KEY_BODY_RESP" | jq . 2>/dev/null || echo "$KEY_BODY_RESP"
  exit 1
fi

RAW_KEY=$(echo "$KEY_BODY_RESP" | jq -r '.rawKey')
KEY_PREFIX=$(echo "$KEY_BODY_RESP" | jq -r '.keyPrefix')

echo -e "${GREEN}  ✓ API key created${RESET} (prefix: ${KEY_PREFIX}...)\n"

# ── Summary ─────────────────────────────────────────────────────────────

echo -e "${BOLD}─── API Key ───${RESET}"
echo -e "${GREEN}${RAW_KEY}${RESET}\n"
echo -e "${BOLD}─── Next Steps ───${RESET}"
echo -e "Create a CUID user with your new key:"
echo -e "  curl -X POST ${BASE_URL}/auth/users \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -H 'X-AlgoArena-API-Key: ${RAW_KEY}' \\"
echo -e "    -d '{\"label\": \"my-user\", \"startingBalance\": \"100000.00\", \"pdtEnforced\": true}'"
echo -e ""
echo -e "${YELLOW}⚠  Save this key — it cannot be retrieved again.${RESET}"
