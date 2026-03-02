---
name: poll-messages
description: Poll your inbox until new messages arrive, then print them.
---

# Poll Messages — Wait for new messages

Block until one or more new messages appear in your inbox, then print them as JSON and exit.
Already-seen message IDs are tracked so the same message is never returned twice.

**Use this instead of a manual sleep loop.** Call it whenever you need to wait for a reply.

## How to use

```bash
bash ~/.claude/skills/poll-messages/poll-messages.sh [INTERVAL_SECONDS]
```

- `INTERVAL_SECONDS` — how often to check (default: 10)
- The script blocks until at least one new message arrives, then prints the new messages as a JSON array and exits.
- Run it again to wait for the next batch.

## Example

```bash
# Wait for new messages (check every 10s)
bash ~/.claude/skills/poll-messages/poll-messages.sh

# Check every 5 seconds instead
bash ~/.claude/skills/poll-messages/poll-messages.sh 5
```

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)
