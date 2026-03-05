import { Router } from "express";
import { getOrCreateMailbox, ServerState } from "../state";

const router = Router();

router.get("/status", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const name = state.ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const mailbox = getOrCreateMailbox(state, name);
  res.json({ name, status: mailbox.status, statusUpdatedAt: mailbox.statusUpdatedAt });
});

router.put("/status", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const name = state.ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const { status } = req.body;
  const validStatuses = ["idle", "thinking", "left"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }
  const mailbox = getOrCreateMailbox(state, name);
  if (state.solved && status !== "left") {
    res.json({ name, status: mailbox.status, statusUpdatedAt: mailbox.statusUpdatedAt });
    return;
  }
  mailbox.status = status;
  mailbox.statusUpdatedAt = new Date().toISOString();
  res.json({ name, status, statusUpdatedAt: mailbox.statusUpdatedAt });
});

export default router;
