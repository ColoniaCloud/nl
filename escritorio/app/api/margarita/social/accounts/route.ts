import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";

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

// GET /api/margarita/social/accounts
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const [accounts] = (await pool.execute(
      `SELECT id, platform, account_name, page_id, token_expires_at, connected_at
       FROM mm_social_accounts WHERE user_id = ?`,
      [user.id]
    )) as any;

    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// DELETE /api/margarita/social/accounts?platform=facebook
export async function DELETE(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    if (!platform) return NextResponse.json({ error: "platform requerido" }, { status: 400 });

    await pool.execute(
      "DELETE FROM mm_social_accounts WHERE user_id = ? AND platform = ?",
      [user.id, platform]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
