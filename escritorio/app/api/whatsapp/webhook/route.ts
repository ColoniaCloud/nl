export const runtime = "nodejs";
export const maxDuration = 15;

import { upsertWaSession, saveWaMessage } from "@/lib/db-whatsapp";
import getPool from "@/lib/db-manu";

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

    case "CAMPAIGN_MESSAGE_SENT": {
      const pool = getPool();
      await pool.execute(
        `UPDATE mm_campaign_recipients SET status = 'sent', variant_used = ?, wa_message_id = ?, sent_at = NOW() WHERE id = ?`,
        [data.variantUsed, data.waMessageId ?? null, data.recipientId]
      );
      await pool.execute(
        `UPDATE mm_campaigns SET sent_count = sent_count + 1 WHERE id = ?`,
        [data.campaignId]
      );
      break;
    }

    case "CAMPAIGN_MESSAGE_FAILED": {
      const pool = getPool();
      await pool.execute(
        `UPDATE mm_campaign_recipients SET status = 'failed', error = ? WHERE id = ?`,
        [String(data.error ?? ""), data.recipientId]
      );
      await pool.execute(
        `UPDATE mm_campaigns SET failed_count = failed_count + 1 WHERE id = ?`,
        [data.campaignId]
      );
      break;
    }

    case "CAMPAIGN_MESSAGE_ACK": {
      const pool = getPool();
      // Solo transiciona hacia adelante (sent → delivered → read) y solo suma
      // el contador de la campaña si la fila realmente cambió, para no contar dos veces.
      if (data.status === "delivered") {
        const [result] = (await pool.execute(
          `UPDATE mm_campaign_recipients SET status = 'delivered', delivered_at = NOW() WHERE id = ? AND status = 'sent'`,
          [data.recipientId]
        )) as any;
        if (result.affectedRows > 0) {
          await pool.execute(`UPDATE mm_campaigns SET delivered_count = delivered_count + 1 WHERE id = ?`, [data.campaignId]);
        }
      } else if (data.status === "read") {
        const [result] = (await pool.execute(
          `UPDATE mm_campaign_recipients SET status = 'read', read_at = NOW() WHERE id = ? AND status IN ('sent', 'delivered')`,
          [data.recipientId]
        )) as any;
        if (result.affectedRows > 0) {
          await pool.execute(`UPDATE mm_campaigns SET read_count = read_count + 1 WHERE id = ?`, [data.campaignId]);
        }
      }
      break;
    }

    case "CAMPAIGN_COMPLETED": {
      const pool = getPool();
      await pool.execute(
        `UPDATE mm_campaigns SET status = 'completed', completed_at = NOW() WHERE id = ? AND status = 'sending'`,
        [data.campaignId]
      );
      break;
    }

    case "CAMPAIGN_CANCELLED": {
      const pool = getPool();
      await pool.execute(
        `UPDATE mm_campaigns SET status = 'cancelled', completed_at = NOW() WHERE id = ?`,
        [data.campaignId]
      );
      break;
    }
  }

  return Response.json({ ok: true });
}
