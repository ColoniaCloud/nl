import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { getPool, ensureTables } from "@/lib/db-billing";
import { setUserPlan, calcPeriodEnd, toMysqlDatetime } from "@/lib/wp-billing";
import type { PlanSlug } from "@/lib/wp-billing";

export const runtime = "nodejs";

// POST /api/billing/webhooks/stripe
export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();

  // Idempotency: same pattern as coinbase webhook
  const eventKey = `${event.id}::${event.type}`;
  const [existing] = await pool.execute(
    `SELECT id FROM bl_webhook_events WHERE id = ?`,
    [eventKey]
  ) as [Array<unknown>, unknown];

  if ((existing as unknown[]).length > 0) {
    return NextResponse.json({ received: true });
  }

  await pool.execute(
    `INSERT IGNORE INTO bl_webhook_events (id, gateway, event_type, payload)
     VALUES (?, 'stripe', ?, ?)`,
    [eventKey, event.type, JSON.stringify(event)]
  );

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const { userId, planSlug, billingCycle } = pi.metadata as {
    userId: string;
    planSlug: PlanSlug;
    billingCycle: "monthly" | "annual";
  };
  const amountUsd = pi.amount / 100;

  if (!userId || !planSlug) {
    console.error("[stripe-webhook] missing metadata", pi.metadata);
    return NextResponse.json({ received: true });
  }

  const now = new Date();
  const periodEnd = calcPeriodEnd(billingCycle);
  const nowStr = toMysqlDatetime(now);
  const periodEndStr = toMysqlDatetime(periodEnd);

  // Upsert bl_subscriptions — same SELECT→UPDATE/INSERT pattern as coinbase
  const [subRows] = await pool.execute(
    `SELECT id FROM bl_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [Number(userId)]
  ) as [Array<{ id: string }>, unknown];

  if (subRows[0]) {
    await pool.execute(
      `UPDATE bl_subscriptions
       SET plan_slug = ?, billing_cycle = ?, gateway = 'stripe', gateway_charge_id = ?,
           status = 'active', current_period_start = ?, current_period_end = ?,
           cancel_at_period_end = 0, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [planSlug, billingCycle, pi.id, nowStr, periodEndStr, subRows[0].id]
    );
  } else {
    const subId = randomUUID();
    await pool.execute(
      `INSERT INTO bl_subscriptions
         (id, user_id, plan_slug, billing_cycle, gateway, gateway_charge_id,
          status, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, 'stripe', ?, 'active', ?, ?)`,
      [subId, Number(userId), planSlug, billingCycle, pi.id, nowStr, periodEndStr]
    );
  }

  // Fetch subscription id for invoice FK
  const [subRowsFinal] = await pool.execute(
    `SELECT id FROM bl_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [Number(userId)]
  ) as [Array<{ id: string }>, unknown];
  const subscriptionId = subRowsFinal[0]?.id ?? randomUUID();

  await pool.execute(
    `INSERT INTO bl_invoices
       (id, subscription_id, user_id, gateway, gateway_inv_id,
        amount_usd, currency, status, period_start, period_end, paid_at)
     VALUES (UUID(), ?, ?, 'stripe', ?, ?, 'USD', 'paid', ?, ?, NOW())`,
    [subscriptionId, Number(userId), pi.id, amountUsd, nowStr, periodEndStr]
  );

  await pool.execute(
    `UPDATE bl_checkout_sessions
     SET status = 'completed'
     WHERE gateway = 'stripe' AND gateway_session_id = ?`,
    [pi.id]
  );

  try {
    const r = await setUserPlan(Number(userId), planSlug);
    if (!r.ok) console.error("[stripe-webhook] setUserPlan failed:", r.error, { userId, planSlug });
  } catch (err) {
    console.error("[stripe-webhook] setUserPlan exception:", err);
  }

  return NextResponse.json({ received: true });
}
