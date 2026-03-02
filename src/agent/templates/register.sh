#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
NAME="$1"

curl -s -X POST "$SERVER_URL/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\"}"
