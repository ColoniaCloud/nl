"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, Loader2, CreditCard } from "lucide-react";
import type { PlanConfig, PlanId, BillingCycle } from "@/lib/billing-plans";

interface Props {
  plans: PlanConfig[];
  popularPlanId: PlanId;
}

export function PricingCTA({ plans, popularPlanId }: Props) {
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<PlanId | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [stripeTip, setStripeTip] = useState<PlanId | null>(null);

  async function handleCrypto(planId: PlanId) {
    setError(null);
    setErrorMsg("");
    setStripeTip(null);
    setLoading(planId);

    try {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (me.status === 401 || me.status === 403) {
        router.push(`/registro?plan=${planId}`);
        return;
      }

      const res = await fetch("/api/billing/checkout/coinbase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: cycle }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      setError(planId);
      setErrorMsg(
        data.error === "unauthorized"
          ? "Necesitas iniciar sesion para suscribirte."
          : data.detail || data.error || "Error al procesar el pago. Intenta de nuevo."
      );
    } catch {
      setError(planId);
      setErrorMsg("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  const annualSaving = (p: PlanConfig) =>
    Math.round(100 - (p.annualUsd / (p.monthlyUsd * 12)) * 100);

  return (
    <>
      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center rounded-xl border border-white/[0.08] bg-zinc-900/60 p-1 gap-1">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cycle === "monthly"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setCycle("annual")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              cycle === "annual"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Anual
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              −{annualSaving(plans.find((p) => p.id === popularPlanId)!)}%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {plans.map((plan) => {
          const price = cycle === "monthly" ? plan.monthlyUsd : plan.annualUsd;
          const isPopular = plan.id === popularPlanId;
          const isLoading = loading === plan.id;
          const hasError = error === plan.id;
          const showStripeTip = stripeTip === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-7 flex flex-col ${
                isPopular
                  ? "border-2 border-violet-500/50 bg-violet-500/5"
                  : "border border-white/[0.08] bg-zinc-900/40"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-violet-500 text-white">
                    Mas popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  {plan.name}
                </h2>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">${price}</span>
                  <span className="text-sm text-zinc-500">
                    {cycle === "monthly" ? "/mes" : "/año"}
                  </span>
                </div>
                {cycle === "annual" && (
                  <p className="text-xs text-emerald-400">
                    Equivale a ${Math.round(price / 12)}/mes · ahorras ${plan.monthlyUsd * 12 - price}
                  </p>
                )}
                <p className="text-xs text-zinc-500 mt-1">{plan.tokens}</p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <Check className="size-3.5 text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Crypto button */}
              <button
                onClick={() => handleCrypto(plan.id)}
                disabled={isLoading || loading !== null}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-2 ${
                  isPopular
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "border border-white/[0.12] text-zinc-300 hover:border-white/[0.20] hover:text-white"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Pagar con crypto <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {/* Stripe placeholder */}
              <button
                onClick={() => setStripeTip(showStripeTip ? null : plan.id)}
                disabled={loading !== null}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-white/[0.06] text-zinc-500 hover:text-zinc-400 hover:border-white/[0.10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard className="size-4" />
                Pagar con tarjeta
              </button>

              {showStripeTip && (
                <p className="mt-2 text-xs text-zinc-500 text-center">
                  Pagos con tarjeta disponibles pronto.
                </p>
              )}

              {hasError && (
                <p className="mt-2 text-xs text-red-400 text-center">{errorMsg}</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
