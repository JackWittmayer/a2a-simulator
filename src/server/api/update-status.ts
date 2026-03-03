import { Router } from "express";
import { getOrCreateMailbox, ipToAgent } from "../state";

const router = Router();

router.put("/status", (req, res) => {
  const name = ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const { status } = req.body;
  const validStatuses = ["idle", "thinking"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }
  const mailbox = getOrCreateMailbox(name);
  mailbox.status = status;
  mailbox.statusUpdatedAt = new Date().toISOString();
  res.json({ name, status, statusUpdatedAt: mailbox.statusUpdatedAt });
});

export default router;
