import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * MercadoPago webhook handler — NOT YET IMPLEMENTED.
 *
 * To activate MercadoPago:
 * 1. Set env vars: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET
 * 2. Create src/lib/gateways/mercadopago.ts implementing the PaymentGateway interface
 * 3. Create /api/billing/checkout/mercadopago/route.ts
 * 4. Replace this handler with real IPN processing
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export async function POST() {
  return NextResponse.json(
    { error: "not_implemented", message: "MercadoPago integration coming soon." },
    { status: 501 }
  );
}
