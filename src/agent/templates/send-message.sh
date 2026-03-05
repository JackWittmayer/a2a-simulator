#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"

REPLY_TO=""
if [ "${1:-}" = "--reply-to" ]; then
  REPLY_TO="$2"
  shift 2
fi

TO="$1"
shift

if [ $# -gt 0 ]; then
  MESSAGE="$*"
else
  MESSAGE=$(cat)
fi

if [ -n "$REPLY_TO" ]; then
  BODY=$(jq -n --arg prompt "$MESSAGE" --arg replyTo "$REPLY_TO" '{prompt: $prompt, replyTo: $replyTo}')
else
  BODY=$(jq -n --arg prompt "$MESSAGE" '{prompt: $prompt}')
fi

IFS=',' read -ra RECIPIENTS <<< "$TO"
for recipient in "${RECIPIENTS[@]}"; do
  recipient=$(echo "$recipient" | xargs)
  curl -s -X POST "$SERVER_URL/agents/$recipient" \
    -H "Content-Type: application/json" \
    -d "$BODY"
  echo
done
