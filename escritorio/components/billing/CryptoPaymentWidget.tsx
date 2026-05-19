"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import type { PlanConfig, BillingCycle } from "@/lib/billing-plans";

interface CryptoPaymentWidgetProps {
  plan: PlanConfig;
  cycle: BillingCycle;
}

export default function CryptoPaymentWidget({
  plan,
  cycle,
}: CryptoPaymentWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/coinbase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, billingCycle: cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data?.error || "No se pudo generar el pago. Intenta de nuevo.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const price = cycle === "annual" ? plan.annualUsd : plan.monthlyUsd;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4 text-sm space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Pago con cripto
        </p>
        <div className="flex justify-between">
          <span className="text-zinc-500">Plan</span>
          <span className="text-zinc-200">{plan.name} ({cycle === "annual" ? "Anual" : "Mensual"})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Monto</span>
          <span className="text-white font-semibold">${price} USD</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Coins aceptadas</span>
          <span className="text-zinc-300">BTC, ETH, USDT, USDC, DAI y mas</span>
        </div>
        <p className="text-xs text-zinc-500 pt-1">
          Seras redirigido a la pagina de pago de Coinbase Commerce.
          Tu plan se activa automaticamente al confirmar el pago.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={startCheckout}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {loading ? "Generando pago..." : "Pagar con Coinbase"}
      </button>
    </div>
  );
}
