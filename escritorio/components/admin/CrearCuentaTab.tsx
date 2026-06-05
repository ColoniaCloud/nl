"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  userRole: "administrator" | "nl_setters";
};

const ADMIN_PLANS = [
  { value: "nl360_free",   label: "Free" },
  { value: "nl360_basic",  label: "Basic" },
  { value: "nl360_pro",    label: "Pro" },
  { value: "nl360_elite",  label: "Elite" },
  { value: "nl_setters",   label: "Setter" },
];

const SETTER_PLANS = [
  { value: "nl360_free",   label: "Free" },
  { value: "nl360_basic",  label: "Basic" },
  { value: "nl360_pro",    label: "Pro" },
  { value: "nl360_elite",  label: "Elite" },
];

export default function CrearCuentaTab({ userRole }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [planSlug, setPlanSlug] = useState("nl360_free");
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const plans = userRole === "administrator" ? ADMIN_PLANS : SETTER_PLANS;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, plan_slug: planSlug, notes: notes || undefined }),
      });

      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        setSuccess(`Cuenta creada. Se envió email con contraseña temporal a ${email}`);
        setUsername("");
        setEmail("");
        setPlanSlug("nl360_free");
        setNotes("");
        return;
      }

      if (res.status === 403 && data.error?.includes("20")) {
        setError("Alcanzaste el límite de 20 clientes");
      } else if (res.status === 409) {
        setError("El usuario o email ya está registrado");
      } else {
        setError(data.error || "Error al crear la cuenta");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim() !== "" && email.trim() !== "" && planSlug !== "" && !loading;

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-sm font-semibold text-foreground mb-5">Crear nueva cuenta</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Usuario */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">
            Usuario <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* Plan */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">
            Plan <span className="text-red-400">*</span>
          </label>
          <select
            value={planSlug}
            onChange={(e) => setPlanSlug(e.target.value)}
            className="rounded-lg border border-white/[0.10] bg-zinc-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
          >
            {plans.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">
            Notas <span className="text-zinc-600">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear cuenta"
          )}
        </button>

        {/* Feedback */}
        {success && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            ✗ {error}
          </div>
        )}
      </form>
    </div>
  );
}
