import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, getPaymentConfig, getOrderByNumber, updateOrderPayment } from "@/lib/nubia/db-nubia";
import { getMpPaymentInfo, verifyMpWebhook } from "@/lib/nubia/nubia-payments";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const { subdomain } = params;

  const rawBody = await req.text();
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  // MercadoPago sends type=payment with data.id
  if (body.type !== "payment" || !body.data?.id) {
    return NextResponse.json({ ok: true });
  }

  const project = await getProjectBySubdomain(subdomain);
  if (!project) return NextResponse.json({ ok: true });

  const payConfig = await getPaymentConfig(project.id);
  if (!payConfig?.mercadopago_access_token) return NextResponse.json({ ok: true });

  // Verify MP webhook signature when a secret is configured
  if (payConfig.mercadopago_webhook_secret) {
    const xSignature = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";
    const valid = await verifyMpWebhook(
      String(body.data.id),
      xRequestId,
      xSignature,
      payConfig.mercadopago_webhook_secret
    );
    if (!valid) {
      console.warn(`[nubia/webhook/mp] Invalid signature for subdomain: ${subdomain}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    const info = await getMpPaymentInfo(payConfig.mercadopago_access_token, String(body.data.id));
    if (!info?.external_reference) {
      console.warn("[nubia/webhook/mp] No external_reference in payment", body.data.id);
      return NextResponse.json({ ok: true });
    }

    const order = await getOrderByNumber(info.external_reference, project.id);
    if (!order) {
      console.warn("[nubia/webhook/mp] Order not found:", info.external_reference);
      return NextResponse.json({ ok: true });
    }

    const paymentStatus = info.status === "approved" ? "paid" : info.status === "rejected" ? "failed" : "pending";
    await updateOrderPayment(order.id, project.id, paymentStatus, String(body.data.id));
    console.info(`[nubia/webhook/mp] Order ${order.order_number} → ${paymentStatus} (mp_id: ${body.data.id})`);
  } catch (e) {
    console.error("[nubia/webhook/mp] Error processing payment:", e);
  }

  return NextResponse.json({ ok: true });
}
