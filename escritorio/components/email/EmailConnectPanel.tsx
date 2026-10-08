"use client";

import { useCallback, useEffect, useState } from "react";
import { Wifi, WifiOff, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMAIL_PROVIDERS, type EmailProviderPreset } from "./providers";
import { EmailProviderGuideModal } from "./EmailProviderGuideModal";

interface EmailAccountStatus {
  status: "disconnected" | "connected" | "error";
  provider?: string;
  fromName?: string | null;
  fromEmail?: string;
  connectedAt?: string | null;
}

export function EmailConnectPanel() {
  const [account, setAccount] = useState<EmailAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeProvider, setActiveProvider] = useState<EmailProviderPreset | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/email/status");
      const data = await res.json();
      setAccount(data?.status ? data : { status: "disconnected" });
    } catch {
      setAccount({ status: "disconnected" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/email/logout", { method: "POST" });
      await loadStatus();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (account?.status === "connected") {
    return (
      <div className="flex flex-col gap-5 p-6 max-w-sm">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
            <Wifi className="size-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-400">Conectado</p>
            <p className="text-xs text-muted-foreground">{account.fromName ? `${account.fromName} · ` : ""}{account.fromEmail}</p>
          </div>
        </div>

        {account.connectedAt && (
          <p className="text-xs text-muted-foreground">
            Conectado desde{" "}
            {new Date(account.connectedAt).toLocaleString("es-AR", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Mail className="size-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tu email está activo. Ya podés lanzar campañas de email desde el menú de Emails.
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 w-fit"
        >
          {loggingOut ? <Loader2 className="size-3.5 animate-spin" /> : <WifiOff className="size-3.5" />}
          Desconectar email
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-lg">
      <div>
        <p className="text-sm font-medium">Conectá tu email de salida</p>
        <p className="text-xs text-muted-foreground mt-1">
          Elegí tu proveedor para ver los pasos de conexión (usamos tu propio servidor SMTP, no accedemos a tu bandeja).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {EMAIL_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProvider(p)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-white/[0.05] transition-colors"
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", p.bgClass)}>
              <Mail className={cn("size-5", p.color)} />
            </div>
            <span className="text-xs font-medium text-center">{p.label}</span>
          </button>
        ))}
      </div>

      {activeProvider && (
        <EmailProviderGuideModal
          provider={activeProvider}
          onClose={() => setActiveProvider(null)}
          onConnected={() => { setActiveProvider(null); loadStatus(); }}
        />
      )}
    </div>
  );
}
