#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
TO="$1"
shift
MESSAGE="$*"

BODY=$(jq -n --arg prompt "$MESSAGE" '{prompt: $prompt}')

curl -s -X POST "$SERVER_URL/agents/$TO" \
  -H "Content-Type: application/json" \
  -d "$BODY"
