"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Bitcoin, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, planIdFromSlug } from "@/lib/billing-plans";
import type { PlanConfig, BillingCycle, PlanId } from "@/lib/billing-plans";
import PlanCard from "@/components/billing/PlanCard";
import BankTransferForm from "@/components/billing/BankTransferForm";
import CryptoPaymentWidget from "@/components/billing/CryptoPaymentWidget";
import InvoiceTable from "@/components/billing/InvoiceTable";

type MeData = {
  user?: { username?: string; email?: string };
  plan?: { slug?: string };
};

type Subscription = {
  id: string;
  plan_slug: string;
  billing_cycle: "monthly" | "annual";
  gateway: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
};

type Invoice = {
  id: string;
  gateway: "coinbase" | "bank" | "manual";
  amount_usd: number;
  currency: string;
  status: "open" | "paid" | "void";
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

type PaymentMethod = "coinbase" | "bank";

function SuscripcionInner() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") as PlanId | null;

  const [me, setMe] = useState<MeData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("coinbase");
  const [bankSuccess, setBankSuccess] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/billing/subscription", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/billing/invoices?limit=10", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([meData, subData, invData]) => {
      setMe(meData);
      const sub = subData?.subscription || null;
      setSubscription(sub);
      setInvoices(invData?.invoices || []);

      // Auto-select plan from URL param (post-registration flow)
      if (planParam && PLANS[planParam] && planParam !== "free" && sub?.status !== "active") {
        setSelectedPlan(PLANS[planParam]);
      }
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const username = me?.user?.username || "";
  const currentPlanSlug = me?.plan?.slug || "nl360_free";
  const currentPlanId = planIdFromSlug(currentPlanSlug);

  async function handleCancel() {
    if (!confirm("Confirmar cancelacion. Tu plan se mantiene hasta el final del periodo actual.")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      if (res.ok) setCancelDone(true);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If user selected a plan and is in checkout mode
  if (selectedPlan && !bankSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <button
          onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
        >
          <RotateCcw className="size-3.5" />
          Volver
        </button>

        <h1 className="text-xl font-bold text-white mb-1">
          Activar {selectedPlan.name}
        </h1>
        <p className="text-sm text-zinc-400 mb-6">
          {cycle === "annual"
            ? `$${selectedPlan.annualUsd} USD / ano`
            : `$${selectedPlan.monthlyUsd} USD / mes`}
        </p>

        {/* Payment method tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setPaymentMethod("coinbase")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              paymentMethod === "coinbase"
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
            )}
          >
            <Bitcoin className="size-4" />
            Cripto
          </button>
          <button
            onClick={() => setPaymentMethod("bank")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              paymentMethod === "bank"
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
            )}
          >
            <CreditCard className="size-4" />
            Transferencia
          </button>
        </div>

        {paymentMethod === "coinbase" && (
          <CryptoPaymentWidget plan={selectedPlan} cycle={cycle} />
        )}

        {paymentMethod === "bank" && (
          <BankTransferForm
            plan={selectedPlan}
            cycle={cycle}
            username={username}
            onSuccess={() => setBankSuccess(true)}
          />
        )}
      </div>
    );
  }

  // Bank success state
  if (bankSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 text-center">
        <div className="text-4xl mb-4">&#10003;</div>
        <h1 className="text-xl font-bold text-white mb-2">Comprobante enviado</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Tu comprobante fue recibido. Un administrador revisara tu pago y
          activara tu plan en 24-48 horas habiles.
        </p>
        <button
          onClick={() => { setSelectedPlan(null); setBankSuccess(false); }}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 transition-colors"
        >
          Volver a suscripcion
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-1">Suscripcion</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Gestiona tu plan y metodo de pago.
      </p>

      {/* Current status */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Plan actual</p>
          <p className="text-lg font-semibold text-white capitalize">
            {PLANS[currentPlanId]?.name || currentPlanSlug}
          </p>
          {subscription?.status === "active" && subscription.current_period_end && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Vence el{" "}
              {new Date(subscription.current_period_end).toLocaleDateString("es", {
                day: "numeric", month: "long", year: "numeric",
              })}
              {subscription.cancel_at_period_end === 1 && " · Cancelacion programada"}
            </p>
          )}
        </div>
        {subscription?.status === "active" && !subscription.cancel_at_period_end && !cancelDone && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors underline"
          >
            {cancelling ? "Cancelando..." : "Cancelar al vencer"}
          </button>
        )}
        {cancelDone && (
          <span className="text-xs text-amber-400">Cancelacion programada al final del periodo.</span>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-zinc-400">Ciclo:</span>
        <div className="flex gap-1 rounded-lg bg-zinc-900 border border-white/[0.08] p-1">
          <button
            onClick={() => setCycle("monthly")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              cycle === "monthly" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Mensual
          </button>
          <button
            onClick={() => setCycle("annual")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              cycle === "annual" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Anual
            <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-400 font-bold">
              -17%
            </span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {(["free", "basic", "pro", "elite"] as const).map((planId) => (
          <PlanCard
            key={planId}
            plan={PLANS[planId]}
            cycle={cycle}
            isCurrentPlan={currentPlanId === planId}
            onSelect={(plan) => setSelectedPlan(plan)}
          />
        ))}
      </div>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Historial de pagos</h2>
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4">
            <InvoiceTable invoices={invoices} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuscripcionPage() {
  return (
    <Suspense>
      <SuscripcionInner />
    </Suspense>
  );
}
