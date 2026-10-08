import { Router } from "express";
import { logoutSession } from "../session-store";

const router = Router();

router.post("/:userId/logout", async (req, res) => {
  try {
    await logoutSession(req.params.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
