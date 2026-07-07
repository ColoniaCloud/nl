import { Router } from "express";
import { getSession } from "../session-store";

const router = Router();

/**
 * 📌 STUB ENDPOINT - NO REAL DATA
 *
 * GET /sessions/:userId/contacts
 *
 * This endpoint only validates that a session exists.
 * It does NOT return actual contact lists because Baileys doesn't expose them in memory.
 *
 * To get contacts:
 * 1. Query the `wa_messages` table in MySQL for unique `jid` values
 * 2. Filter by userId to get conversations for that user
 * 3. Response will include extracted phone numbers and group JIDs
 *
 * Future: Consider implementing a caching layer that aggregates unique JIDs
 * from received messages and stores them in a Redis set.
 */
router.get("/:userId/contacts", async (req, res) => {
  const session = getSession(req.params.userId);
  if (!session || session.status !== "connected")
    return res.status(400).json({ error: "Sesión no conectada" });

  try {
    console.log(`[contacts] ℹ️  Contacts stub queried for ${req.params.userId}`);
    // Stub response — real contacts should come from DB
    res.json({
      ok: true,
      notice: "Use wa_messages table in MySQL for actual contacts",
      status: session.status,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
