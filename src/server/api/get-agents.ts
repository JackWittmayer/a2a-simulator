import { Router } from "express";
import { agents, ipToAgent } from "../state";

const router = Router();

router.get("/agents", (req, res) => {
  const self = ipToAgent.get(req.ip!);
  const list = [...agents.values()]
    .filter((a) => a.name !== self)
    .map((a) => ({
      name: a.name,
      messageCount: a.messages.length,
    }));
  res.json({ agents: list });
});

export default router;
