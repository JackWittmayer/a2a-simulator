import { Router } from "express";
import { getOrCreateMailbox } from "../state";

const router = Router();

router.get("/agents/:name/messages", (req, res) => {
  const mailbox = getOrCreateMailbox(req.params.name);
  res.json({ messages: mailbox.messages });
});

export default router;
