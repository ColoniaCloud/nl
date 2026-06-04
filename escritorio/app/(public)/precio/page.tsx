import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLANS } from "@/lib/billing-plans";
import type { PlanId } from "@/lib/billing-plans";
import { PricingCTA } from "@/components/billing/PricingCTA";

const PAID_PLANS: PlanId[] = ["basic", "pro", "elite"];
const POPULAR: PlanId = "pro";

export default function PrecioPage() {
  const plans = PAID_PLANS.map((id) => PLANS[id]);

  return (
    <div className="py-12 md:py-16">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          Planes y precios
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto">
          Sin sorpresas. Cancela cuando quieras.
        </p>
      </div>

      {/* Interactive: toggle + cards + checkout buttons */}
      <PricingCTA plans={plans} popularPlanId={POPULAR} />

      {/* Free plan note */}
      <p className="text-center text-sm text-zinc-500 mb-16">
        También tenés un plan gratuito disponible.{" "}
        <Link
          href="/registro"
          className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
        >
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
