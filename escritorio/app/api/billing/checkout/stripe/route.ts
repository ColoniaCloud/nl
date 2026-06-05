import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { getPool, ensureTables, getUserId, COOKIE_NAME } from "@/lib/db-billing";
import { PLANS, getPlanPrice } from "@/lib/billing-plans";
import type { PlanId, BillingCycle } from "@/lib/billing-plans";

export const runtime = "nodejs";
export const maxDuration = 30;

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// POST /api/billing/checkout/stripe
// Body: { planId: "basic"|"pro"|"elite", billingCycle: "monthly"|"annual" }
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { planId: PlanId; billingCycle: BillingCycle };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { planId, billingCycle } = body;
  const plan = PLANS[planId];
  if (!plan || planId === "free") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return NextResponse.json({ error: "invalid_cycle" }, { status: 400 });
  }

  const amountUsd = getPlanPrice(planId, billingCycle);
  const amountCents = Math.round(amountUsd * 100);
  if (amountCents === 0) {
    return NextResponse.json({ error: "invalid_plan_for_payment" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata: {
      userId: String(session.userId),
      planId,
      planSlug: plan.slug,
      billingCycle,
    },
    description: `NL360 ${plan.name} · ${billingCycle}`,
  });

  await ensureTables();
  const pool = getPool();

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.execute(
    `INSERT INTO bl_checkout_sessions
       (user_id, plan_slug, billing_cycle, gateway, gateway_session_id, expires_at)
     VALUES (?, ?, ?, 'stripe', ?, ?)`,
    [
      session.userId,
      plan.slug,
      billingCycle,
      paymentIntent.id,
      expiresAt.toISOString().slice(0, 19).replace("T", " "),
    ]
  );

  return NextResponse.json({
    ok: true,
    clientSecret: paymentIntent.client_secret,
    amount: amountUsd,
    planName: plan.name,
  });
}
