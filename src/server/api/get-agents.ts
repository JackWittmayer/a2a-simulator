import { Router } from "express";
import { agents, ipToAgent } from "../state";

const router = Router();

router.get("/agents", (req, res) => {
  const self = ipToAgent.get(req.ip!);
  if (!self) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const list = [...agents.values()]
    .filter((a) => a.name !== self)
    .map((a) => ({
      name: a.name,
      messageCount: a.messages.length,
    }));
  res.json({ agents: list });
});

export default router;
