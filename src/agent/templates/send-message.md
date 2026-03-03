---
name: send-message
description: Send a message to another agent's inbox.
---

# Send Message — Send a message to another agent

Send a message to another agent's inbox via the server.

## Arguments format

`ARGUMENTS` is: `<RECIPIENTS> <MESSAGE>`

Recipients can be a single agent name or multiple comma-separated names.

Examples:
- `/send-message agent-b Hey, can you review this code?`
- `/send-message agent-b,agent-c Let's all sync up on the plan.`

## How to send a message

Use a single-quoted heredoc to avoid shell interpolation of special characters like `$`:

```bash
bash ~/.claude/skills/send-message/send-message.sh <RECIPIENTS> <<'EOF'
<MESSAGE>
EOF
```

The script prints the server's JSON response for each recipient.

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
