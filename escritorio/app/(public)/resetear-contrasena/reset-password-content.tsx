"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const uid = searchParams.get("uid");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token || !uid) {
      setError("Enlace inválido. Faltan parámetros.");
      setValidating(false);
      return;
    }

    fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, uid, validate: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.valid) {
          setIsValidToken(true);
        } else {
          setError(data?.error || "Token inválido o expirado.");
        }
      })
      .catch((err) => {
        console.error("Validation error:", err);
        setError("Error al validar el enlace. Intenta de nuevo.");
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token, uid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uid, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Error al cambiar la contraseña.");
        return;
      }

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Submit error:", err);
      setError("Error de conexión. Intenta de nuevo.");
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
            Nueva contraseña
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-400">
            Crea una contraseña fuerte y segura para tu cuenta NL360. Recuerda guardarla en un lugar seguro.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.05] px-4 py-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Contraseña mínimo 8 caracteres
          </div>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10" />
          <div className="relative rounded-3xl border border-white/[0.10] bg-zinc-900/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
            <div>
              <div className="text-sm text-zinc-500">NL360</div>
              <div className="text-lg font-semibold text-white">Resetear contraseña</div>
            </div>

            {validating ? (
              <div className="mt-8 text-center">
                <Loader2 className="size-10 text-violet-400 animate-spin mx-auto mb-4" />
                <p className="text-sm text-zinc-400">Validando enlace...</p>
              </div>
            ) : success ? (
              <div className="mt-8">
                <div className="flex items-center justify-center mb-5">
                  <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <CheckCircle className="size-8 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-center font-semibold text-white mb-2">
                  ¡Listo!
                </h2>
                <p className="text-center text-sm text-zinc-400 mb-6">
                  Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
                >
                  Ir al login
                </Link>
              </div>
            ) : !isValidToken ? (
              <div className="mt-8">
                <div className="flex items-center justify-center mb-5">
                  <div className="rounded-full bg-red-500/10 border border-red-500/20 p-4">
                    <AlertCircle className="size-8 text-red-400" />
                  </div>
                </div>
                <h2 className="text-center font-semibold text-white mb-2">
                  Enlace inválido
                </h2>
                <p className="text-center text-sm text-zinc-400 mb-6">
                  {error || "Este enlace ha expirado o es inválido. Solicita uno nuevo."}
                </p>
                <Link
                  href="/recuperar-contrasena"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
                >
                  Solicitar nuevo enlace
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nueva contraseña
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-3 pr-10 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Confirmar contraseña
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    placeholder="••••••••"
                  />
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
                  className="mt-2 w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {loading ? "Cambiando..." : "Cambiar contraseña"}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
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
