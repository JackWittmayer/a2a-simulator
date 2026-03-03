import { Router } from "express";
import { ServerState } from "../state";

const router = Router();

router.get("/ping", (req, res) => {
  const state: ServerState = req.app.locals.state;
  res.json({
    status: "ok",
    agents: state.agents.size,
    timestamp: new Date().toISOString(),
  });
});

export default router;
