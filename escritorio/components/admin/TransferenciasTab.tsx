"use client";

import { useEffect, useState } from "react";
import { Check, X, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanSlug } from "@/lib/wp-billing";

type Transfer = {
  id: string;
  user_id: number;
  plan_slug: PlanSlug;
  billing_cycle: "monthly" | "annual";
  amount_usd: number;
  receipt_url: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  nl360_basic: "Basic",
  nl360_pro: "Pro",
  nl360_elite: "Elite",
};

export default function TransferenciasTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/admin/transfers?status=${statusFilter}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 403) {
        setTransfers([]);
        setLoading(false);
        return;
      }
      setTransfers(data?.transfers || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(id: string, action: "approve" | "reject", notes?: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/billing/admin/transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      if (res.ok) {
        setTransfers((prev) => prev.filter((t) => t.id !== id));
        setRejectOpen(null);
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-900 border border-white/[0.08] text-zinc-400 hover:text-zinc-200"
              )}
            >
              {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobados" : "Rechazados"}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Actualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-500">
            {statusFilter === "pending" ? "No hay transferencias pendientes." : "Sin registros."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((t) => (
            <div key={t.id} className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Thumbnail */}
                <a href={t.receipt_url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  {t.receipt_url.endsWith(".pdf") ? (
                    <div className="w-20 h-20 rounded-lg border border-white/[0.08] bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 gap-1">
                      <ExternalLink className="size-3" />
                      PDF
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.receipt_url}
                      alt="Comprobante"
                      className="w-20 h-20 object-cover rounded-lg border border-white/[0.08]"
                    />
                  )}
                </a>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">Usuario #{t.user_id}</span>
                    <span className="text-xs text-zinc-400">
                      Plan {PLAN_LABELS[t.plan_slug] || t.plan_slug} · {t.billing_cycle}
                    </span>
                    <span className="text-xs font-mono text-violet-300">${t.amount_usd} USD</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enviado el{" "}
                    {new Date(t.created_at).toLocaleString("es", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {t.notes && (
                    <p className="text-xs text-zinc-400 mt-1 italic">{t.notes}</p>
                  )}
                  <a
                    href={t.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                    <ExternalLink className="size-3" />
                    Ver comprobante completo
                  </a>
                </div>

                {/* Actions */}
                {t.status === "pending" && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(t.id, "approve")}
                      disabled={actionLoading === t.id}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      <Check className="size-3.5" />
                      Aprobar
                    </button>

                    {rejectOpen === t.id ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          placeholder="Motivo del rechazo..."
                          value={rejectNotes[t.id] || ""}
                          onChange={(e) =>
                            setRejectNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          className="w-40 text-xs rounded-lg bg-zinc-800 border border-white/[0.08] px-2 py-1.5 text-zinc-200 resize-none"
                          rows={2}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAction(t.id, "reject", rejectNotes[t.id])}
                            disabled={actionLoading === t.id}
                            className="flex-1 rounded-md bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setRejectOpen(null)}
                            className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectOpen(t.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
                      >
                        <X className="size-3.5" />
                        Rechazar
                      </button>
                    )}
                  </div>
                )}

                {t.status !== "pending" && (
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      t.status === "approved"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-red-400/10 text-red-400"
                    )}
                  >
                    {t.status === "approved" ? "Aprobado" : "Rechazado"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
