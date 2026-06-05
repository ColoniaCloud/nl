"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: number;
  username: string;
  email: string;
  plan: string;
  registeredAt: string;
};

const PLAN_OPTIONS = [
  { value: "",              label: "Todos" },
  { value: "nl360_free",   label: "Free" },
  { value: "nl360_basic",  label: "Basic" },
  { value: "nl360_pro",    label: "Pro" },
  { value: "nl360_elite",  label: "Elite" },
  { value: "nl_setters",   label: "Setter" },
  { value: "administrator",label: "Admin" },
];

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  nl360_free:    { bg: "bg-zinc-500/20",   text: "text-zinc-400",   label: "Free" },
  nl360_basic:   { bg: "bg-blue-500/20",   text: "text-blue-300",   label: "Basic" },
  nl360_pro:     { bg: "bg-violet-500/20", text: "text-violet-300", label: "Pro" },
  nl360_elite:   { bg: "bg-yellow-500/20", text: "text-yellow-300", label: "Elite" },
  nl_setters:    { bg: "bg-green-500/20",  text: "text-green-300",  label: "Setter" },
  administrator: { bg: "bg-red-500/20",    text: "text-red-300",    label: "Admin" },
};

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { bg: "bg-zinc-500/20", text: "text-zinc-400", label: plan };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="animate-pulse border-b border-white/[0.05]">
          <td className="py-3 pr-4"><div className="h-3.5 w-24 bg-white/[0.07] rounded" /></td>
          <td className="py-3 pr-4"><div className="h-3.5 w-36 bg-white/[0.05] rounded" /></td>
          <td className="py-3 pr-4"><div className="h-5 w-12 bg-white/[0.07] rounded" /></td>
          <td className="py-3"><div className="h-3.5 w-20 bg-white/[0.05] rounded" /></td>
        </tr>
      ))}
    </>
  );
}

export default function UsuariosTab() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = new URL("/api/admin/users", window.location.origin);
    if (debouncedSearch) url.searchParams.set("search", debouncedSearch);
    if (planFilter)      url.searchParams.set("plan", planFilter);

    fetch(url.toString(), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Error al cargar usuarios");
        setUsers(d.users);
        setTotal(d.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [debouncedSearch, planFilter]);

  return (
    <div className="p-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-white/[0.10] bg-zinc-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
        >
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value === "" ? "Plan: Todos" : opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground/70">
              <th className="pb-2 pr-4 font-medium">Usuario</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Plan</th>
              <th className="pb-2 font-medium">Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {loading ? (
              <SkeletonRows />
            ) : !users || users.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-zinc-500 text-sm">
                  Sin resultados
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="text-zinc-300 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 font-medium">{u.username}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{u.email}</td>
                  <td className="py-2.5 pr-4"><PlanBadge plan={u.plan} /></td>
                  <td className="py-2.5 text-zinc-500 text-xs">
                    {new Date(u.registeredAt).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pie */}
      {!loading && !error && (
        <p className="mt-4 text-xs text-zinc-500">
          Mostrando {total} usuario{total !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
