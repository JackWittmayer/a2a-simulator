#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
FROM="${AGENT_NAME:-unknown}"
TO="$1"
shift
MESSAGE="$*"

BODY=$(jq -n --arg from "$FROM" --arg prompt "$MESSAGE" '{from: $from, prompt: $prompt}')

curl -s -X POST "$SERVER_URL/agents/$TO" \
  -H "Content-Type: application/json" \
  -d "$BODY"
