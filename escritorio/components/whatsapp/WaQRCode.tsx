"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";

type WaStatus = "loading" | "qr_pending" | "reconnecting" | "connected" | "disconnected" | "error";

interface WaQRCodeProps {
  onConnected: () => void;
}

export function WaQRCode({ onConnected }: WaQRCodeProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<WaStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  async function startSession() {
    setErrorMessage(null);
    try {
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMessage(data?.error ?? `Error al iniciar sesión (${res.status})`);
      }
    } catch {
      setErrorMessage("No se pudo contactar al servidor. Reintentando...");
    }
  }

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    startSession();

    const es = new EventSource("/api/whatsapp/events");

    es.addEventListener("QR_UPDATE", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setErrorMessage(null);
      setQr(data.qrBase64);
      setStatus("qr_pending");
    });

    es.addEventListener("RECONNECTING", () => {
      setStatus("reconnecting");
    });

    es.addEventListener("CONNECTED", () => {
      setStatus("connected");
      setQr(null);
      es.close();
      onConnectedRef.current();
    });

    es.addEventListener("DISCONNECTED", () => {
      setStatus((prev) => (prev === "connected" ? prev : "reconnecting"));
    });

    es.addEventListener("ERROR", () => {
      setErrorMessage("No se pudo vincular WhatsApp. Probá de nuevo.");
    });

    es.onerror = () => {
      setErrorMessage((prev) => prev ?? "Conexión perdida con el servidor. Reintentando...");
    };

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  function handleRetry() {
    setErrorMessage(null);
    setQr(null);
    setStatus("loading");
    setRetryKey((k) => k + 1);
  }

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
        {qr && !errorMessage && status !== "reconnecting" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qr}
            alt="Código QR de WhatsApp"
            width={220}
            height={220}
            className="rounded-xl border border-border"
          />
        ) : (
          <div className="w-[220px] h-[220px] rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-2 p-4">
            {errorMessage ? (
              <>
                <AlertCircle className="size-6 text-red-400" />
                <p className="text-xs text-red-400 text-center">{errorMessage}</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  <RefreshCw className="size-3" /> Reintentar
                </button>
              </>
            ) : status === "reconnecting" ? (
              <>
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  Regenerando código...
                </p>
              </>
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
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

      {qr && !errorMessage && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3" /> Regenerar QR
        </button>
      )}

      <p className="text-2xs text-muted-foreground/60 text-center">
        El QR se regenera automáticamente si expira
      </p>
    </div>
  );
}
