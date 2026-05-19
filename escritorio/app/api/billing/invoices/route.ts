import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId, COOKIE_NAME } from "@/lib/db-billing";

export const runtime = "nodejs";

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// GET /api/billing/invoices?limit=20&offset=0
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "20"), 50);
  const offset = Number(req.nextUrl.searchParams.get("offset") || "0");

  await ensureTables();
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT id, subscription_id, gateway, gateway_inv_id,
            amount_usd, currency, status, paid_at,
            period_start, period_end, created_at
     FROM bl_invoices
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [session.userId]
  ) as [Array<Record<string, unknown>>, unknown];

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as total FROM bl_invoices WHERE user_id = ?`,
    [session.userId]
  ) as [Array<{ total: number }>, unknown];

  return NextResponse.json({
    ok: true,
    invoices: rows,
    total: countRows[0]?.total || 0,
  });
}
