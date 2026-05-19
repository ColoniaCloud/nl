"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SuscripcionExitoPage() {
  const [checking, setChecking] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    // Poll /api/billing/subscription up to 5 times to confirm activation
    let attempts = 0;
    const max = 5;

    async function check() {
      attempts++;
      try {
        const [subRes, meRes] = await Promise.all([
          fetch("/api/billing/subscription", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const subData = await subRes.json();
        const meData = await meRes.json();

        if (subData?.subscription?.status === "active") {
          const slug = meData?.plan?.slug || subData.subscription.plan_slug || "";
          const names: Record<string, string> = {
            nl360_basic: "Basic",
            nl360_pro: "Pro",
            nl360_elite: "Elite",
          };
          setPlanName(names[slug] || slug);
          setChecking(false);
          return;
        }
      } catch {
        // ignore, retry
      }

      if (attempts < max) {
        setTimeout(check, 2000);
      } else {
        setChecking(false);
      }
    }

    check();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {checking ? (
        <>
          <Loader2 className="size-8 text-violet-400 animate-spin mb-4" />
          <p className="text-sm text-zinc-400">Verificando tu pago...</p>
        </>
      ) : planName ? (
        <>
          <CheckCircle className="size-12 text-emerald-400 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            Plan {planName} activado
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Tu suscripcion esta activa. Ya puedes usar todas las funciones de tu plan.
          </p>
          <Link
            href="/workspace"
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Ir al workspace
          </Link>
        </>
      ) : (
        <>
          <CheckCircle className="size-12 text-zinc-400 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">
            Pago recibido
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Tu pago fue procesado. Si tu plan no se activa en unos minutos,
            contacta a soporte.
          </p>
          <Link
            href="/app/suscripcion"
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 transition-colors"
          >
            Ver suscripcion
          </Link>
        </>
      )}
    </div>
  );
}
