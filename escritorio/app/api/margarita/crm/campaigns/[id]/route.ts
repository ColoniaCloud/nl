import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";

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

// GET /api/margarita/crm/campaigns/[id] — detalle + desglose de destinatarios
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const [[campaign]] = (await pool.execute(
      `SELECT * FROM mm_campaigns WHERE id = ? AND user_id = ?`,
      [id, user.id]
    )) as any;
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    const [messages] = (await pool.execute(
      `SELECT variant, body FROM mm_campaign_messages WHERE campaign_id = ? ORDER BY variant ASC`,
      [id]
    )) as any;

    const [recipients] = (await pool.execute(
      `SELECT id, contact_id, jid, name_snapshot, phone_snapshot, variant_used, status, error, sent_at, delivered_at, read_at
       FROM mm_campaign_recipients WHERE campaign_id = ? ORDER BY id ASC`,
      [id]
    )) as any;

    return NextResponse.json({ campaign, messages, recipients });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
