import * as fs from "node:fs";

const SERVER_URL = process.env.SERVER_URL!;
const AGENT_NAME = process.env.AGENT_NAME!;
const MODEL_NAME = process.env.MODEL_NAME ?? "claude-sonnet-4-6";
const POLL_INTERVAL = 5000;

const SYSTEM_PROMPT = fs.existsSync("/workspace/.system-prompt")
  ? fs.readFileSync("/workspace/.system-prompt", "utf-8")
  : "";

const INITIAL_PROMPT = fs.existsSync("/workspace/.initial-prompt")
  ? fs.readFileSync("/workspace/.initial-prompt", "utf-8")
  : "";

interface ServerMessage {
  id: string;
  from: string;
  to: string;
  prompt: string;
  timestamp: string;
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

async function register() {
  const res = await fetch(`${SERVER_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: AGENT_NAME }),
  });
  if (!res.ok) {
    throw new Error(`Registration failed: ${res.status} ${await res.text()}`);
  }
  log("Registered with server");
}

async function pollMessages(): Promise<ServerMessage[]> {
  const res = await fetch(`${SERVER_URL}/messages`);
  if (!res.ok) return [];
  const body = await res.json() as { messages: ServerMessage[] };
  return body.messages ?? [];
}

async function checkIfLeft(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/status`);
    if (!res.ok) return false;
    const body = await res.json() as { status: string };
    return body.status === "left";
  } catch {
    return false;
  }
}

async function updateStatus(status: string) {
  try {
    await fetch(`${SERVER_URL}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {}
}

async function ackMessage(messageId: string) {
  await fetch(`${SERVER_URL}/messages/${encodeURIComponent(messageId)}/ack`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
}

function groupBySender(messages: ServerMessage[]): Map<string, ServerMessage[]> {
  const groups = new Map<string, ServerMessage[]>();
  for (const msg of messages) {
    const existing = groups.get(msg.from);
    if (existing) {
      existing.push(msg);
    } else {
      groups.set(msg.from, [msg]);
    }
  }
  return groups;
}

async function runQuery(
  queryFn: (opts: { prompt: string; options?: Record<string, unknown> }) => AsyncGenerator<{ session_id?: string; type: string; subtype?: string; result?: string }, void>,
  userMessage: string,
  sessionId: string | undefined,
): Promise<string> {
  const q = queryFn({
    prompt: userMessage,
    options: {
      model: MODEL_NAME,
      ...(sessionId ? { resume: sessionId } : { systemPrompt: SYSTEM_PROMPT }),
      cwd: "/workspace",
      settingSources: ["user", "project"],
      disallowedTools: ["AskUserQuestion", "EnterPlanMode"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  });

  let resultSessionId = sessionId ?? "";

  for await (const msg of q) {
    if (msg.session_id) {
      resultSessionId = msg.session_id;
    }
    console.log(JSON.stringify(msg));
  }

  return resultSessionId;
}

async function main() {
  const { query } = await import("/usr/local/lib/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs" as string);

  await register();

  let sessionId: string | undefined;
  let processing = false;

  if (INITIAL_PROMPT) {
    log(`Running initial prompt: ${INITIAL_PROMPT}`);
    await updateStatus("thinking");
    sessionId = await runQuery(query, INITIAL_PROMPT, sessionId);
    await updateStatus("idle");
    if (await checkIfLeft()) {
      log("Left after initial prompt");
      process.exit(0);
    }
  }

  async function tick() {
    if (processing) return;
    processing = true;

    try {
      const messages = await pollMessages();
      if (messages.length === 0) return;

      const grouped = groupBySender(messages);

      for (const [sender, senderMessages] of grouped) {
        const combined = senderMessages
          .map((m) => m.prompt)
          .join("\n\n");

        log(`${senderMessages.length} message(s) from ${sender}: ${combined}`);

        await updateStatus("thinking");
        sessionId = await runQuery(
          query,
          `[from ${sender}] ${combined}`,
          sessionId,
        );

        await updateStatus("idle");

        for (const msg of senderMessages) {
          await ackMessage(msg.id);
        }

        if (await checkIfLeft()) {
          log("Left conversation");
          clearInterval(interval);
          process.exit(0);
        }
      }
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      processing = false;
    }
  }

  log("Polling started");
  const interval = setInterval(tick, POLL_INTERVAL);
  tick();

  process.on("SIGTERM", () => {
    log("SIGTERM received, shutting down");
    clearInterval(interval);
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("SIGINT received, shutting down");
    clearInterval(interval);
    process.exit(0);
  });
}

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
