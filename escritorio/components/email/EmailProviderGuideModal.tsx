"use client";

import { useState } from "react";
import { X, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmailProviderPreset } from "./providers";

interface EmailProviderGuideModalProps {
  provider: EmailProviderPreset;
  onClose: () => void;
  onConnected: () => void;
}

export function EmailProviderGuideModal({ provider, onClose, onConnected }: EmailProviderGuideModalProps) {
  const [host, setHost] = useState(provider.host ?? "");
  const [port, setPort] = useState(String(provider.port ?? 587));
  const [secure, setSecure] = useState(provider.secure);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = provider.id === "custom";

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/email/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          host, port: Number(port), secure, user, password,
          fromName: fromName.trim() || undefined,
          fromEmail: fromEmail.trim() || user,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo conectar");
      onConnected();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:w-[480px] max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", provider.bgClass)}>
            <Mail className={cn("size-4", provider.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{provider.label}</p>
            <p className="text-xs text-muted-foreground truncate">Conectar cuenta de email</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ol className="space-y-2">
            {provider.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-2xs font-medium mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="space-y-2.5 pt-2 border-t border-border">
            {isCustom && (
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host SMTP" className="bg-muted border-border col-span-2" />
                <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Puerto" type="number" className="bg-muted border-border" />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
                  SSL/TLS
                </label>
              </div>
            )}
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario (tu email)" className="bg-muted border-border" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña de aplicación" type="password" className="bg-muted border-border" />
            <div className="grid grid-cols-2 gap-2.5">
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Nombre remitente (opcional)" className="bg-muted border-border" />
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="Email remitente" className="bg-muted border-border" />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex-shrink-0 p-4 border-t border-border">
          <Button onClick={handleConnect} disabled={connecting || !host || !user || !password} className="w-full gap-2">
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {connecting ? "Conectando..." : "Conectar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
