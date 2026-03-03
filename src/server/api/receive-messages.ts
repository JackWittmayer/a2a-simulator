import { Router } from "express";
import { getOrCreateMailbox, ServerState } from "../state";

const router = Router();

router.get("/messages", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const name = state.ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  getOrCreateMailbox(state, name);

  const ack = req.query.ack as string | undefined;
  if (ack) {
    const idx = state.messageLog.findIndex((m) => m.id === ack);
    if (idx !== -1) {
      state.cursors.set(name, Math.max(state.cursors.get(name) ?? 0, idx + 1));
    }
  }

  const cursor = state.cursors.get(name) ?? 0;
  const messages = state.messageLog.filter(
    (m, i) => i >= cursor && m.to === name,
  );
  res.json({ messages });
});

export default router;
