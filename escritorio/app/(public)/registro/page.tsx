"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";

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
      "Agente Vilma (marketing)",
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
      "Todos los agentes (Manu, Vilma, Jordan)",
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectPlan(p: Plan) {
    setPlan(p);
    setStep("account");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPwd) {
      setError("Las contrasenas no coinciden.");
      return;
    }
    if (!acceptTerms) {
      setError("Debes aceptar los terminos de servicio.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, plan, referralCode: refParam || undefined }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Error al crear la cuenta.");
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
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Iniciar sesion
                </Link>
              </>
            ) : (
              <>
                Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
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

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={60}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mi_usuario"
                  className="w-full h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Contrasena
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  className="w-full h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Confirmar contrasena
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Repite tu contrasena"
                  className="w-full h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
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
                  <Link href="/terminos" className="text-violet-400 hover:text-violet-300 underline">
                    Terminos de servicio
                  </Link>{" "}
                  y la{" "}
                  <Link href="/privacidad" className="text-violet-400 hover:text-violet-300 underline">
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
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
                {!loading && <ArrowRight className="size-4" />}
              </button>
            </form>
          </div>
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
