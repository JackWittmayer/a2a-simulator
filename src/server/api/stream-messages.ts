import { Router } from "express";
import { getOrCreateMailbox, ServerState } from "../state";
import { Message } from "../types/message";

const HEARTBEAT_INTERVAL_MS = 10_000;

const router = Router();

export function notifyAgent(state: ServerState, name: string, message: Message) {
  const client = state.sseClients.get(name);
  if (client) {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

router.get("/messages/stream", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const name = state.ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  getOrCreateMailbox(state, name);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send any backlog (unacked messages)
  const cursor = state.cursors.get(name) ?? 0;
  const backlog = state.messageLog.filter((m, i) => i >= cursor && m.to === name);
  for (const msg of backlog) {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  }

  state.sseClients.set(name, res);

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    state.sseClients.delete(name);
  });
});

export default router;
