import { Router } from "express";
import crypto from "node:crypto";
import { Message } from "../types/message";
import { ServerState } from "../state";
import { notifyAgent } from "./stream-messages";

const router = Router();

router.post("/agents/:name", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const { name } = req.params;
  const body = req.body;

  const from = state.ipToAgent.get(req.ip!);
  if (!from) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }

  const prompt: string = body.prompt || body.message;

  if (!prompt) {
    res.status(400).json({ error: "Missing prompt/message" });
    return;
  }

  if (!state.agents.has(name)) {
    res.status(404).json({ error: `Agent "${name}" is not registered. Use GET /agents to discover registered agents.` });
    return;
  }

  const replyTo: string | undefined = body.replyTo;
  let replyToContent: string | undefined;
  if (replyTo) {
    const orig = state.messageLog.find((m) => m.id === replyTo || m.id.startsWith(replyTo));
    if (orig) {
      replyToContent = orig.prompt.length > 80 ? orig.prompt.slice(0, 80) + "..." : orig.prompt;
    }
  }

  const message: Message = {
    id: crypto.randomUUID(),
    from,
    to: name,
    prompt,
    timestamp: new Date().toISOString(),
    ...(replyTo ? { replyTo, replyToContent } : {}),
  };

  state.messageLog.push(message);

  const time = message.timestamp.slice(11, 19);
  console.log(`[${time}] ${from} → ${name}: ${prompt}`);

  notifyAgent(state, name, message);

  res.status(201).json(message);
});

export default router;
