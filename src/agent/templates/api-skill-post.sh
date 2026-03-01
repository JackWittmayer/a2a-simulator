#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
MESSAGE="$*"

BODY=$(jq -n --arg message "$MESSAGE" '{message: $message}')

curl -s -X {{method}} "$SERVER_URL{{path}}" \
  -H "Content-Type: application/json" \
  -d "$BODY"
