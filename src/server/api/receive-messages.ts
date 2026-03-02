import { Router } from "express";
import { getOrCreateMailbox, ipToAgent } from "../state";

const router = Router();

router.get("/messages", (req, res) => {
  const name = ipToAgent.get(req.ip!);
  if (!name) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const mailbox = getOrCreateMailbox(name);
  const messages = mailbox.messages.splice(0);
  res.json({ messages });
});

export default router;
