export const runtime = "nodejs";
export const maxDuration = 15;

import { upsertWaSession, saveWaMessage } from "@/lib/db-whatsapp";

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WA_WEBHOOK_SECRET)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId, event, data } = await req.json();
  if (!userId || !event) return Response.json({ error: "Payload inválido" }, { status: 400 });

  switch (event) {
    case "QR_UPDATE":
      await upsertWaSession(userId, {
        status:        "qr_pending",
        qr_code:       data.qrBase64,
        qr_expires_at: new Date(Date.now() + 60_000),
      });
      break;

    case "CONNECTED":
      await upsertWaSession(userId, {
        status:       "connected",
        phone:        data.phone ?? null,
        display_name: data.displayName ?? null,
        qr_code:      null,
        connected_at: new Date(),
      });
      break;

    case "DISCONNECTED":
      await upsertWaSession(userId, {
        status:  "disconnected",
        qr_code: null,
      });
      break;

    case "MESSAGE_INBOUND": {
      const msg = data.message as any;
      const body =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        "[media]";
      await saveWaMessage({
        wa_id:     msg.key.id,
        user_id:   userId,
        direction: "inbound",
        jid:       msg.key.remoteJid,
        body,
        media_url: null,
        mimetype:  null,
        ts:        new Date(Number(msg.messageTimestamp) * 1000),
      });
      break;
    }
  }

  return Response.json({ ok: true });
}
