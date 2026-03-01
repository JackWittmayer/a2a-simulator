#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
NAME="${AGENT_NAME:-unknown}"

curl -s "$SERVER_URL/agents/$NAME/messages"
