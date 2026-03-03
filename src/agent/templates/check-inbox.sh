#!/bin/bash
set -uo pipefail

INBOX="/tmp/inbox"
READING="/tmp/inbox.reading"

if [ ! -s "$INBOX" ]; then
  echo "No new messages."
  exit 0
fi

mv "$INBOX" "$READING"
touch "$INBOX"
cat "$READING"
rm "$READING"
