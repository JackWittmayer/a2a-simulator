#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"

curl -s -X PUT "$SERVER_URL/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "left"}'
