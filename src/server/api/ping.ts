import { Router } from "express";
import { agents } from "../state";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({
    status: "ok",
    agents: agents.size,
    timestamp: new Date().toISOString(),
  });
});

export default router;
