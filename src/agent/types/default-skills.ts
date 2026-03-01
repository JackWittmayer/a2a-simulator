import { Skill } from "./skill";

const SEND_SKILL_MD = `# Send Message — Send a message to another agent

Send a message to another agent's inbox via the server.

## Arguments format

\`ARGUMENTS\` is: \`<AGENT_NAME> <MESSAGE>\`

Example: \`/send-message agent-b Hey, can you review this code?\`

## How to send a message

\`\`\`bash
bash ~/.claude/skills/send-message/send.sh <AGENT_NAME> "<MESSAGE>"
\`\`\`

The script prints the server's JSON response (id, from, to, prompt, timestamp).

## Environment variables

- \`SERVER_URL\` — server base URL (default: http://localhost:3000)
- \`AGENT_NAME\` — your own agent name (used as the "from" field)
`;

const SEND_SH = `#!/bin/bash
set -euo pipefail

SERVER_URL="\${SERVER_URL:-http://localhost:3000}"
FROM="\${AGENT_NAME:-unknown}"
TO="\$1"
shift
MESSAGE="\$*"

BODY=\$(jq -n --arg from "\$FROM" --arg prompt "\$MESSAGE" '{from: \$from, prompt: \$prompt}')

curl -s -X POST "\$SERVER_URL/agents/\$TO" \\
  -H "Content-Type: application/json" \\
  -d "\$BODY"
`;

const RECEIVE_SKILL_MD = `# Receive Messages — Check your inbox

Check your inbox for messages from other agents.

## How to check for messages

\`\`\`bash
bash ~/.claude/skills/receive-messages/receive.sh
\`\`\`

The script prints the JSON messages array from your inbox.

## Environment variables

- \`SERVER_URL\` — server base URL (default: http://localhost:3000)
- \`AGENT_NAME\` — your own agent name
`;

const RECEIVE_SH = `#!/bin/bash
set -euo pipefail

SERVER_URL="\${SERVER_URL:-http://localhost:3000}"
NAME="\${AGENT_NAME:-unknown}"

curl -s "\$SERVER_URL/agents/\$NAME/messages"
`;

export function defaultSkills(): Skill[] {
  return [
    new Skill(
      "send-message",
      "Send a message to another agent's inbox.",
      SEND_SKILL_MD,
      [{ name: "send.sh", content: SEND_SH }],
    ),
    new Skill(
      "receive-messages",
      "Check your inbox for messages from other agents.",
      RECEIVE_SKILL_MD,
      [{ name: "receive.sh", content: RECEIVE_SH }],
    ),
  ];
}
