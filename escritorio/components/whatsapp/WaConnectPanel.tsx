"use client";

import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, Phone, Loader2, MessageCircle } from "lucide-react";
import { WaQRCode } from "./WaQRCode";

interface WaSession {
  status: "disconnected" | "qr_pending" | "connected" | "error";
  phone: string | null;
  display_name: string | null;
  connected_at: string | null;
}

export function WaConnectPanel() {
  const [session, setSession] = useState<WaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.status === 403) {
        // No access — set a sentinel
        setSession({ status: "disconnected", phone: null, display_name: null, connected_at: null });
      } else {
        const data = await res.json();
        setSession(data?.status ? data : { status: "disconnected", phone: null, display_name: null, connected_at: null });
      }
    } catch {
      setSession({ status: "disconnected", phone: null, display_name: null, connected_at: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/whatsapp/logout", { method: "POST" });
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

  if (!session || session.status !== "connected") {
    return <WaQRCode onConnected={loadStatus} />;
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-sm">
      {/* Status badge */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
          <Wifi className="size-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-emerald-400">Conectado</p>
          {session.display_name && (
            <p className="text-xs text-muted-foreground">{session.display_name}</p>
          )}
        </div>
      </div>

      {/* Details */}
      {session.phone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4" />
          <span>+{session.phone}</span>
        </div>
      )}

      {session.connected_at && (
        <p className="text-xs text-muted-foreground">
          Conectado desde{" "}
          {new Date(session.connected_at).toLocaleString("es-AR", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <MessageCircle className="size-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tu WhatsApp está activo. En la lista de contactos vas a ver un botón verde para chatear con quienes tengan teléfono.
        </p>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 w-fit"
      >
        {loggingOut ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <WifiOff className="size-3.5" />
        )}
        Desconectar WhatsApp
      </button>
    </div>
  );
}
