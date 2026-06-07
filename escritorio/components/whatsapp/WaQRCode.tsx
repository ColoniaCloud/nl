"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type WaStatus = "loading" | "qr_pending" | "connected" | "disconnected" | "error";

interface WaQRCodeProps {
  onConnected: () => void;
}

export function WaQRCode({ onConnected }: WaQRCodeProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<WaStatus>("loading");
  const [starting, setStarting] = useState(false);

  async function startSession() {
    setStarting(true);
    try {
      await fetch("/api/whatsapp/qr");
    } catch {}
    setStarting(false);
  }

  // Kick off session on mount
  useEffect(() => {
    startSession();
  }, []);

  // Poll status every 2s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        const data = await res.json();
        const s: WaStatus = data?.status ?? "disconnected";
        setStatus(s);
        if (data?.qr_code) setQr(data.qr_code);
        if (s === "connected") {
          clearInterval(interval);
          onConnected();
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [onConnected]);

  return (
    <div className="flex flex-col items-center gap-5 p-8 max-w-xs mx-auto">
      <div className="text-center">
        <h3 className="font-semibold text-base">Conectá tu WhatsApp</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Escaneá el código QR con tu celular
        </p>
      </div>

      {/* QR area */}
      <div className="relative">
        {qr ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qr}
            alt="Código QR de WhatsApp"
            width={220}
            height={220}
            className="rounded-xl border border-border"
          />
        ) : (
          <div className="w-[220px] h-[220px] rounded-xl border border-border bg-muted flex items-center justify-center">
            {starting || status === "loading" ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-xs text-muted-foreground text-center px-4">
                Generando QR...
              </p>
            )}
          </div>
        )}
      </div>

      <ol className="text-xs text-muted-foreground space-y-1 text-left w-full">
        <li>1. Abrí WhatsApp en tu celular</li>
        <li>2. Ir a <strong>Ajustes → Dispositivos vinculados</strong></li>
        <li>3. Tocá <strong>Vincular un dispositivo</strong></li>
        <li>4. Escaneá este QR</li>
      </ol>

      {qr && (
        <button
          onClick={startSession}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3" /> Regenerar QR
        </button>
      )}

      <p className="text-2xs text-muted-foreground/60 text-center">
        El QR expira en 60 segundos y se regenera automáticamente
      </p>
    </div>
  );
}
