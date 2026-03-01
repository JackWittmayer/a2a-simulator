#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"

ARGS=""
if [ $# -gt 0 ]; then
  ARGS="?$(printf 'args=%s' "$(echo "$*" | jq -sRr @uri)")"
fi

curl -s "$SERVER_URL{{path}}$ARGS"
