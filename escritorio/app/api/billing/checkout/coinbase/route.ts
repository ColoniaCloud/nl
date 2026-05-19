import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getPool, ensureTables, getUserId, COOKIE_NAME } from "@/lib/db-billing";
import { PLANS, getPlanPrice } from "@/lib/billing-plans";
import { coinbaseAuthHeader } from "@/lib/coinbase-auth";
import type { PlanId, BillingCycle } from "@/lib/billing-plans";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nl360.site";

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// POST /api/billing/checkout/coinbase
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

  const amount = getPlanPrice(planId, billingCycle);
  const sessionId = randomUUID();

  // Create charge in Coinbase Commerce (CDP JWT auth)
  const authHeaders = await coinbaseAuthHeader("POST", "api.commerce.coinbase.com/charges");
  const cbRes = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `NL360 ${plan.name} ${billingCycle === "annual" ? "Anual" : "Mensual"}`,
      description: `Suscripcion NL360 plan ${plan.name} (${billingCycle})`,
      pricing_type: "fixed_price",
      local_price: { amount: String(amount), currency: "USD" },
      metadata: {
        user_id: String(session.userId),
        plan_id: planId,
        plan_slug: plan.slug,
        billing_cycle: billingCycle,
        session_id: sessionId,
      },
      redirect_url: `${APP_URL}/app/suscripcion/exito?session_id=${sessionId}`,
      cancel_url: `${APP_URL}/app/suscripcion`,
    }),
  });

  if (!cbRes.ok) {
    const err = await cbRes.json().catch(() => ({}));
    console.error("[coinbase checkout] error:", err);
    return NextResponse.json(
      { error: "coinbase_error", detail: (err as Record<string, unknown>)?.error },
      { status: 502 }
    );
  }

  const cbData = await cbRes.json();
  const charge = cbData.data;

  await ensureTables();
  const pool = getPool();

  // Store Coinbase charge
  await pool.execute(
    `INSERT INTO bl_coinbase_charges
       (charge_id, charge_code, user_id, plan_slug, billing_cycle, amount_usd, hosted_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW')`,
    [charge.id, charge.code, session.userId, plan.slug, billingCycle, amount, charge.hosted_url]
  );

  // Store checkout session
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.execute(
    `INSERT INTO bl_checkout_sessions
       (id, user_id, plan_slug, billing_cycle, gateway, gateway_session_id, expires_at)
     VALUES (?, ?, ?, ?, 'coinbase', ?, ?)`,
    [sessionId, session.userId, plan.slug, billingCycle, charge.id,
     expiresAt.toISOString().slice(0, 19).replace("T", " ")]
  );

  return NextResponse.json({ ok: true, url: charge.hosted_url });
}
