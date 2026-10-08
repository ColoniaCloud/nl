import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { resolveCampaignRecipients, resolveCampaignRecipientsByIds, MAX_MANUAL_CONTACTS } from "@/lib/campaign-recipients";
import { waFetch } from "@/lib/wa-client";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

// GET /api/margarita/crm/campaigns — historial de campañas
export async function GET() {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const [rows] = (await pool.execute(
      `SELECT * FROM mm_campaigns WHERE user_id = ? ORDER BY created_at DESC`,
      [user.id]
    )) as any;

    return NextResponse.json({ campaigns: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// POST /api/margarita/crm/campaigns — crea y lanza una campaña
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const body = await req.json();
    const { name, mode, tagNames, contactIds, messages, imageUrl } = body as {
      name: string;
      mode: "tags" | "manual";
      tagNames?: string[];
      contactIds?: number[];
      messages: [string, string, string];
      imageUrl?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre de la campaña es requerido" }, { status: 422 });
    }
    if (mode === "manual") {
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json({ error: "Seleccioná al menos un contacto" }, { status: 422 });
      }
      if (contactIds.length > MAX_MANUAL_CONTACTS) {
        return NextResponse.json({ error: `Máximo ${MAX_MANUAL_CONTACTS} contactos por selección manual` }, { status: 422 });
      }
    } else if (!Array.isArray(tagNames) || tagNames.length === 0) {
      return NextResponse.json({ error: "Seleccioná al menos una etiqueta" }, { status: 422 });
    }
    if (!Array.isArray(messages) || messages.length !== 3 || messages.some((m) => !m?.trim())) {
      return NextResponse.json({ error: "Se requieren los 3 mensajes" }, { status: 422 });
    }

    const recipients = mode === "manual"
      ? await resolveCampaignRecipientsByIds(user.id, contactIds!)
      : await resolveCampaignRecipients(user.id, tagNames!);

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay contactos con WhatsApp válido para esa selección" }, { status: 422 });
    }

    const [campaignResult] = (await pool.execute(
      `INSERT INTO mm_campaigns (user_id, name, tag_names, segment_type, image_url, status, total_recipients, started_at)
       VALUES (?, ?, ?, ?, ?, 'sending', ?, NOW())`,
      [user.id, name.trim(), mode === "manual" ? null : JSON.stringify(tagNames), mode === "manual" ? "manual" : "tags", imageUrl || null, recipients.length]
    )) as any;
    const campaignId = campaignResult.insertId;

    for (let i = 0; i < messages.length; i++) {
      await pool.execute(
        `INSERT INTO mm_campaign_messages (campaign_id, variant, body) VALUES (?, ?, ?)`,
        [campaignId, i + 1, messages[i]]
      );
    }

    const recipientIds: number[] = [];
    for (const r of recipients) {
      const [rRes] = (await pool.execute(
        `INSERT INTO mm_campaign_recipients (campaign_id, contact_id, jid, name_snapshot, phone_snapshot)
         VALUES (?, ?, ?, ?, ?)`,
        [campaignId, r.contactId, r.jid, r.name, r.phone]
      )) as any;
      recipientIds.push(rRes.insertId);
    }

    try {
      await waFetch(String(user.id), "/campaigns/start", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          recipients: recipients.map((r, i) => ({ recipientId: recipientIds[i], jid: r.jid })),
          messages,
          imageUrl: imageUrl || undefined,
        }),
      });
    } catch (e: any) {
      await pool.execute(`UPDATE mm_campaigns SET status = 'failed' WHERE id = ?`, [campaignId]);
      return NextResponse.json({ error: e?.message || "No se pudo iniciar el envío" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, campaignId, totalRecipients: recipients.length }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
