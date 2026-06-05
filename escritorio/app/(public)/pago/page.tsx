"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, Loader2, CreditCard } from "lucide-react";
import { PLANS, type PlanId, type PlanConfig } from "@/lib/billing-plans";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function PagoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const planId = params.get("plan") as PlanId | null;

  const [plan, setPlan] = useState<PlanConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeAmount, setStripeAmount] = useState(0);
  const [loadingStripe, setLoadingStripe] = useState(false);

  useEffect(() => {
    if (!planId) {
      router.replace("/precio");
      return;
    }

    const found = PLANS[planId];
    if (!found) {
      router.replace("/precio");
      return;
    }

    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace(
            "/login?redirect=" + encodeURIComponent("/pago?plan=" + planId)
          );
        } else {
          setPlan(found);
        }
      })
      .catch(() => {
        router.replace("/precio");
      });
  }, [planId, router]);

  async function handleCrypto() {
    if (!plan) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout/coinbase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, billingCycle: "monthly" }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.detail || data.error || "Error al procesar el pago. Intenta de nuevo.");
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStripeCheckout() {
    if (!planId) return;
    setLoadingStripe(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: "monthly" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStripeClientSecret(data.clientSecret);
        setStripeAmount(data.amount);
      } else {
        setError(data.error || "Error al iniciar el pago");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoadingStripe(false);
    }
  }

  if (!plan) {
    return (
      <div className="py-12 md:py-20 flex flex-col items-center">
        <Loader2 className="size-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const visibleFeatures = plan.features.slice(0, 5);

  return (
    <div className="py-12 md:py-20 flex flex-col items-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
            alt="NL360"
            className="h-10 w-10 invert mx-auto mb-5"
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            Completar suscripcion
          </h1>
          <p className="text-sm text-zinc-400">
            Estas suscribiendote al plan {plan.name}
          </p>
        </div>

        {/* Plan card */}
        <div className="rounded-2xl border border-white/[0.10] bg-zinc-900/60 backdrop-blur-sm p-8 mb-4">
          {/* Plan name + price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-white">${plan.monthlyUsd}</span>
              <span className="text-sm text-zinc-500">/mes</span>
            </div>
            <p className="text-xs text-zinc-500">{plan.tokens}</p>
          </div>

          {/* Features */}
          <ul className="flex flex-col gap-2.5 mb-8">
            {visibleFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <Check className="size-3.5 text-emerald-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {stripeClientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: stripeClientSecret,
                appearance: {
                  theme: "night",
                  variables: { colorPrimary: "#8b5cf6" },
                },
              }}
            >
              <StripeCheckoutForm
                amount={stripeAmount}
                onCancel={() => setStripeClientSecret(null)}
              />
            </Elements>
          ) : (
            <>
              {/* Crypto button */}
              <button
                onClick={handleCrypto}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-2"
              >
                {loading ? (
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

              {/* Card button */}
              <button
                onClick={handleStripeCheckout}
                disabled={loadingStripe}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingStripe ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <CreditCard className="size-4" />
                    Pagar con tarjeta
                  </>
                )}
              </button>
            </>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              {error}
            </p>
          )}
        </div>

        {/* Free plan fallback */}
        <p className="text-center text-xs text-zinc-500">
          ¿No estas seguro?{" "}
          <Link href="/workspace" className="react-aria-Link">
            Continuar con plan gratuito
          </Link>
        </p>
      </div>
    </div>
  );
}

function StripeCheckoutForm({
  amount,
  onCancel,
}: {
  amount: number;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pago/exito`,
      },
    });

    if (error) {
      setError(error.message ?? "Error al procesar el pago");
      setLoading(false);
    }
    // Sin error: Stripe redirige automáticamente a /pago/exito
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium border border-white/[0.10] text-zinc-400 hover:text-white hover:border-white/[0.20] transition-colors"
        >
          ← Volver
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Procesando...
            </>
          ) : (
            `Pagar $${amount}`
          )}
        </button>
      </div>
    </form>
  );
}

export default function PagoPage() {
  return (
    <Suspense>
      <PagoInner />
    </Suspense>
  );
}
