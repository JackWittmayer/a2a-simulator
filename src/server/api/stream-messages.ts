import { Router, Response } from "express";
import { getOrCreateMailbox, ipToAgent, messageLog, cursors } from "../state";
import { Message } from "../types/message";

const HEARTBEAT_INTERVAL_MS = 10_000;

const router = Router();

export const sseClients = new Map<string, Response>();

export function notifyAgent(name: string, message: Message) {
  const client = sseClients.get(name);
  if (client) {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

router.get("/messages/stream", (req, res) => {
  const name = ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  getOrCreateMailbox(name);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send any backlog (unacked messages)
  const cursor = cursors.get(name) ?? 0;
  const backlog = messageLog.filter((m, i) => i >= cursor && m.to === name);
  for (const msg of backlog) {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  }

  sseClients.set(name, res);

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(name);
  });
});

export default router;
