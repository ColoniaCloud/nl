import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { decryptToken } from "@/lib/margarita-encrypt";
import { getMetaInsights } from "@/lib/margarita-social";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    return data.user?.id ? { id: data.user.id } : null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id } : null;
}

// POST /api/margarita/social/audit
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const [accounts] = (await pool.execute(
      "SELECT * FROM mm_social_accounts WHERE user_id = ?",
      [user.id]
    )) as any;

    const auditResults: Record<string, any> = {};

    for (const account of accounts) {
      const accessToken = decryptToken(account.access_token);
      if (!accessToken) continue;

      try {
        if (account.platform === "facebook" && account.page_id) {
          const insights = await getMetaInsights(account.page_id, accessToken);
          auditResults.facebook = {
            account_name: account.account_name,
            insights: insights?.data || null,
          };
        } else if (account.platform === "instagram") {
          // Instagram insights require page token + Instagram user ID
          auditResults.instagram = {
            account_name: account.account_name,
            note: "Instagram insights requieren configuracion adicional",
          };
        } else if (account.platform === "linkedin") {
          auditResults.linkedin = {
            account_name: account.account_name,
            note: "LinkedIn insights disponibles con w_organization_social scope",
          };
        } else {
          auditResults[account.platform] = {
            account_name: account.account_name,
            status: "connected",
          };
        }
      } catch {
        auditResults[account.platform] = { error: "No se pudo auditar" };
      }
    }

    return NextResponse.json({ audit: auditResults });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
