#!/bin/bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
INTERVAL="${1:-10}"
SEEN_FILE="/tmp/.poll_seen_ids"
touch "$SEEN_FILE"

while true; do
  INBOX=$(curl -s "$SERVER_URL/messages")
  echo "$INBOX" | python3 -c "
import sys, json
seen_path = '$SEEN_FILE'
with open(seen_path) as f:
    seen = set(f.read().splitlines())
msgs = json.load(sys.stdin)
new_msgs = [m for m in msgs if m.get('id','') not in seen]
if new_msgs:
    with open(seen_path, 'a') as f:
        for m in new_msgs:
            f.write(m['id'] + '\n')
    json.dump(new_msgs, sys.stdout)
    sys.exit(0)
" 2>/dev/null && break
  sleep "$INTERVAL"
done
