import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, getPaymentConfig, getOrderByNumber, getOrderItems } from "@/lib/nubia/db-nubia";
import { createMpPreference } from "@/lib/nubia/nubia-payments";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const { subdomain } = params;
  const project = await getProjectBySubdomain(subdomain);
  if (!project) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const payConfig = await getPaymentConfig(project.id);
  if (!payConfig?.mercadopago_enabled || !payConfig.mercadopago_access_token) {
    return NextResponse.json({ error: "MercadoPago not configured" }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { order_number } = body;
  const order = await getOrderByNumber(order_number, project.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const currency = payConfig.mercadopago_currency || "ARS";
  const storeUrl = `https://${subdomain}.nl360.site`;

  try {
    const orderItems = await getOrderItems(order.id);
    const items = orderItems.length > 0
      ? orderItems.map((item) => ({
          title: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.product_price),
          currency_id: currency,
        }))
      : [
          {
            title: `Pedido ${order.order_number} — ${project.name}`,
            quantity: 1,
            unit_price: Number(order.total),
            currency_id: currency,
          },
        ];
    const preference = await createMpPreference(
      payConfig.mercadopago_access_token,
      items,
      order.order_number,
      storeUrl,
      subdomain
    );
    return NextResponse.json({ init_point: preference.init_point, preference_id: preference.id });
  } catch (e: any) {
    console.error("[nubia/payment/mp]", e);
    return NextResponse.json({ error: e.message || "MercadoPago error" }, { status: 500 });
  }
}
