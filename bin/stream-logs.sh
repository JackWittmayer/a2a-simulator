#!/bin/bash
# Reads stream-json from claude --print and extracts readable text
# Each line is a JSON object; we extract assistant text and tool results
while IFS= read -r line; do
  type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
  case "$type" in
    assistant)
      echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text' 2>/dev/null
      ;;
    content_block_delta)
      echo -n "$(echo "$line" | jq -r '.delta.text // empty' 2>/dev/null)"
      ;;
    result)
      echo ""
      echo "$line" | jq -r '.result // empty' 2>/dev/null
      ;;
  esac
done
