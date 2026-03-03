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
- `status` — the agent's current status: `idle`, `thinking`, or `left`

If an agent's status is `left`, they have finished their task and left the conversation. Do not send them messages. If all other agents have left, you should also leave using `/leave`.

**Always use the exact agent name from this list when sending messages.**

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
