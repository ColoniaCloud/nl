"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Eye, Send, Loader2, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: number;
  name: string;
  tag_names: string[] | string | null;
  segment_type: "tags" | "manual";
  status: "draft" | "sending" | "completed" | "cancelled" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  read_count: number;
  created_at: string;
}

const STATUS_LABEL: Record<Campaign["status"], string> = {
  draft: "Borrador",
  sending: "Enviando",
  completed: "Completada",
  cancelled: "Cancelada",
  failed: "Falló",
};

const STATUS_CLASS: Record<Campaign["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-red-500/20 text-red-400 border border-red-500/30",
};

export function WaCampaignsList({ refreshKey }: { refreshKey: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/margarita/crm/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const hasActive = campaigns.some((c) => c.status === "sending");
    if (!hasActive) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [campaigns, load]);

  async function handleCancel(id: number) {
    setCancellingId(id);
    try {
      await fetch(`/api/margarita/crm/campaigns/${id}/cancel`, { method: "POST" });
      load();
    } finally {
      setCancellingId(null);
    }
  }

  function parseTags(tagNames: Campaign["tag_names"]): string[] {
    if (Array.isArray(tagNames)) return tagNames;
    if (typeof tagNames === "string") {
      try { return JSON.parse(tagNames); } catch { return []; }
    }
    return [];
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
        <Loader2 className="size-4 animate-spin" /> Cargando campañas...
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <Send className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Todavía no lanzaste ninguna campaña de WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{campaigns.length} campaña{campaigns.length === 1 ? "" : "s"}</p>
        <button onClick={load} className="p-1.5 text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {campaigns.map((c) => {
        const tags = parseTags(c.tag_names);
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                  {c.segment_type === "manual" ? (
                    <> · Selección manual</>
                  ) : (
                    tags.length > 0 && <> · {tags.join(", ")}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("px-2 py-0.5 rounded-full text-2xs font-medium", STATUS_CLASS[c.status])}>
                  {STATUS_LABEL[c.status]}
                </span>
                {c.status === "sending" && (
                  <button
                    onClick={() => handleCancel(c.id)}
                    disabled={cancellingId === c.id}
                    className="p-1 text-muted-foreground hover:text-red-400"
                    title="Cancelar campaña"
                  >
                    {cancellingId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Send className="size-3" /> {c.total_recipients} destinatarios
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="size-3" /> {c.sent_count} enviados
              </span>
              {c.failed_count > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="size-3" /> {c.failed_count} fallidos
                </span>
              )}
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" /> {c.delivered_count} entregados
              </span>
              <span className="flex items-center gap-1">
                <Eye className="size-3" /> {c.read_count} leídos
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
