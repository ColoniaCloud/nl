import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AGENTS } from "@/lib/public-agents";

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20",    dot: "bg-rose-400" },
  orange:  { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/20",  dot: "bg-orange-400" },
  sky:     { bg: "bg-sky-500/10",     text: "text-sky-400",     border: "border-sky-500/20",     dot: "bg-sky-400" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20",  dot: "bg-violet-400" },
};

export function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = AGENTS.find((a) => a.slug === slug);
  if (!agent) notFound();

  const c = COLOR_MAP[agent.color] ?? COLOR_MAP.violet;

  return (
    <div className="py-12 md:py-16">
      {/* Back */}
      <Link
        href="/agentes"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-10"
      >
        <ArrowLeft className="size-4" /> Todos los agentes
      </Link>

      {/* Hero */}
      <div className="mb-14">
        <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium mb-5 border ${c.bg} ${c.text} ${c.border}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {agent.badge ?? "Agente IA"}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
          {agent.name}
        </h1>
        <p className={`text-base font-medium mb-4 ${c.text}`}>{agent.tagline}</p>
        <p className="text-lg text-zinc-400 leading-relaxed max-w-2xl mb-8">
          {agent.description}
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
        >
          Empezar gratis <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Sub-agents */}
      {agent.subAgents && agent.subAgents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-5">
            Sub-agentes incluidos
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agent.subAgents.map((sub) => (
              <div
                key={sub.slug}
                className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5"
              >
                {sub.badge && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.bg} ${c.text} mb-3 inline-block`}>
                    {sub.badge}
                  </span>
                )}
                <h3 className="text-sm font-semibold text-white mb-2">{sub.name}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{sub.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA strip */}
      <div className={`mt-16 rounded-2xl border ${c.border} ${c.bg} px-8 py-8 text-center`}>
        <h2 className="text-xl font-semibold text-white mb-2">
          Empieza a usar {agent.name} hoy
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Accede a todos los agentes con una sola cuenta NL360.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            Crear cuenta gratis <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/precio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Ver precios
          </Link>
        </div>
      </div>
    </div>
  );
}
