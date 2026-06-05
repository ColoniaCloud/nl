"use client";

import { useEffect, useState } from "react";

type ClientRow = {
  id: number;
  client_id: number;
  username: string;
  email: string;
  plan_slug: string;
  notes: string | null;
  created_at: string;
};

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  nl360_free:    { bg: "bg-zinc-500/20",   text: "text-zinc-400",   label: "Free" },
  nl360_basic:   { bg: "bg-blue-500/20",   text: "text-blue-300",   label: "Basic" },
  nl360_pro:     { bg: "bg-violet-500/20", text: "text-violet-300", label: "Pro" },
  nl360_elite:   { bg: "bg-yellow-500/20", text: "text-yellow-300", label: "Elite" },
};

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { bg: "bg-zinc-500/20", text: "text-zinc-400", label: plan };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

type Props = {
  onClientsLoaded?: (clients: ClientRow[]) => void;
};

export default function MisClientesTab({ onClientsLoaded }: Props) {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Error al cargar clientes");
        const rows: ClientRow[] = d.clients ?? [];
        setClients(rows);
        onClientsLoaded?.(rows);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const count = clients?.length ?? 0;
  const MAX = 20;
  const pct = Math.min((count / MAX) * 100, 100);

  return (
    <div className="p-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {loading ? "— " : count} de {MAX} clientes
          </span>
          <span className="text-xs text-zinc-500">{Math.round(pct)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground/70">
              <th className="pb-2 pr-4 font-medium">Cliente</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Plan</th>
              <th className="pb-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse border-b border-white/[0.05]">
                  <td className="py-3 pr-4"><div className="h-3.5 w-24 bg-white/[0.07] rounded" /></td>
                  <td className="py-3 pr-4"><div className="h-3.5 w-36 bg-white/[0.05] rounded" /></td>
                  <td className="py-3 pr-4"><div className="h-5 w-12 bg-white/[0.07] rounded" /></td>
                  <td className="py-3"><div className="h-3.5 w-20 bg-white/[0.05] rounded" /></td>
                </tr>
              ))
            ) : !clients || clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-zinc-500 text-sm">
                  Todavía no creaste ningún cliente. Usá la pestaña Crear Cliente.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="text-zinc-300 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 font-medium">{c.username}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{c.email}</td>
                  <td className="py-2.5 pr-4"><PlanBadge plan={c.plan_slug} /></td>
                  <td className="py-2.5 text-zinc-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
