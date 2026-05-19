import Link from "next/link";
import { ArrowRight, Shield, Users, Zap, HeadphonesIcon } from "lucide-react";

const BENEFITS = [
  {
    icon: Shield,
    title: "Seguridad avanzada",
    description: "SSO, SAML, audit logs y permisos granulares por equipo.",
  },
  {
    icon: Users,
    title: "Multi-usuario",
    description: "Gestiona equipos completos con roles y permisos diferenciados.",
  },
  {
    icon: Zap,
    title: "API access",
    description: "Integra NL360 con tu stack existente via API REST documentada.",
  },
  {
    icon: HeadphonesIcon,
    title: "Soporte dedicado",
    description: "Canal directo con el equipo, onboarding personalizado y SLA.",
  },
];

export default function EnterprisePage() {
  return (
    <div className="py-12 md:py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3.5 py-1.5 text-xs text-zinc-400 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Para empresas
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          NL360 Enterprise
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-8">
          Potencia tu empresa con IA generativa a escala. Facturacion, seguridad y soporte
          adaptados a tus necesidades.
        </p>
        <Link
          href="mailto:hola@nl360.site"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
        >
          Hablar con ventas <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Benefits */}
      <div className="grid sm:grid-cols-2 gap-5 mb-16">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 mb-4">
              <Icon className="size-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-zinc-400">{description}</p>
          </div>
        ))}
      </div>

      {/* Contact CTA */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-8 py-10 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">
          Listo para empezar
        </h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
          Agenda una demo con nuestro equipo y te mostramos como NL360 puede transformar
          la operacion de tu empresa.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="mailto:hola@nl360.site"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            Solicitar demo <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/precio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Comparar planes
          </Link>
        </div>
      </div>
    </div>
  );
}
