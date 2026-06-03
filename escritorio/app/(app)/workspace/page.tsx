"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Code2, Clock, Megaphone, Handshake, GraduationCap, ShoppingBag, Coins, Sparkles, ArrowRight } from "lucide-react";
import AgentCard from "@/components/AgentCard";
import { AGENT_META as AGENT_COLORS } from "@/lib/agent-colors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentItem {
  id: string;
  agent: "manu-dev" | "nubia" | "forge" | "margarita" | "jordan" | "mentoria";
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
}

const AGENT_ICONS: Record<string, { Icon: React.ElementType; label: string }> = {
  "manu-dev": { Icon: Code2, label: "Dev" },
  nubia:      { Icon: ShoppingBag, label: "Nubia" },
  forge:      { Icon: Coins, label: "Forge" },
  margarita:  { Icon: Megaphone, label: "Margarita" },
  jordan:     { Icon: Handshake, label: "Jordan" },
  mentoria:   { Icon: GraduationCap, label: "MentorIA" },
};

// ─── Recent chat card ─────────────────────────────────────────────────────────

function RecentChatCard({ item }: { item: RecentItem }) {
  const colors = AGENT_COLORS[item.agent] ?? AGENT_COLORS["manu-dev"];
  const icons = AGENT_ICONS[item.agent] ?? AGENT_ICONS["manu-dev"];
  return (
    <Link href={item.href} className="group block">
      <div className="rounded-xl border border-border bg-card/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-card hover:border-white/[0.15] hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-2.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 ${colors.bgClass} ${colors.textClass}`}>
            <icons.Icon className="size-3" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{icons.label}</span>
        </div>
        <p className="text-xs font-medium text-foreground truncate leading-snug mb-2">
          {item.title}
        </p>
        <span className="text-[11px] text-muted-foreground truncate">{item.subtitle}</span>
      </div>
    </Link>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Home() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await fetch("/api/recent", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setRecentItems(data.items ?? []);
      } catch {
        // silently fail — recent chats are non-critical
      } finally {
        setLoadingRecent(false);
      }
    }
    loadRecent();
  }, []);

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">

        {/* Hero */}
        <section className="mb-14 text-center nl-fade-in-down">
          <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white/[0.10] backdrop-blur-sm border border-white/[0.15] shadow-[var(--shadow-lg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
              alt="NL360"
              className="h-10 w-10 invert nl-slow-rotate"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            NextLevel BackOffice 360
          </h1>
          <p className="mt-3 text-base md:text-lg text-white/60 max-w-md mx-auto leading-relaxed">
            Suite de agentes de inteligencia artificial para hacer crecer tu negocio
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              4 agentes activos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              IA generativa
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Automatizaciones N8N
            </span>
          </div>
        </section>

        {/* Agents — 4 cards */}
        <section className="mb-12 nl-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 nl-stagger">
            <AgentCard
              title="Manu Dev"
              description="Agente desarrollador: crea y gestiona tu sitio web con IA desde cero."
              href="/services/manu-dev"
              icon="code"
              color="emerald"
            />
            <AgentCard
              title="Margarita"
              description="Marketing: contenido, ads, email y automatizacion de campanas."
              href="/services/margarita"
              icon="bullhorn"
              color="rose"
            />
            <AgentCard
              title="Jordan"
              description="Ventas: leads, filtros, closer y estrategia comercial."
              href="/services/grant"
              icon="handshake"
              color="orange"
            />
            <AgentCard
              title="MentorIA"
              description="Cursos NL360 y agente Teacher para onboarding y certificacion de equipos."
              href="/services/mentoria"
              icon="graduation"
              color="sky"
            />
          </div>
        </section>

        {/* Actividad reciente */}
        <section className="nl-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <Clock className="size-3.5 text-white/40" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Actividad reciente
            </span>
          </div>

          {loadingRecent ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/30 h-[88px] animate-pulse" />
              ))}
            </div>
          ) : recentItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recentItems.map((item) => (
                <RecentChatCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-zinc-900/40 px-6 py-10 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.10]">
                <Sparkles className="size-6 text-white/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80 mb-1">
                  Todavía no creaste nada
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Empezá con Manu Dev y tené tu sitio web listo en minutos.
                </p>
              </div>
              <Link
                href="/services/manu-dev"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.12] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.13] hover:text-white transition-colors"
              >
                Crear mi primer sitio <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
