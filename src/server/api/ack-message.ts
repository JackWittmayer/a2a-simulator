import { Router } from "express";
import { getOrCreateMailbox, ServerState } from "../state";

const router = Router();

router.put("/messages/:id/ack", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const name = state.ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  getOrCreateMailbox(state, name);

  const messageId = req.params.id;
  const idx = state.messageLog.findIndex((m) => m.id === messageId);
  if (idx === -1) {
    res.status(404).json({ error: `Message "${messageId}" not found` });
    return;
  }

  state.cursors.set(name, Math.max(state.cursors.get(name) ?? 0, idx + 1));
  res.json({ acked: true, messageId });
});

export default router;
