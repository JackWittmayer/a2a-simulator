import { Router } from "express";
import { ServerState } from "../state";

const router = Router();

router.get("/agents", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const self = state.ipToAgent.get(req.ip!);
  if (!self) {
    res.status(403).json({ error: "You must register first (POST /register)" });
    return;
  }
  const list = [...state.agents.values()]
    .filter((a) => a.name !== self)
    .map((a) => {
      const cursor = state.cursors.get(a.name) ?? 0;
      const messageCount = state.messageLog.filter(
        (m, i) => i >= cursor && m.to === a.name,
      ).length;
      return {
        name: a.name,
        messageCount,
        status: a.status,
        statusUpdatedAt: a.statusUpdatedAt,
      };
    });
  res.json({ agents: list });
});

export default router;
