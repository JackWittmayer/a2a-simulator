#!/bin/bash
set -euo pipefail

echo "=== Agent Info ==="
echo "Name: ${AGENT_NAME:-unknown}"
echo "Server: ${SERVER_URL:-http://localhost:3000}"
echo "Model: ${MODEL_NAME:-unknown}"
echo ""
echo "=== System Prompt ==="
if [ -f /workspace/.system-prompt ]; then
  cat /workspace/.system-prompt
else
  echo "(not found)"
fi
echo ""
echo "=== Initial Prompt ==="
if [ -f /workspace/.initial-prompt ]; then
  cat /workspace/.initial-prompt
else
  echo "(not found)"
fi
