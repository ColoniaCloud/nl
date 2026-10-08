import { Router } from "express";
import { getSession } from "../session-store";

const router = Router();

router.get("/:userId/status", (req, res) => {
  const session = getSession(req.params.userId);
  if (!session) return res.json({ status: "disconnected" });
  res.json({
    status: session.status,
    phone: session.phone,
    displayName: session.displayName,
    reconnectAttempts: session.reconnectAttempts,
    qrBase64: session.qrBase64,
  });
});

export default router;
