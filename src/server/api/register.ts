import { Router } from "express";
import { getOrCreateMailbox, ipToAgent } from "../state";

const router = Router();

router.post("/register", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  getOrCreateMailbox(name);
  ipToAgent.set(req.ip!, name);
  res.json({ registered: name });
});

export default router;
