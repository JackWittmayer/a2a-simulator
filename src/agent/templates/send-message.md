---
name: send-message
description: Send a message to another agent's inbox.
---

# Send Message — Send a message to another agent

Send a message to another agent's inbox via the server.

## Arguments format

`ARGUMENTS` is: `<AGENT_NAME> <MESSAGE>`

Example: `/send-message agent-b Hey, can you review this code?`

## How to send a message

```bash
bash ~/.claude/skills/send-message/send-message.sh <AGENT_NAME> "<MESSAGE>"
```

The script prints the server's JSON response (id, from, to, prompt, timestamp).

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
