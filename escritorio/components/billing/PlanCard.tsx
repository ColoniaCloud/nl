"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanConfig, BillingCycle } from "@/lib/billing-plans";

interface PlanCardProps {
  plan: PlanConfig;
  cycle: BillingCycle;
  isCurrentPlan: boolean;
  onSelect: (plan: PlanConfig, cycle: BillingCycle) => void;
  disabled?: boolean;
}

export default function PlanCard({
  plan,
  cycle,
  isCurrentPlan,
  onSelect,
  disabled,
}: PlanCardProps) {
  const price = cycle === "annual" ? plan.annualUsd : plan.monthlyUsd;
  const monthly = cycle === "annual" ? Math.round(plan.annualUsd / 12) : plan.monthlyUsd;
  const isFree = plan.id === "free";
  const isPro = plan.id === "pro";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-5 transition-colors",
        isCurrentPlan
          ? "border-violet-500/50 bg-violet-500/5"
          : isPro
          ? "border-violet-500/30 bg-zinc-900/60"
          : "border-white/[0.08] bg-zinc-900/40 hover:border-white/[0.15]"
      )}
    >
      {isPro && !isCurrentPlan && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-2xs font-bold uppercase tracking-wider text-white">
          Popular
        </span>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{plan.name}</span>
          {isCurrentPlan && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-2xs text-violet-300 font-medium">
              Plan actual
            </span>
          )}
        </div>

        {isFree ? (
          <p className="mt-1 text-2xl font-bold text-white">Gratis</p>
        ) : (
          <div className="mt-1">
            <span className="text-2xl font-bold text-white">
              ${cycle === "annual" ? monthly : price}
            </span>
            <span className="text-sm text-zinc-400 ml-1">/mes</span>
            {cycle === "annual" && (
              <p className="text-xs text-emerald-400 mt-0.5">
                ${price} por ano · 2 meses gratis
              </p>
            )}
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2 mb-4">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
            <Check className="size-3.5 mt-0.5 flex-shrink-0 text-violet-400" />
            {f}
          </li>
        ))}
      </ul>

      {!isFree && (
        <button
          onClick={() => onSelect(plan, cycle)}
          disabled={disabled || isCurrentPlan}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            isCurrentPlan
              ? "bg-zinc-800 text-zinc-500 cursor-default"
              : isPro
              ? "bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              : "bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50"
          )}
        >
          {isCurrentPlan ? "Plan activo" : `Activar ${plan.name}`}
        </button>
      )}
    </div>
  );
}
