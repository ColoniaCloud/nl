import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { resolveEmailCampaignRecipients, resolveEmailCampaignRecipientsByIds, MAX_MANUAL_CONTACTS } from "@/lib/email-campaign-recipients";
import { getEmailAccount } from "@/lib/email-transport";
import { runEmailCampaign } from "@/lib/email-campaign-runner";

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

// GET /api/margarita/crm/campaigns-email — historial de campañas de email
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
      `SELECT * FROM mm_email_campaigns WHERE user_id = ? ORDER BY created_at DESC`,
      [user.id]
    )) as any;

    return NextResponse.json({ campaigns: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// POST /api/margarita/crm/campaigns-email — crea y lanza una campaña de email
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

    const account = await getEmailAccount(user.id);
    if (!account || account.status !== "connected") {
      return NextResponse.json({ error: "Conectá tu cuenta de email antes de lanzar una campaña" }, { status: 422 });
    }

    const body = await req.json();
    const { name, mode, tagNames, contactIds, messages } = body as {
      name: string;
      mode: "tags" | "manual";
      tagNames?: string[];
      contactIds?: number[];
      messages: [{ subject: string; body: string }, { subject: string; body: string }, { subject: string; body: string }];
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
    if (!Array.isArray(messages) || messages.length !== 3 || messages.some((m) => !m?.subject?.trim() || !m?.body?.trim())) {
      return NextResponse.json({ error: "Se requieren asunto y contenido en los 3 mensajes" }, { status: 422 });
    }

    const recipients = mode === "manual"
      ? await resolveEmailCampaignRecipientsByIds(user.id, contactIds!)
      : await resolveEmailCampaignRecipients(user.id, tagNames!);

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay contactos con email válido para esa selección" }, { status: 422 });
    }

    const [campaignResult] = (await pool.execute(
      `INSERT INTO mm_email_campaigns (user_id, name, tag_names, segment_type, status, total_recipients, started_at)
       VALUES (?, ?, ?, ?, 'sending', ?, NOW())`,
      [user.id, name.trim(), mode === "manual" ? null : JSON.stringify(tagNames), mode === "manual" ? "manual" : "tags", recipients.length]
    )) as any;
    const campaignId = campaignResult.insertId;

    for (let i = 0; i < messages.length; i++) {
      await pool.execute(
        `INSERT INTO mm_email_campaign_messages (campaign_id, variant, subject, body_html) VALUES (?, ?, ?, ?)`,
        [campaignId, i + 1, messages[i].subject, messages[i].body]
      );
    }

    for (const r of recipients) {
      await pool.execute(
        `INSERT INTO mm_email_campaign_recipients (campaign_id, contact_id, email, name_snapshot) VALUES (?, ?, ?, ?)`,
        [campaignId, r.contactId, r.email, r.name]
      );
    }

    runEmailCampaign(user.id, campaignId).catch((e) => {
      console.error(`[campaigns-email] runEmailCampaign crashed for campaign ${campaignId}:`, e);
    });

    return NextResponse.json({ ok: true, campaignId, totalRecipients: recipients.length }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
