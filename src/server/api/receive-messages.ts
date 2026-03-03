import { Router } from "express";
import { getOrCreateMailbox, ipToAgent, messageLog, cursors } from "../state";

const router = Router();

router.get("/messages", (req, res) => {
  const name = ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  getOrCreateMailbox(name);

  const ack = req.query.ack as string | undefined;
  if (ack) {
    const idx = messageLog.findIndex((m) => m.id === ack);
    if (idx !== -1) {
      cursors.set(name, Math.max(cursors.get(name) ?? 0, idx + 1));
    }
  }

  const cursor = cursors.get(name) ?? 0;
  const messages = messageLog.filter(
    (m, i) => i >= cursor && m.to === name,
  );
  res.json({ messages });
});

export default router;
