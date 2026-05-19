"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
  Repeat,
  BarChart3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  timeStamp: string;
  blockNumber: string;
}

interface AnalyticsStats {
  totalTransfers: number;
  uniqueHolders: number;
  totalTransactions: number;
}

interface TokenAnalyticsProps {
  projectId: number;
  deployType: "testnet" | "mainnet";
  explorer: string;
  decimals: number;
  contractAddress: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatValue(raw: string, decimals: number): string {
  if (!raw || raw === "0") return "0";
  try {
    if (decimals === 0) return Number(raw).toLocaleString();
    const num = Number(raw) / Math.pow(10, decimals);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return raw;
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - Number(ts) * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── Token Analytics Component ────────────────────────────────────────────────

export function TokenAnalytics({
  projectId,
  deployType,
  explorer,
  decimals,
  contractAddress,
}: TokenAnalyticsProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/forge/analytics?project_id=${projectId}&type=${deployType}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error al cargar analytics");
        return;
      }
      const data = await res.json();
      setTransfers(data.transfers || []);
      setStats(data.stats || null);
    } catch {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, [projectId, deployType]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="bg-muted/50 rounded-xl border border-border overflow-hidden my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground">Analytics</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium capitalize">
            {deployType}
          </span>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          title="Refrescar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Cargando analytics...</span>
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-px bg-border">
              <StatCard
                icon={<Repeat className="w-3.5 h-3.5" />}
                label="Transfers"
                value={stats.totalTransfers.toString()}
              />
              <StatCard
                icon={<Users className="w-3.5 h-3.5" />}
                label="Holders (est.)"
                value={stats.uniqueHolders.toString()}
              />
              <StatCard
                icon={<Activity className="w-3.5 h-3.5" />}
                label="Transacciones"
                value={stats.totalTransactions.toString()}
              />
            </div>
          )}

          {/* Transfer History */}
          <div className="border-t border-border">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground">
                Historial de transfers ({transfers.length})
              </span>
            </div>

            {transfers.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-30" />
                Sin transfers registrados
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {transfers.map((tx, i) => {
                  const isMint =
                    tx.from ===
                    "0x0000000000000000000000000000000000000000";
                  return (
                    <div
                      key={`${tx.hash}-${i}`}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      {/* Icon */}
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                          isMint
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {isMint ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">
                            {isMint ? "Mint" : "Transfer"}
                          </span>
                          <span className="text-foreground font-medium">
                            {formatValue(tx.value, decimals)} {tx.tokenSymbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <span>{shortAddr(tx.from)}</span>
                          <span className="text-border">→</span>
                          <span>{shortAddr(tx.to)}</span>
                        </div>
                      </div>

                      {/* Time + Link */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(tx.timeStamp)}
                        </span>
                        <a
                          href={`${explorer}/tx/${tx.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-emerald-400">{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
