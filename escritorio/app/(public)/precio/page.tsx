"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { PLANS } from "@/lib/billing-plans";
import type { PlanId, BillingCycle } from "@/lib/billing-plans";

const PAID_PLANS: PlanId[] = ["basic", "pro", "elite"];
const POPULAR: PlanId = "pro";

export default function PrecioPage() {
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<PlanId | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handlePago(planId: PlanId) {
    setError(null);
    setErrorMsg("");
    setLoading(planId);

    try {
      // Verify auth first
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (me.status === 401 || me.status === 403) {
        router.push("/login?redirect=/precio");
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
      setErrorMsg(data.error === "unauthorized"
        ? "Necesitas iniciar sesion para suscribirte."
        : data.detail || data.error || "Error al procesar el pago. Intenta de nuevo.");
    } catch {
      setError(planId);
      setErrorMsg("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  const annualSaving = (planId: PlanId) => {
    const p = PLANS[planId];
    return Math.round(100 - (p.annualUsd / (p.monthlyUsd * 12)) * 100);
  };

  return (
    <div className="py-12 md:py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          Planes y precios
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-8">
          Sin sorpresas. Cancela cuando quieras.
        </p>

        {/* Billing cycle toggle */}
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
              −{annualSaving("pro")}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {PAID_PLANS.map((planId) => {
          const plan = PLANS[planId];
          const price = cycle === "monthly" ? plan.monthlyUsd : plan.annualUsd;
          const isPopular = planId === POPULAR;
          const isLoading = loading === planId;
          const hasError = error === planId;

          return (
            <div
              key={planId}
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

              <button
                onClick={() => handlePago(planId)}
                disabled={isLoading || loading !== null}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
                    Suscribirme con crypto <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {hasError && (
                <p className="mt-2.5 text-xs text-red-400 text-center">{errorMsg}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Free plan note */}
      <p className="text-center text-sm text-zinc-500 mb-16">
        También tenés un plan gratuito disponible.{" "}
        <Link href="/registro" className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">
          Registrate sin tarjeta
        </Link>
        .
      </p>

      {/* FAQ / contact */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-10 text-center">
        <h2 className="text-lg font-semibold text-white mb-2">
          ¿Tienes preguntas sobre los planes?
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Nuestro equipo te ayuda a elegir el plan correcto para tu negocio.
        </p>
        <Link
          href="/enterprise"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
        >
          Contactar ventas <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
