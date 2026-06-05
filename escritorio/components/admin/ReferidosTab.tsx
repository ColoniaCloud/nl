"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Referrer = {
  user_id: number;
  code: string;
  username: string;
  display_name: string | null;
  email: string | null;
  total: number;
  converted: number;
  pending: number;
  last_referral_at: string;
};

function statBadge(n: number, color: string) {
  return (
    <span className={cn("inline-block min-w-[28px] text-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", color)}>
      {n}
    </span>
  );
}

export default function ReferidosTab() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/referrals/admin", { cache: "no-store" });
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const d = await res.json();
      setReferrers(d.referrers || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalReferrals = referrers.reduce((a, r) => a + Number(r.total), 0);
  const totalConverted = referrers.reduce((a, r) => a + Number(r.converted), 0);
  const convRate = totalReferrals > 0 ? Math.round((totalConverted / totalReferrals) * 100) : 0;

  if (forbidden) {
    return (
      <div className="p-6 flex items-center justify-center h-40">
        <p className="text-sm text-red-400">Acceso denegado. Solo administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex justify-end mb-5">
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Referidores activos</span>
          </div>
          <p className="text-2xl font-bold text-white">{referrers.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Total referidos</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalReferrals}</p>
          <p className="text-xs text-emerald-400 mt-1">{totalConverted} convertidos ({convRate}%)</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="size-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalReferrals - totalConverted}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : referrers.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center">
          <Users className="size-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Todavia no hay referidos registrados.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left">
                <th className="px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Codigo</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">Total</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">Convertidos</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">Pendientes</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Ultimo referido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {referrers.map((r) => (
                <tr key={r.user_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-white">{r.display_name || r.username}</p>
                      <p className="text-xs text-zinc-500">{r.email || `@${r.username}`}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-violet-300 bg-violet-500/10 px-2 py-1 rounded">
                      {r.code}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {statBadge(Number(r.total), "bg-zinc-700/60 text-zinc-200")}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {statBadge(Number(r.converted), "bg-emerald-500/20 text-emerald-400")}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {statBadge(Number(r.pending), "bg-amber-500/20 text-amber-400")}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400">
                    {new Date(r.last_referral_at).toLocaleDateString("es-ES", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
