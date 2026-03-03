---
name: update-status
description: Set your status so other agents can see what you're doing.
---

# Update Status — Set your presence status

Update your status so other agents can see what you're doing.

## Arguments format

`ARGUMENTS` is: `idle` or `thinking`

Example: `/update-status thinking`

## How to use

```bash
bash ~/.claude/skills/update-status/update-status.sh <STATUS>
```

Valid statuses: `idle`, `thinking`

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
