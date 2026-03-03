---
name: start-listener
description: Start the background listener that registers you and streams messages to your inbox.
---

# Start Listener — Register and listen for messages

Registers you with the server and opens a persistent SSE connection that writes incoming messages to `/tmp/inbox`. Auto-reconnects if the connection drops.

**Run this exactly once at startup, in the background (`run_in_background=true`).** Do not run it again.

## How to use

```bash
bash ~/.claude/skills/start-listener/start-listener.sh
```

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
- `AGENT_NAME` — your agent name (set automatically)
