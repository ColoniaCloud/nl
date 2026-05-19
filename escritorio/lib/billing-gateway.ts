import type { PlanId, BillingCycle } from "./billing-plans";

/**
 * Common interface for all payment gateways.
 * Implementing this interface allows adding MercadoPago (or any other gateway)
 * without changing the billing API routes — just add a new implementation
 * and a new checkout route.
 */
export interface CheckoutParams {
  userId: number;
  planId: PlanId;
  billingCycle: BillingCycle;
  amountUsd: number;
  userEmail?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  ok: true;
  url: string;
  gatewaySessionId: string;
}

export interface WebhookResult {
  ok: boolean;
  userId?: number;
  planSlug?: string;
  billingCycle?: string;
  gatewayInvId?: string;
  amountUsd?: number;
  error?: string;
}

/**
 * Gateway identifiers. Add 'mercadopago' here when ready to implement.
 */
export type GatewayId = "coinbase" | "bank" | "mercadopago";
