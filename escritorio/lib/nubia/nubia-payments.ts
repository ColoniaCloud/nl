/**
 * Nubia Payment Helpers
 * - MercadoPago: Checkout Pro (multi-country LATAM)
 * - Coinbase Commerce: charge creation
 */

export const NL360_BASE_URL = process.env.NL360_BASE_URL || "https://nl360.site";

// ─── MercadoPago ─────────────────────────────────────────────────────────────

export const MP_COUNTRY_CURRENCY: Record<string, string> = {
  AR: "ARS",
  MX: "MXN",
  CO: "COP",
  CL: "CLP",
  BR: "BRL",
  UY: "UYU",
  PE: "PEN",
};

export interface MpItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

export interface MpPreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

/**
 * Create a MercadoPago Checkout Pro preference.
 * Returns the preference ID and redirect URLs.
 */
export async function createMpPreference(
  accessToken: string,
  items: MpItem[],
  orderNumber: string,
  callbackBaseUrl: string,
  subdomain: string
): Promise<MpPreferenceResult> {
  const body = {
    items,
    external_reference: orderNumber,
    back_urls: {
      success: `${callbackBaseUrl}/confirmacion?order=${orderNumber}&status=success`,
      failure: `${callbackBaseUrl}/checkout?order=${orderNumber}&status=failed`,
      pending: `${callbackBaseUrl}/confirmacion?order=${orderNumber}&status=pending`,
    },
    auto_return: "approved",
    notification_url: `${NL360_BASE_URL}/api/nubia/storefront/${subdomain}/payment/webhook/mp`,
    statement_descriptor: "NL360 STORE",
    metadata: { order_number: orderNumber, subdomain },
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MercadoPago error: ${err}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  };
}

/**
 * Verify an IPN/webhook notification from MercadoPago.
 * Returns the payment details if valid.
 */
export async function getMpPaymentInfo(
  accessToken: string,
  paymentId: string
): Promise<{ status: string; external_reference: string; status_detail: string } | null> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    status: data.status,
    external_reference: data.external_reference,
    status_detail: data.status_detail,
  };
}

// ─── Coinbase Commerce ───────────────────────────────────────────────────────

export interface CoinbaseChargeResult {
  id: string;
  code: string;
  hosted_url: string;
}

/**
 * Create a Coinbase Commerce charge.
 */
export async function createCoinbaseCharge(
  apiKey: string,
  name: string,
  description: string,
  amount: number,
  currency: string,
  orderNumber: string,
  subdomain: string,
  callbackBaseUrl: string
): Promise<CoinbaseChargeResult> {
  const body = {
    name,
    description,
    pricing_type: "fixed_price",
    local_price: { amount: amount.toFixed(2), currency },
    metadata: { order_number: orderNumber, subdomain },
    redirect_url: `${callbackBaseUrl}/confirmacion?order=${orderNumber}&status=crypto`,
    cancel_url: `${callbackBaseUrl}/checkout?order=${orderNumber}&status=cancelled`,
  };

  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": "2018-03-22",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coinbase Commerce error: ${err}`);
  }

  const data = await res.json();
  return {
    id: data.data.id,
    code: data.data.code,
    hosted_url: data.data.hosted_url,
  };
}

/**
 * Verify MercadoPago webhook signature.
 * MP sends: x-signature: ts=<timestamp>,v1=<hmac>
 * Signed manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>
 */
export async function verifyMpWebhook(
  dataId: string,
  requestId: string,
  xSignature: string,
  webhookSecret: string
): Promise<boolean> {
  const tsMatch = xSignature.match(/ts=([^,]+)/);
  const v1Match = xSignature.match(/v1=([^,]+)/);
  if (!tsMatch || !v1Match) return false;
  const ts = tsMatch[1];
  const receivedHmac = v1Match[1];
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === receivedHmac;
}

/**
 * Verify Coinbase Commerce webhook signature.
 */
export async function verifyCoinbaseWebhook(
  rawBody: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === signature;
}
