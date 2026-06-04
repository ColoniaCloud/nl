"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "@/lib/schemas/auth";

type Plan = "free" | "basic" | "pro" | "elite";
type Step = "plan" | "account";

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  period: string;
  tokens: string;
  features: string[];
  highlight: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "Gratis",
    period: "",
    tokens: "25,000 tokens/mes",
    features: ["Acceso basico a la plataforma", "25,000 tokens al mes"],
    highlight: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "$49",
    period: "/mes",
    tokens: "100,000 tokens/mes",
    features: [
      "1 sitio web con Manu",
      "Acceso a MentorIA",
      "100,000 tokens al mes",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$149",
    period: "/mes",
    tokens: "250,000 tokens/mes",
    features: [
      "2 sitios web con Manu",
      "Agente Margarita (marketing)",
      "Acceso a MentorIA",
      "250,000 tokens al mes",
    ],
    highlight: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$299",
    period: "/mes",
    tokens: "1,000,000 tokens/mes",
    features: [
      "Sitios ilimitados",
      "Todos los agentes (Manu, Margarita, Jordan)",
      "Acceso a MentorIA",
      "1,000,000 tokens al mes",
    ],
    highlight: false,
  },
];

function RegistroInner() {
  const params = useSearchParams();
  const planParam = params.get("plan") as Plan | null;
  const refParam = params.get("ref") ?? "";

  const [step, setStep] = useState<Step>(planParam ? "account" : "plan");
  const [plan, setPlan] = useState<Plan>(planParam ?? "free");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  function selectPlan(p: Plan) {
    setPlan(p);
    setStep("account");
  }

  async function onSubmit(data: RegisterFormData) {
    setError("");

    if (!acceptTerms) {
      setError("Debes aceptar los terminos de servicio.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
          plan,
          referralCode: refParam || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Error al crear la cuenta.");
        return;
      }

      window.location.assign("/registro/confirmar-email");
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = PLANS.find((p) => p.id === plan);

  return (
    <div className="py-12 md:py-20 flex flex-col items-center">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
            alt="NL360"
            className="h-10 w-10 invert mx-auto mb-5"
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            {step === "plan" ? "Elige tu plan" : "Crear tu cuenta NL360"}
          </h1>
          <p className="text-sm text-zinc-400">
            {step === "plan" ? (
              <>
                Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="react-aria-Link text-xs"
                >
                  Iniciar sesion
                </Link>
              </>
            ) : (
              <>
                Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="react-aria-Link text-xs"
                >
                  Iniciar sesion
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Step: plan selector */}
        {step === "plan" && (
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlan(p.id)}
                className={`relative rounded-2xl p-5 flex flex-col text-left transition-colors ${
                  p.highlight
                    ? "border-2 border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/10"
                    : "border border-white/[0.08] bg-zinc-900/40 hover:border-white/[0.18] hover:bg-zinc-900/60"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500 text-white">
                    Popular
                  </span>
                )}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    {p.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{p.price}</span>
                    <span className="text-xs text-zinc-500">{p.period}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.tokens}</p>
                </div>
                <ul className="flex flex-col gap-1.5 flex-1 mb-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-zinc-300">
                      <Check className="size-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl bg-white/[0.06] text-zinc-300 text-xs font-semibold hover:bg-white/[0.10] transition-colors">
                  Seleccionar <ArrowRight className="size-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step: account form */}
        {step === "account" && (
          <>
            {planParam && planParam !== "free" && selectedPlan && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 mb-4">
                <p className="text-sm font-semibold text-violet-300">
                  Plan {selectedPlan.name} · {selectedPlan.price}{selectedPlan.period}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Completá tu registro para continuar con el pago
                </p>
              </div>
            )}
            <div className="rounded-2xl border border-white/[0.10] bg-zinc-900/60 backdrop-blur-sm p-8">
            {/* Selected plan badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Plan:</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    selectedPlan?.highlight
                      ? "bg-violet-500/20 text-violet-300"
                      : "bg-white/[0.06] text-zinc-300"
                  }`}
                >
                  {selectedPlan?.name}
                </span>
              </div>
              {!planParam && (
                <button
                  onClick={() => setStep("plan")}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ChevronLeft className="size-3" /> Cambiar plan
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label htmlFor="reg-username" className="react-aria-Label block text-xs mb-1.5">
                  Nombre de usuario
                </label>
                <input
                  id="reg-username"
                  type="text"
                  {...register("username")}
                  placeholder="mi_usuario"
                  className="react-aria-Input w-full h-10"
                />
                {errors.username && (
                  <p className="react-aria-FieldError">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-email" className="react-aria-Label block text-xs mb-1.5">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  {...register("email")}
                  placeholder="tu@email.com"
                  className="react-aria-Input w-full h-10"
                />
                {errors.email && (
                  <p className="react-aria-FieldError">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-password" className="react-aria-Label block text-xs mb-1.5">
                  Contrasena
                </label>
                <input
                  id="reg-password"
                  type="password"
                  {...register("password")}
                  placeholder="Minimo 8 caracteres"
                  className="react-aria-Input w-full h-10"
                />
                {errors.password && (
                  <p className="react-aria-FieldError">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="react-aria-Label block text-xs mb-1.5">
                  Confirmar contrasena
                </label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  {...register("confirmPassword")}
                  placeholder="Repite tu contrasena"
                  className="react-aria-Input w-full h-10"
                />
                {errors.confirmPassword && (
                  <p className="react-aria-FieldError">{errors.confirmPassword.message}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 accent-violet-500"
                />
                <span className="text-xs text-zinc-400">
                  Acepto los{" "}
                  <Link href="/terminos" className="react-aria-Link underline">
                    Terminos de servicio
                  </Link>{" "}
                  y la{" "}
                  <Link href="/privacidad" className="react-aria-Link underline">
                    Politica de privacidad
                  </Link>
                </span>
              </label>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="react-aria-Button btn-primary w-full h-10 text-sm font-semibold"
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
                {!loading && <ArrowRight className="size-4" />}
              </button>
            </form>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroInner />
    </Suspense>
  );
}
