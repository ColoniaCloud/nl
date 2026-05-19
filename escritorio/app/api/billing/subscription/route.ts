import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId, COOKIE_NAME } from "@/lib/db-billing";
import { setUserPlan, toMysqlDatetime } from "@/lib/wp-billing";

export const runtime = "nodejs";

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// GET /api/billing/subscription
// Returns the user's active subscription and latest invoice
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureTables();
  const pool = getPool();

  // Check if any active subscription has expired — downgrade if so
  const now = toMysqlDatetime(new Date());
  const [expired] = await pool.execute(
    `SELECT id, plan_slug FROM bl_subscriptions
     WHERE user_id = ? AND status = 'active' AND current_period_end IS NOT NULL AND current_period_end < ?`,
    [session.userId, now]
  ) as [Array<{ id: string; plan_slug: string }>, unknown];

  for (const row of expired) {
    await pool.execute(
      `UPDATE bl_subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [row.id]
    );
    // Downgrade to free in WordPress
    await setUserPlan(session.userId, "nl360_free");
  }

  const [rows] = await pool.execute(
    `SELECT id, plan_slug, billing_cycle, gateway, status,
            current_period_start, current_period_end, cancel_at_period_end,
            cancelled_at, created_at
     FROM bl_subscriptions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [session.userId]
  ) as [Array<Record<string, unknown>>, unknown];

  const subscription = rows[0] || null;

  const [invRows] = await pool.execute(
    `SELECT id, amount_usd, currency, status, paid_at, period_start, period_end, created_at
     FROM bl_invoices
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [session.userId]
  ) as [Array<Record<string, unknown>>, unknown];

  return NextResponse.json({
    ok: true,
    subscription,
    lastInvoice: invRows[0] || null,
  });
}

// PATCH /api/billing/subscription
// Body: { cancel: true } — schedule cancellation at period end
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { cancel?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (!body.cancel) {
    return NextResponse.json({ error: "unsupported_operation" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT id FROM bl_subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1`,
    [session.userId]
  ) as [Array<{ id: string }>, unknown];

  if (!rows[0]) {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 404 });
  }

  await pool.execute(
    `UPDATE bl_subscriptions
     SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [rows[0].id]
  );

  return NextResponse.json({ ok: true, message: "Suscripcion cancelada al final del periodo actual." });
}
