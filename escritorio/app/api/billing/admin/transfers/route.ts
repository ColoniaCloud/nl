import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";

export const runtime = "nodejs";

async function adminAuth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const meta = await getUserMeta(token);
  if (!meta?.isAdmin) return null;
  return meta;
}

// GET /api/billing/admin/transfers?status=pending&limit=50&offset=0
export async function GET(req: NextRequest) {
  const admin = await adminAuth();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "50"), 100);
  const offset = Number(req.nextUrl.searchParams.get("offset") || "0");

  await ensureTables();
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT id, user_id, plan_slug, billing_cycle, amount_usd,
            receipt_url, status, reviewed_by, reviewed_at, notes, created_at
     FROM bl_bank_transfers
     WHERE status = ?
     ORDER BY created_at ASC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [status]
  ) as [Array<Record<string, unknown>>, unknown];

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as total FROM bl_bank_transfers WHERE status = ?`,
    [status]
  ) as [Array<{ total: number }>, unknown];

  return NextResponse.json({
    ok: true,
    transfers: rows,
    total: countRows[0]?.total || 0,
  });
}
