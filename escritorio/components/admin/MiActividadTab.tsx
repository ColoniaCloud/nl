"use client";

type ClientRow = {
  id: number;
  client_id: number;
  username: string;
  email: string;
  plan_slug: string;
  notes: string | null;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  nl360_free:  "Free",
  nl360_basic: "Basic",
  nl360_pro:   "Pro",
  nl360_elite: "Elite",
};

function daysAgo(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

type Props = {
  clients: ClientRow[] | null;
};

export default function MiActividadTab({ clients }: Props) {
  if (!clients || clients.length === 0) {
    return (
      <div className="p-6 py-12 text-center text-zinc-500 text-sm">
        Sin actividad todavía
      </div>
    );
  }

  // Plan distribution
  const planCounts = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan_slug] = (acc[c.plan_slug] ?? 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(planCounts), 1);

  // Recent activity: last 5 by created_at desc
  const recent = [...clients]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-white/[0.10] bg-zinc-900/40 p-5 inline-flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Clientes creados
        </span>
        <span className="text-3xl font-bold text-foreground">{clients.length}</span>
      </div>

      {/* Plan distribution */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Distribución de planes
        </h3>
        <div className="space-y-2.5">
          {Object.entries(planCounts).map(([slug, count]) => {
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={slug} className="flex items-center gap-3">
                <span className="w-14 text-xs text-zinc-400 text-right flex-shrink-0">
                  {PLAN_LABEL[slug] ?? slug}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-xs text-zinc-500 flex-shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Actividad reciente
        </h3>
        <ul className="space-y-2">
          {recent.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="text-zinc-600">•</span>
              <span className="font-medium">{c.username}</span>
              <span className="text-zinc-500">—</span>
              <span className="text-zinc-400">
                Plan {PLAN_LABEL[c.plan_slug] ?? c.plan_slug}
              </span>
              <span className="text-zinc-500">—</span>
              <span className="text-zinc-500 text-xs">{daysAgo(c.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
