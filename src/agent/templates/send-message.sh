#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
TO="$1"
shift
MESSAGE="$*"

BODY=$(jq -n --arg prompt "$MESSAGE" '{prompt: $prompt}')

IFS=',' read -ra RECIPIENTS <<< "$TO"
for recipient in "${RECIPIENTS[@]}"; do
  recipient=$(echo "$recipient" | xargs)
  curl -s -X POST "$SERVER_URL/agents/$recipient" \
    -H "Content-Type: application/json" \
    -d "$BODY"
  echo
done
