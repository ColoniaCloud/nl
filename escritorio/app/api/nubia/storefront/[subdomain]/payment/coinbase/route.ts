import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, getPaymentConfig, getOrderByNumber } from "@/lib/nubia/db-nubia";
import { createCoinbaseCharge } from "@/lib/nubia/nubia-payments";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const { subdomain } = params;
  const project = await getProjectBySubdomain(subdomain);
  if (!project) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const payConfig = await getPaymentConfig(project.id);
  if (!payConfig?.coinbase_enabled || !payConfig.coinbase_api_key) {
    return NextResponse.json({ error: "Coinbase not configured" }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const order = await getOrderByNumber(body.order_number, project.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const storeUrl = `https://${subdomain}.nl360.site`;

  try {
    const charge = await createCoinbaseCharge(
      payConfig.coinbase_api_key,
      `${project.name} — Pedido ${order.order_number}`,
      `Pago del pedido ${order.order_number} en ${project.name}`,
      Number(order.total),
      "USD",
      order.order_number,
      subdomain,
      storeUrl
    );
    return NextResponse.json({ hosted_url: charge.hosted_url, charge_id: charge.id });
  } catch (e: any) {
    console.error("[nubia/payment/coinbase]", e);
    return NextResponse.json({ error: e.message || "Coinbase error" }, { status: 500 });
  }
}
