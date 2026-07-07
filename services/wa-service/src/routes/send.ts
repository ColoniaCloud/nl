import { Router } from "express";
import { getSession } from "../session-store";

const router = Router();

// 🔒 Validar formato de JID de WhatsApp
function isValidJID(jid: string): boolean {
  // JID debe ser: número@s.whatsapp.net o número@g.us
  return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid);
}

router.post("/:userId/send", async (req, res) => {
  const session = getSession(req.params.userId);
  if (!session || session.status !== "connected")
    return res.status(400).json({ error: "Sesión no conectada" });

  const { jid, text } = req.body as { jid: string; text: string };
  
  // ✅ Validación de entrada
  if (!jid || !text) {
    return res.status(400).json({ error: "jid y text requeridos" });
  }
  
  if (!isValidJID(jid)) {
    return res.status(400).json({
      error: "Invalid JID format. Expected: 5491234567890@s.whatsapp.net or groupId@g.us",
    });
  }
  
  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text must be a non-empty string" });
  }

  // 🔒 Límite de tamaño
  const MAX_TEXT_LENGTH = 1000;
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      error: `Message too long. Maximum ${MAX_TEXT_LENGTH} characters.`,
      received: text.length,
    });
  }

  try {
    await session.socket.sendMessage(jid, { text });
    console.log(`[send] ✅ Message sent to ${jid} for ${req.params.userId}`);
    res.json({ ok: true });
  } catch (e) {
    console.error(`[send] ❌ Error sending message to ${jid}:`, e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
