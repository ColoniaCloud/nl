"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Loader2, Mail } from "lucide-react";

export default function ConfirmarEmailPage() {
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim() || resendLoading || cooldown > 0) return;
    setResendLoading(true);
    setResendError("");
    setResendStatus("idle");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendError(data?.error || "No pudimos reenviar el email.");
        setResendStatus("error");
        return;
      }
      setResendStatus("success");
      setCooldown(30);
    } catch {
      setResendError("Error al conectar. Intenta de nuevo.");
      setResendStatus("error");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="py-12 md:py-20 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
            alt="NL360"
            className="h-10 w-10 invert mx-auto mb-5"
          />
        </div>

        <div className="rounded-2xl border border-white/[0.10] bg-zinc-900/60 backdrop-blur-sm p-8 text-center">
          <div className="flex items-center justify-center mb-5">
            <div className="rounded-full bg-violet-500/10 border border-violet-500/20 p-4">
              <Mail className="size-8 text-violet-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            Revisa tu bandeja de entrada
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Te enviamos un email con un enlace de confirmacion. Haz clic en el
            enlace para activar tu cuenta.
          </p>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6">
            <p className="text-xs text-amber-400">
              Si no encuentras el email, revisa tu carpeta de spam o correo no
              deseado.
            </p>
          </div>

          {/* Resend section */}
          <div className="mb-4 border-t border-white/[0.06] pt-5">
            <p className="text-xs text-zinc-500 mb-3">¿No recibiste el email?</p>
            <form onSubmit={onResend} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full h-10 rounded-xl border border-white/[0.10] bg-zinc-800 px-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />

              {resendStatus === "success" && (
                <div className="flex items-center gap-2 justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  <CheckCircle className="size-3.5 flex-shrink-0" />
                  Email enviado
                </div>
              )}

              {resendStatus === "error" && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  <AlertCircle className="size-3.5 flex-shrink-0" />
                  {resendError}
                </div>
              )}

              <button
                type="submit"
                disabled={resendLoading || cooldown > 0}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendLoading && <Loader2 className="size-4 animate-spin" />}
                {resendLoading
                  ? "Enviando..."
                  : cooldown > 0
                  ? `Reenviar en ${cooldown}s`
                  : "Reenviar email de verificación"}
              </button>
            </form>
          </div>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Volver al inicio de sesion
          </Link>
        </div>
      </div>
    </div>
  );
}
