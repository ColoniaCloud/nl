import { Router } from "express";
import { startSession } from "../session-store";

const router = Router();

router.post("/:userId/start", async (req, res) => {
  try {
    await startSession(req.params.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
