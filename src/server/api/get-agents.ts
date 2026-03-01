import { Router } from "express";
import { agents } from "../state";

const router = Router();

router.get("/agents", (_req, res) => {
  const list = [...agents.values()].map((a) => ({
    name: a.name,
    messageCount: a.messages.length,
  }));
  res.json({ agents: list });
});

export default router;
