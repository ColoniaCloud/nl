import { NextRequest } from "next/server";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

// PNG transparente 1x1 — no depende de un archivo en disco.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

// GET /api/margarita/crm/campaigns-email/track?r=recipientId — píxel de apertura, sin auth
// (lo dispara el cliente de correo del destinatario, no el usuario logueado).
export async function GET(req: NextRequest) {
  const recipientId = req.nextUrl.searchParams.get("r");

  if (recipientId) {
    try {
      const pool = getPool();
      const [result] = (await pool.execute(
        `UPDATE mm_email_campaign_recipients SET status = 'opened', opened_at = NOW() WHERE id = ? AND status = 'sent'`,
        [recipientId]
      )) as any;
      if (result.affectedRows > 0) {
        await pool.execute(
          `UPDATE mm_email_campaigns c
           JOIN mm_email_campaign_recipients r ON r.campaign_id = c.id
           SET c.opened_count = c.opened_count + 1
           WHERE r.id = ?`,
          [recipientId]
        );
      }
    } catch {
      // Nunca romper la carga del píxel en el cliente de correo del destinatario.
    }
  }

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
