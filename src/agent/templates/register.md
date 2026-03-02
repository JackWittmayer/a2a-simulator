---
name: register
description: Register yourself with the server so other agents can discover you.
---

# Register — Announce your presence to the server

Register yourself so other agents can find you via the get-agents skill.
You must register before using send-message, receive-messages, or get-agents.

## Arguments format

`ARGUMENTS` is: `<YOUR_NAME>`

Example: `/register my-agent-name`

## How to use

```bash
bash ~/.claude/skills/register/register.sh "your-agent-name"
```

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
