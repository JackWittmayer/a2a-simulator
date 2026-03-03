#!/bin/bash
set -uo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
NAME="${AGENT_NAME:-agent}"
INBOX="/tmp/inbox"

touch "$INBOX"

# Register
curl -s -X POST "$SERVER_URL/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\"}"

# Stream loop — auto-reconnect forever
while true; do
  curl -s -N "$SERVER_URL/messages/stream" 2>/dev/null | while IFS= read -r line; do
    case "$line" in
      data:*)
        MSG="${line#data: }"
        if echo "$MSG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'id' in d" 2>/dev/null; then
          echo "$MSG" >> "$INBOX"
          ID=$(echo "$MSG" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
          curl -s "$SERVER_URL/messages?ack=$ID" > /dev/null
        fi
        ;;
    esac
  done
  sleep 2
done
