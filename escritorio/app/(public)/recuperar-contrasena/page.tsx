"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/schemas/auth";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [submittedIdentifier, setSubmittedIdentifier] = useState("");

  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema) });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onResend() {
    if (!submittedIdentifier || resendLoading || cooldown > 0) return;
    setResendLoading(true);
    setResendError("");
    setResendStatus("idle");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: submittedIdentifier }),
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

  async function onSubmit(data: ForgotPasswordFormData) {
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: data.identifier }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "No pudimos procesar tu solicitud");
        return;
      }

      setSubmittedIdentifier(data.identifier);
      setSuccess(true);
      reset();
    } catch {
      setError("Error al conectar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-32 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-violet-900/10 blur-3xl" />

      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
            alt="NL360"
            className="h-10 w-auto invert"
          />
          <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-white">
            Recupera tu contraseña
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-400">
            Te enviaremos un enlace por email para resetear tu contraseña. Solo necesitamos tu usuario o email.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.05] px-4 py-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Seguro y rápido
          </div>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10" />
          <div className="relative rounded-3xl border border-border bg-zinc-900/80 p-6 shadow-[var(--shadow-xl)] backdrop-blur">
            <div>
              <div className="text-sm text-zinc-500">NL360</div>
              <div className="text-lg font-semibold text-white">Recuperar acceso</div>
            </div>

            {success ? (
              <div className="mt-8">
                <div className="flex items-center justify-center mb-5">
                  <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <CheckCircle className="size-8 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-center font-semibold text-white mb-2">
                  Email enviado
                </h2>
                <p className="text-center text-sm text-zinc-400 mb-6">
                  Hemos enviado un enlace a tu email. Revisa tu bandeja de entrada (y spam) y sigue las instrucciones.
                </p>
                {resendStatus === "success" && (
                  <div className="flex items-center gap-2 justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 mb-3 text-xs text-emerald-400">
                    <CheckCircle className="size-3.5 flex-shrink-0" />
                    Email reenviado
                  </div>
                )}

                {resendStatus === "error" && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 mb-3 text-xs text-red-400">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    {resendError}
                  </div>
                )}

                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={onResend}
                    disabled={resendLoading || cooldown > 0}
                    className="react-aria-Button w-full h-10 text-sm"
                  >
                    {resendLoading && <Loader2 className="size-4 animate-spin" />}
                    {resendLoading
                      ? "Enviando..."
                      : cooldown > 0
                      ? `Reenviar en ${cooldown}s`
                      : "Reenviar email"}
                  </button>
                  <Link
                    href="/login"
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Volver al login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4">
                <label htmlFor="identifier" className="grid gap-2 text-sm">
                  <span className="react-aria-Label text-xs uppercase tracking-wide">
                    Usuario o Email
                  </span>
                  <input
                    id="identifier"
                    {...register("identifier")}
                    type="text"
                    className="react-aria-Input w-full h-10"
                    placeholder="tuusuario o email@ejemplo.com"
                  />
                  {errors.identifier && (
                    <p className="react-aria-FieldError">{errors.identifier.message}</p>
                  )}
                </label>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400 flex gap-2">
                    <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="react-aria-Button btn-primary w-full mt-2 h-10 text-sm font-semibold"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="react-aria-Link text-xs"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
