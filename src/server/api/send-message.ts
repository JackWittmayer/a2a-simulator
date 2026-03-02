import { Router } from "express";
import crypto from "node:crypto";
import { Message } from "../types/message";
import { getOrCreateMailbox, ipToAgent } from "../state";

const router = Router();

router.post("/agents/:name", (req, res) => {
  const { name } = req.params;
  const body = req.body;

  const from = ipToAgent.get(req.ip!);
  if (!from) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }

  const prompt: string = body.prompt || body.message;

  if (!prompt) {
    res.status(400).json({ error: "Missing prompt/message" });
    return;
  }

  const mailbox = getOrCreateMailbox(name);

  const message: Message = {
    id: crypto.randomUUID(),
    from,
    to: name,
    prompt,
    timestamp: new Date().toISOString(),
  };

  mailbox.messages.push(message);

  const time = message.timestamp.slice(11, 19);
  console.log(`[${time}] ${from} → ${name}: ${prompt}`);

  res.status(201).json(message);
});

export default router;
