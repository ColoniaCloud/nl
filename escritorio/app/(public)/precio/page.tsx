import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mes",
    description: "Para emprendedores que quieren comenzar con IA.",
    color: "zinc",
    features: [
      "2 agentes activos",
      "1 sitio web generado",
      "100 mensajes/mes",
      "Soporte por email",
    ],
    cta: "Comenzar gratis",
    href: "/registro",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mes",
    description: "Para negocios que quieren automatizar todo.",
    color: "violet",
    features: [
      "Todos los agentes (4)",
      "Sitios ilimitados",
      "Mensajes ilimitados",
      "Marketing en redes sociales",
      "CRM y gestion de ventas",
      "Soporte prioritario",
    ],
    cta: "Empezar con Pro",
    href: "/registro?plan=pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para agencias y empresas con necesidades avanzadas.",
    color: "zinc",
    features: [
      "Todo lo de Pro",
      "Multi-usuario y equipos",
      "API access",
      "Onboarding dedicado",
      "SLA garantizado",
      "Facturacion personalizada",
    ],
    cta: "Hablar con ventas",
    href: "/enterprise",
    highlight: false,
  },
];

export default function PrecioPage() {
  return (
    <div className="py-12 md:py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          Planes y precios
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto">
          Sin sorpresas. Todos los planes incluyen acceso completo a la plataforma.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl p-7 flex flex-col ${
              plan.highlight
                ? "border-2 border-violet-500/50 bg-violet-500/5"
                : "border border-white/[0.08] bg-zinc-900/40"
            }`}
          >
            {plan.highlight && (
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
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-zinc-500">{plan.period}</span>
              </div>
              <p className="text-sm text-zinc-400">{plan.description}</p>
            </div>

            <ul className="flex flex-col gap-2.5 mb-7 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Check className="size-3.5 text-emerald-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                plan.highlight
                  ? "bg-violet-600 text-white hover:bg-violet-500"
                  : "border border-white/[0.12] text-zinc-300 hover:border-white/[0.20] hover:text-white"
              }`}
            >
              {plan.cta} <ArrowRight className="size-4" />
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ placeholder */}
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
