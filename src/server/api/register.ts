import { Router } from "express";
import { getOrCreateMailbox, ServerState } from "../state";

const router = Router();

router.post("/register", (req, res) => {
  const state: ServerState = req.app.locals.state;
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  getOrCreateMailbox(state, name);
  state.ipToAgent.set(req.ip!, name);
  res.json({ registered: name });
});

export default router;
