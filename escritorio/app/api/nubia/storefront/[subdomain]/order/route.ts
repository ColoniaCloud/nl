import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, createOrder } from "@/lib/nubia/db-nubia";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const project = await getProjectBySubdomain(params.subdomain);
  if (!project || project.status !== "active") {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { items, subtotal, total, payment_method, customer_name, customer_email, customer_phone, shipping_address, notes } = body;

  if (!items?.length) {
    return NextResponse.json({ error: "El carrito esta vacio" }, { status: 400 });
  }
  if (!payment_method) {
    return NextResponse.json({ error: "Metodo de pago requerido" }, { status: 400 });
  }
  if (!customer_name?.trim()) {
    return NextResponse.json({ error: "Nombre del cliente requerido" }, { status: 400 });
  }
  if (!customer_email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    return NextResponse.json({ error: "Email valido requerido" }, { status: 400 });
  }
  const allowedMethods = ["bank_transfer", "mercadopago", "coinbase"];
  if (!allowedMethods.includes(payment_method)) {
    return NextResponse.json({ error: "Metodo de pago invalido" }, { status: 400 });
  }

  try {
    const { orderId, orderNumber } = await createOrder(
      project.id,
      { customer_name, customer_email, customer_phone, shipping_address, subtotal, total, payment_method, notes },
      items
    );
    return NextResponse.json({ order_id: orderId, order_number: orderNumber });
  } catch (e: any) {
    console.error("[nubia/storefront/order]", e);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
