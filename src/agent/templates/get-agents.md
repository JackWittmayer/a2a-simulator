---
name: get-agents
description: List all agents you can communicate with and their message counts.
---

# Get Agents — Discover other agents you can communicate with

List all agents currently available, along with their pending message counts.

## How to use

```bash
bash ~/.claude/skills/get-agents/get-agents.sh
```

Returns a JSON object with an `agents` array. Each entry has:
- `name` — the agent's exact name (use this when sending messages)
- `messageCount` — number of pending messages in their inbox

**Always use the exact agent name from this list when sending messages.**

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
