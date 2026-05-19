import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AGENTS } from "@/lib/public-agents";

const COLOR_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-400",    dot: "bg-rose-400" },
  orange:  { bg: "bg-orange-500/10",  text: "text-orange-400",  dot: "bg-orange-400" },
  sky:     { bg: "bg-sky-500/10",     text: "text-sky-400",     dot: "bg-sky-400" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  dot: "bg-violet-400" },
};

export default function AgentesPage() {
  return (
    <div className="py-12 md:py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3.5 py-1.5 text-xs text-zinc-400 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Suite completa de agentes IA
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          Agentes
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto">
          Cada agente esta especializado en un area de tu negocio y trabaja contigo a traves de chat.
        </p>
      </div>

      {/* Agent grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {AGENTS.map((agent) => {
          const c = COLOR_MAP[agent.color] ?? COLOR_MAP.violet;
          return (
            <Link
              key={agent.slug}
              href={`/agentes/${agent.slug}`}
              className="group block rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 hover:bg-zinc-900/70 hover:border-white/[0.14] transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <div className={`rounded-xl ${c.bg} p-2.5`}>
                  <span className={`block h-5 w-5 ${c.dot} rounded-full`} />
                </div>
                {agent.badge && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                    {agent.badge}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-semibold text-white mb-1">{agent.name}</h2>
              <p className={`text-xs font-medium mb-3 ${c.text}`}>{agent.tagline}</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">{agent.description}</p>

              {/* Sub-agents preview */}
              {agent.subAgents && agent.subAgents.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {agent.subAgents.map((sub) => (
                    <span
                      key={sub.slug}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400"
                    >
                      {sub.name}
                    </span>
                  ))}
                </div>
              )}

              <div className={`flex items-center gap-1 text-xs font-medium ${c.text}`}>
                Ver agente <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
