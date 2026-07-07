import { Router } from "express";
import { getSession } from "../session-store";

const router = Router();

/**
 * 📌 STUB ENDPOINT - NO REAL DATA
 *
 * GET /sessions/:userId/history/:jid
 *
 * This endpoint only validates that a session exists for a given user.
 * It does NOT fetch real message history because Baileys doesn't persist it.
 *
 * To get message history:
 * 1. Query the `wa_messages` table in MySQL
 * 2. Filter by userId + jid to get conversation thread
 * 3. Sort by timestamp and return paginated results
 *
 * Expected response schema:
 * ```json
 * {
 *   "ok": true,
 *   "jid": "5491234567890@s.whatsapp.net",
 *   "messages": [
 *     {
 *       "id": "1234567890",
 *       "timestamp": "2026-01-12T10:30:00Z",
 *       "text": "Hello",
 *       "fromMe": false,
 *       "senderName": "John"
 *     }
 *   ],
 *   "hasMore": false
 * }
 * ```
 */
router.get("/:userId/history/:jid", (req, res) => {
  const session = getSession(req.params.userId);
  if (!session) return res.status(404).json({ error: "Sesión no iniciada" });

  const { userId, jid } = req.params;

  console.log(
    `[history] ℹ️  History stub queried for ${userId} / ${decodeURIComponent(jid)}`
  );

  // Stub response — real history should come from DB
  res.json({
    ok: true,
    status: session.status,
    notice: `Query wa_messages table for jid="${jid}" and userId="${userId}"`,
    jid: decodeURIComponent(jid),
    messages: [],
    hasMore: false,
  });
});

export default router;
