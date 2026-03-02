---
name: ping
description: Check if the messaging server is running.
---

# Ping — Check if the messaging server is running

Ping the messaging server to verify connectivity.

## How to use

```bash
bash ~/.claude/skills/ping/ping.sh
```

Returns `{"status":"ok"}` if the server is reachable.

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
