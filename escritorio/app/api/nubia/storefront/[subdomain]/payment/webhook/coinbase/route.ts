import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, getPaymentConfig, getOrderByNumber, updateOrderPayment } from "@/lib/nubia/db-nubia";
import { verifyCoinbaseWebhook } from "@/lib/nubia/nubia-payments";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const { subdomain } = params;
  const rawBody = await req.text();
  const signature = req.headers.get("x-cc-webhook-signature") || "";

  const project = await getProjectBySubdomain(subdomain);
  if (!project) return NextResponse.json({ ok: true });

  const payConfig = await getPaymentConfig(project.id);
  if (!payConfig?.coinbase_webhook_secret) return NextResponse.json({ ok: true });

  const valid = await verifyCoinbaseWebhook(rawBody, signature, payConfig.coinbase_webhook_secret);
  if (!valid) {
    console.warn(`[nubia/webhook/coinbase] Invalid signature for subdomain: ${subdomain}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  const type = event.event?.type;
  const metadata = event.event?.data?.metadata;
  const chargeId = event.event?.data?.id;

  if (!metadata?.order_number) return NextResponse.json({ ok: true });

  const order = await getOrderByNumber(metadata.order_number, project.id);
  if (!order) return NextResponse.json({ ok: true });

  const paymentStatus =
    type === "charge:confirmed" ? "paid" :
    type === "charge:failed" || type === "charge:unresolved" ? "failed" :
    "pending";

  await updateOrderPayment(order.id, project.id, paymentStatus, chargeId);
  console.info(`[nubia/webhook/coinbase] Order ${order.order_number} → ${paymentStatus} (event: ${type}, charge: ${chargeId})`);

  return NextResponse.json({ ok: true });
}
