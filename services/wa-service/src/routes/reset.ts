import { Router } from "express";
import { resetSession } from "../session-store";

const router = Router();

router.post("/:userId/reset", async (req, res) => {
  try {
    await resetSession(req.params.userId);
    res.json({ ok: true, message: "Session reset completed" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
