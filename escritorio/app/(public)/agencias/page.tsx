import Link from "next/link";
import { ArrowRight, Repeat, Globe, BarChart3, Palette } from "lucide-react";

const BENEFITS = [
  {
    icon: Globe,
    title: "Genera sitios para tus clientes",
    description:
      "Usa Manu Dev para crear sitios web completos en minutos, listos para entregar a tus clientes.",
  },
  {
    icon: Palette,
    title: "Marca blanca disponible",
    description:
      "Personaliza la plataforma con los colores y logo de tu agencia. Tus clientes ven tu marca.",
  },
  {
    icon: Repeat,
    title: "Automatiza el proceso completo",
    description:
      "Desde el brief hasta el sitio publicado, cada paso puede automatizarse con los agentes NL360.",
  },
  {
    icon: BarChart3,
    title: "Dashboard de clientes",
    description:
      "Gestiona todos tus proyectos y clientes desde un panel centralizado con metricas en tiempo real.",
  },
];

export default function AgenciasPage() {
  return (
    <div className="py-12 md:py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3.5 py-1.5 text-xs text-zinc-400 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Para agencias digitales
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          NL360 para Agencias
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-8">
          Multiplica la capacidad de tu agencia con IA. Entrega mas proyectos, en menos
          tiempo, con mayor calidad.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            Empezar gratis <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Ver opciones Enterprise
          </Link>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid sm:grid-cols-2 gap-5 mb-16">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 mb-4">
              <Icon className="size-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-zinc-400">{description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-8 py-10 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">
          Haz crecer tu agencia con IA
        </h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
          Habla con nuestro equipo para conocer el programa de agencias y los beneficios
          especiales disponibles.
        </p>
        <Link
          href="mailto:agencias@nl360.site"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
        >
          Contactar <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
