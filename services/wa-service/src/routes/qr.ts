import { Router } from "express";
import { getSession } from "../session-store";

const router = Router();

router.get("/:userId/qr", (req, res) => {
  const session = getSession(req.params.userId);
  if (!session) return res.status(404).json({ error: "Sesión no iniciada" });
  res.json({ qrBase64: session.qrBase64, status: session.status });
});

export default router;
