"use client";

import { useEffect, useState } from "react";

type StatsData = {
  revenue: { total: number; paid: number; invoices: number };
  subscriptions: { active: number; byPlan: Record<string, number> };
  sites: { total: number; running: number };
  setters: { setter_id: number; setter_username: string; setter_email: string; client_count: number }[];
};

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/[0.10] bg-zinc-900/60 p-5 animate-pulse">
      <div className="h-4 w-24 bg-white/[0.08] rounded mb-3" />
      <div className="h-7 w-16 bg-white/[0.10] rounded mb-2" />
      <div className="h-3 w-32 bg-white/[0.06] rounded" />
    </div>
  );
}

export default function MetricasTab() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Error al cargar métricas");
        setStats(d);
      })
      .catch((e: Error) => setErrorStats(e.message))
      .finally(() => setLoadingStats(false));
  }, []);

  if (loadingStats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (errorStats) {
    return (
      <div className="p-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
        {errorStats}
      </div>
    );
  }

  if (!stats) return null;

  const totalClients = stats.setters.reduce((s, r) => s + Number(r.client_count), 0);

  const cards = [
    {
      emoji: "💰",
      title: "Ingresos",
      value: `$${stats.revenue.paid.toLocaleString("es-AR")}`,
      sub: `pagados · ${stats.revenue.invoices} factura${stats.revenue.invoices !== 1 ? "s" : ""}`,
    },
    {
      emoji: "📋",
      title: "Suscripciones",
      value: String(stats.subscriptions.active),
      sub: "activas",
      extra: Object.entries(stats.subscriptions.byPlan).map(([plan, count]) => (
        <span key={plan} className="inline-flex items-center gap-1 text-xxs bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5">
          {plan.replace("nl360_", "")}: {count}
        </span>
      )),
    },
    {
      emoji: "🌐",
      title: "Sitios",
      value: String(stats.sites.total),
      sub: `generados · ${stats.sites.running} corriendo`,
    },
    {
      emoji: "👥",
      title: "Setters",
      value: String(stats.setters.length),
      sub: `activos · ${totalClients} cliente${totalClients !== 1 ? "s" : ""} totales`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-white/[0.10] bg-zinc-900/40 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">{card.emoji}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {card.title}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">{card.value}</div>
          <div className="text-xs text-zinc-500">{card.sub}</div>
          {card.extra && card.extra.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">{card.extra}</div>
          )}
        </div>
      ))}
    </div>
  );
}
