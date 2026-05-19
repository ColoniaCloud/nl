"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function safeNextPath(): string {
  if (typeof window === "undefined") return "/workspace";
  const url = new URL(window.location.href);
  const n = url.searchParams.get("next");
  return n && n.startsWith("/") ? n : "/workspace";
}

export default function LoginPage() {
  const [nextPath, setNextPath] = useState<string>("/workspace");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [unverified, setUnverified] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setNextPath(safeNextPath());
    const url = new URL(window.location.href);
    if (url.searchParams.get("verified") === "1") setVerified(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setUnverified(!!data?.unverified);
        setError(data?.error || "Credenciales incorrectas");
        return;
      }
      setUnverified(false);

      window.location.assign(nextPath);
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Decor */}
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
            Inicia sesion en Backoffice 360
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-400">
            Accede a tus agentes, automatizaciones y panel de cliente con tu cuenta NL360.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.05] px-4 py-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Seguridad y acceso centralizado
          </div>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10" />
          <div className="relative rounded-3xl border border-white/[0.10] bg-zinc-900/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-500">NL360</div>
                <div className="text-lg font-semibold text-white">Iniciar sesion</div>
              </div>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                Backoffice
              </span>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Usuario
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  placeholder="tuusuario"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Contrasena
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-xl border border-white/[0.10] bg-zinc-800 px-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  placeholder="••••••••"
                />
              </label>

              {verified && !error && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  Email verificado. Ya puedes iniciar sesion.
                </div>
              )}

              {error && !unverified && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              {error && unverified && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  {error}{" "}
                  <Link
                    href="/registro/confirmar-email"
                    className="underline hover:text-amber-300 transition-colors"
                  >
                    Ver instrucciones
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/recuperar-contrasena"
                  className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
                <Link
                  href="/registro"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Crear cuenta
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
