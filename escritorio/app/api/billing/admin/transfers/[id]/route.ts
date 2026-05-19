import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getPool, ensureTables, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import { setUserPlan, calcPeriodEnd, toMysqlDatetime } from "@/lib/wp-billing";
import { convertReferral } from "@/lib/db-referrals";
import type { PlanSlug } from "@/lib/wp-billing";

export const runtime = "nodejs";

async function adminAuth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const meta = await getUserMeta(token);
  if (!meta?.isAdmin) return null;
  return meta;
}

// PATCH /api/billing/admin/transfers/[id]
// Body: { action: "approve" | "reject", notes?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await adminAuth();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  let body: { action: "approve" | "reject"; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT id, user_id, plan_slug, billing_cycle, amount_usd, status
     FROM bl_bank_transfers WHERE id = ?`,
    [id]
  ) as [Array<{
    id: string; user_id: number; plan_slug: PlanSlug;
    billing_cycle: "monthly" | "annual"; amount_usd: number; status: string;
  }>, unknown];

  const transfer = rows[0];
  if (!transfer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (transfer.status !== "pending") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  const reviewedAt = toMysqlDatetime(new Date());

  await pool.execute(
    `UPDATE bl_bank_transfers
     SET status = ?, reviewed_by = ?, reviewed_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [body.action === "approve" ? "approved" : "rejected", admin.id, reviewedAt, body.notes || null, id]
  );

  if (body.action === "approve") {
    const now = new Date();
    const periodEnd = calcPeriodEnd(transfer.billing_cycle);
    const nowStr = toMysqlDatetime(now);
    const periodEndStr = toMysqlDatetime(periodEnd);
    const subId = randomUUID();
    const invId = randomUUID();

    // Upsert subscription
    const [existing] = await pool.execute(
      `SELECT id FROM bl_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [transfer.user_id]
    ) as [Array<{ id: string }>, unknown];

    if (existing[0]) {
      await pool.execute(
        `UPDATE bl_subscriptions
         SET plan_slug = ?, billing_cycle = ?, gateway = 'bank', gateway_charge_id = ?,
             status = 'active', current_period_start = ?, current_period_end = ?,
             cancel_at_period_end = 0, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [transfer.plan_slug, transfer.billing_cycle, transfer.id,
         nowStr, periodEndStr, existing[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO bl_subscriptions
           (id, user_id, plan_slug, billing_cycle, gateway, gateway_charge_id,
            status, current_period_start, current_period_end)
         VALUES (?, ?, ?, ?, 'bank', ?, 'active', ?, ?)`,
        [subId, transfer.user_id, transfer.plan_slug, transfer.billing_cycle,
         transfer.id, nowStr, periodEndStr]
      );
    }

    const actualSubId = existing[0]?.id || subId;

    // Invoice
    await pool.execute(
      `INSERT INTO bl_invoices
         (id, subscription_id, user_id, gateway, gateway_inv_id,
          amount_usd, currency, status, period_start, period_end, paid_at)
       VALUES (?, ?, ?, 'bank', ?, ?, 'USD', 'paid', ?, ?, ?)`,
      [invId, actualSubId, transfer.user_id, transfer.id,
       transfer.amount_usd, nowStr, periodEndStr, nowStr]
    );

    // Activate plan in WordPress
    const wpResult = await setUserPlan(transfer.user_id, transfer.plan_slug);
    if (!wpResult.ok) {
      console.error("[admin transfers] WP set-plan failed:", wpResult.error);
    }

    // Mark referral as converted
    await convertReferral(transfer.user_id, transfer.plan_slug).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    action: body.action,
    message: body.action === "approve"
      ? "Plan activado correctamente."
      : "Transferencia rechazada.",
  });
}
