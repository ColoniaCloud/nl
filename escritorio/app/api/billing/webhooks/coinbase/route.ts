import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { randomUUID } from "crypto";
import { getPool, ensureTables } from "@/lib/db-billing";
import { setUserPlan, calcPeriodEnd, toMysqlDatetime } from "@/lib/wp-billing";
import { convertReferral } from "@/lib/db-referrals";
import type { PlanSlug } from "@/lib/wp-billing";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!;

function verifySignature(rawBody: string, signature: string): boolean {
  try {
    const hmac = createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(rawBody);
    const expected = hmac.digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cc-webhook-signature") || "";

  if (!WEBHOOK_SECRET || !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: {
    id: string;
    type: string;
    data: {
      id: string;
      code: string;
      metadata?: {
        user_id?: string;
        plan_slug?: string;
        billing_cycle?: string;
        session_id?: string;
      };
      pricing?: { local?: { amount?: string } };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();

  // Idempotency: skip already-processed events
  const eventKey = `${event.id}::${event.type}`;
  const [existing] = await pool.execute(
    `SELECT id FROM bl_webhook_events WHERE id = ?`,
    [eventKey]
  ) as [Array<unknown>, unknown];

  if ((existing as unknown[]).length > 0) {
    return NextResponse.json({ received: true });
  }

  // Record this event first (idempotency lock)
  await pool.execute(
    `INSERT IGNORE INTO bl_webhook_events (id, gateway, event_type, payload)
     VALUES (?, 'coinbase', ?, ?)`,
    [eventKey, event.type, JSON.stringify(event)]
  );

  const chargeId = event.data?.id;
  const metadata = event.data?.metadata || {};

  if (event.type === "charge:confirmed") {
    const userId = metadata.user_id ? Number(metadata.user_id) : null;
    const planSlug = metadata.plan_slug as PlanSlug | undefined;
    const billingCycle = (metadata.billing_cycle || "monthly") as "monthly" | "annual";

    if (!userId || !planSlug) {
      console.error("[coinbase webhook] missing metadata", metadata);
      return NextResponse.json({ received: true });
    }

    const now = new Date();
    const periodEnd = calcPeriodEnd(billingCycle);
    const nowStr = toMysqlDatetime(now);
    const periodEndStr = toMysqlDatetime(periodEnd);
    const amount = parseFloat(event.data?.pricing?.local?.amount || "0");
    const subId = randomUUID();
    const invId = randomUUID();

    // Upsert subscription — if user has an existing row update it, else create
    const [existing] = await pool.execute(
      `SELECT id FROM bl_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    ) as [Array<{ id: string }>, unknown];

    if (existing[0]) {
      await pool.execute(
        `UPDATE bl_subscriptions
         SET plan_slug = ?, billing_cycle = ?, gateway = 'coinbase', gateway_charge_id = ?,
             status = 'active', current_period_start = ?, current_period_end = ?,
             cancel_at_period_end = 0, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [planSlug, billingCycle, chargeId, nowStr, periodEndStr, existing[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO bl_subscriptions
           (id, user_id, plan_slug, billing_cycle, gateway, gateway_charge_id,
            status, current_period_start, current_period_end)
         VALUES (?, ?, ?, ?, 'coinbase', ?, 'active', ?, ?)`,
        [subId, userId, planSlug, billingCycle, chargeId, nowStr, periodEndStr]
      );
    }

    const actualSubId = existing[0]?.id || subId;

    // Record invoice
    await pool.execute(
      `INSERT INTO bl_invoices
         (id, subscription_id, user_id, gateway, gateway_inv_id,
          amount_usd, currency, status, period_start, period_end, paid_at)
       VALUES (?, ?, ?, 'coinbase', ?, ?, 'USD', 'paid', ?, ?, ?)`,
      [invId, actualSubId, userId, chargeId, amount, nowStr, periodEndStr, nowStr]
    );

    // Update Coinbase charge status
    if (chargeId) {
      await pool.execute(
        `UPDATE bl_coinbase_charges SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE charge_id = ?`,
        [chargeId]
      );
    }

    // Activate plan in WordPress
    const wpResult = await setUserPlan(userId, planSlug);
    if (!wpResult.ok) {
      console.error("[coinbase webhook] WP set-plan failed:", wpResult.error, { userId, planSlug });
    }

    // Mark referral as converted
    await convertReferral(userId, planSlug).catch(() => {});

  } else if (event.type === "charge:failed" || event.type === "charge:expired") {
    if (chargeId) {
      await pool.execute(
        `UPDATE bl_coinbase_charges
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE charge_id = ?`,
        [event.type === "charge:failed" ? "FAILED" : "EXPIRED", chargeId]
      );
    }
  }

  return NextResponse.json({ received: true });
}
