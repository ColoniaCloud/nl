import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { resolveCampaignRecipients, resolveCampaignRecipientsByIds } from "@/lib/campaign-recipients";

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

// POST /api/margarita/crm/campaigns/preview — cuenta destinatarios sin crear la campaña
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

    const { mode, tagNames, contactIds } = (await req.json()) as {
      mode: "tags" | "manual";
      tagNames?: string[];
      contactIds?: number[];
    };

    let recipients;
    if (mode === "manual") {
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json({ count: 0, sample: [] });
      }
      recipients = await resolveCampaignRecipientsByIds(user.id, contactIds);
    } else {
      if (!Array.isArray(tagNames) || tagNames.length === 0) {
        return NextResponse.json({ count: 0, sample: [] });
      }
      recipients = await resolveCampaignRecipients(user.id, tagNames);
    }

    return NextResponse.json({
      count: recipients.length,
      sample: recipients.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
