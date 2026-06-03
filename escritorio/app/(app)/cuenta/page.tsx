"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  Lock,
  CreditCard,
  LifeBuoy,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "perfil" | "seguridad" | "membresia" | "referidos" | "soporte";

interface Profile {
  id: number;
  username: string;
  displayName: string;
  email: string;
  roles: string[];
  plan: { slug?: string; status?: string } | null;
}

interface ReferralData {
  referralUrl: string;
  code: string;
  total: number;
  converted: number;
  pending: number;
  referrals: Array<{
    referee_id: number;
    referee_username: string;
    status: string;
    plan_slug: string | null;
    created_at: string;
    converted_at: string | null;
  }>;
}

interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planLabel(slug: string | undefined): string {
  if (!slug) return "Free";
  const map: Record<string, string> = {
    nl360_free: "Free",
    nl360_basic: "Basic",
    nl360_pro: "Pro",
    nl360_elite: "Elite",
  };
  return map[slug] || slug;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: "bg-amber-500/20 text-amber-400",
    in_progress: "bg-blue-500/20 text-blue-400",
    resolved: "bg-emerald-500/20 text-emerald-400",
    closed: "bg-zinc-500/20 text-zinc-400",
  };
  const labels: Record<string, string> = {
    open: "Abierto",
    in_progress: "En progreso",
    resolved: "Resuelto",
    closed: "Cerrado",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", styles[status] || styles.open)}>
      {labels[status] || status}
    </span>
  );
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    bug: "Error/Bug",
    feature: "Sugerencia",
    billing: "Facturacion",
    general: "General",
  };
  return map[cat] || cat;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
        type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {type === "ok" ? <CheckCircle className="size-4" /> : <AlertCircle className="size-4" />}
      {msg}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CuentaPage() {
  const [tab, setTab] = useState<Tab>("perfil");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Profile form
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Referrals
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Support
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketCategory, setTicketCategory] = useState("general");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/account/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        setDisplayName(d.displayName || "");
        setEmail(d.email || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "soporte") loadTickets();
    if (tab === "referidos" && !referrals) loadReferrals();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReferrals() {
    setReferralLoading(true);
    try {
      const res = await fetch("/api/referrals", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) setReferrals(d);
    } catch {}
    setReferralLoading(false);
  }

  function copyUrl() {
    if (!referrals) return;
    navigator.clipboard.writeText(referrals.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/account/support", { cache: "no-store" });
      const d = await res.json();
      setTickets(d.tickets || []);
    } catch {}
    setTicketsLoading(false);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const d = await res.json();
      if (d.ok) {
        setToast({ msg: "Perfil actualizado", type: "ok" });
        setProfile((p) => p ? { ...p, displayName, email } : p);
      } else {
        setToast({ msg: d.error || "Error al guardar", type: "err" });
      }
    } catch {
      setToast({ msg: "Error de conexion", type: "err" });
    }
    setSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setToast({ msg: "Las contrasenas no coinciden", type: "err" });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ msg: "Minimo 8 caracteres", type: "err" });
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const d = await res.json();
      if (d.ok) {
        setToast({ msg: "Contrasena actualizada", type: "ok" });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setToast({ msg: d.error || "Error al cambiar contrasena", type: "err" });
      }
    } catch {
      setToast({ msg: "Error de conexion", type: "err" });
    }
    setChangingPw(false);
  }

  async function handleSubmitTicket() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      setToast({ msg: "Completa asunto y mensaje", type: "err" });
      return;
    }
    setSubmittingTicket(true);
    try {
      const res = await fetch("/api/account/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: ticketSubject,
          message: ticketMessage,
          category: ticketCategory,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setToast({ msg: "Ticket enviado correctamente", type: "ok" });
        setTicketSubject("");
        setTicketMessage("");
        setTicketCategory("general");
        setShowNewTicket(false);
        loadTickets();
      } else {
        setToast({ msg: d.error || "Error al enviar", type: "err" });
      }
    } catch {
      setToast({ msg: "Error de conexion", type: "err" });
    }
    setSubmittingTicket(false);
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "seguridad", label: "Seguridad", icon: Lock },
    { id: "membresia", label: "Membresia", icon: CreditCard },
    { id: "referidos", label: "Referidos", icon: Share2 },
    { id: "soporte", label: "Soporte", icon: LifeBuoy },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Configuracion de cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra tu perfil, seguridad, membresia y soporte.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 rounded-lg bg-white/[0.05] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors flex-1 justify-center",
                tab === t.id
                  ? "bg-white/[0.12] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              )}
            >
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── PERFIL ─────────────────────────────────────── */}
        {tab === "perfil" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Informacion personal</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={profile?.username || ""}
                    disabled
                    className="w-full rounded-lg border border-border bg-white/[0.03] px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    El nombre de usuario no se puede cambiar.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Nombre visible
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="mt-6 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar cambios
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Informacion de cuenta</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <span className="ml-2 text-foreground">{profile?.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Roles:</span>
                  <span className="ml-2 text-foreground">
                    {(profile?.roles || []).join(", ") || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEGURIDAD ──────────────────────────────────── */}
        {tab === "seguridad" && (
          <div className="rounded-xl border border-border bg-card/60 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Cambiar contrasena</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nueva contrasena
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  placeholder="Minimo 8 caracteres"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Confirmar contrasena
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  placeholder="Repetir contrasena"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={changingPw || !newPassword || !confirmPassword}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
              >
                {changingPw ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                Cambiar contrasena
              </button>
            </div>
          </div>
        )}

        {/* ── MEMBRESIA ──────────────────────────────────── */}
        {tab === "membresia" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Plan actual</h2>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/20">
                  <CreditCard className="size-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {planLabel(profile?.plan?.slug)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.plan?.status === "active" ? "Activo" : "Plan actual"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Gestionar membresia</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Podes mejorar, renovar o ver los detalles de tu suscripcion.
              </p>
              <Link
                href="/suscripcion"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <CreditCard className="size-4" />
                Ir a Membresias
              </Link>
            </div>
          </div>
        )}

        {/* ── REFERIDOS ─────────────────────────────────── */}
        {tab === "referidos" && (
          <div className="space-y-6">
            {referralLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* URL card */}
                <div className="rounded-xl border border-border bg-card/60 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Share2 className="size-4 text-violet-400" />
                    <h2 className="text-lg font-semibold text-white">Tu enlace de referido</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Compartilo con quien quieras. Cada persona que se registre usando tu enlace queda vinculada a tu cuenta.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={referrals?.referralUrl ?? ""}
                      className="flex-1 rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={copyUrl}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors flex-shrink-0"
                    >
                      {copied ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total referidos", value: referrals?.total ?? 0, color: "text-white" },
                    { label: "Convertidos", value: referrals?.converted ?? 0, color: "text-emerald-400" },
                    { label: "Pendientes", value: referrals?.pending ?? 0, color: "text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card/60 p-4 text-center">
                      <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Referral list */}
                {referrals && referrals.referrals.length > 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-white">Historial</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {referrals.referrals.map((r) => (
                        <div key={r.referee_id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{r.referee_username}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString("es-ES", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </p>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-medium",
                            r.status === "converted"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          )}>
                            {r.status === "converted" ? `Convertido · ${r.plan_slug?.replace("nl360_", "") ?? ""}` : "Pendiente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card/30 px-5 py-10 text-center">
                    <Users className="size-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Todavia no referiste a nadie. Compartí tu enlace para empezar.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SOPORTE ────────────────────────────────────── */}
        {tab === "soporte" && (
          <div className="space-y-6">
            {/* New ticket button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Tickets de soporte</h2>
              <button
                onClick={() => setShowNewTicket(!showNewTicket)}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <Plus className="size-3.5" />
                Nuevo ticket
              </button>
            </div>

            {/* New ticket form */}
            {showNewTicket && (
              <div className="rounded-xl border border-violet-500/30 bg-card/60 p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Crear ticket</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Asunto
                      </label>
                      <input
                        type="text"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        placeholder="Describe brevemente tu problema"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Categoria
                      </label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      >
                        <option value="general">General</option>
                        <option value="bug">Error / Bug</option>
                        <option value="feature">Sugerencia</option>
                        <option value="billing">Facturacion</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Mensaje
                    </label>
                    <textarea
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                      placeholder="Describe tu problema o consulta en detalle..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmitTicket}
                      disabled={submittingTicket}
                      className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                    >
                      {submittingTicket ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Enviar ticket
                    </button>
                    <button
                      onClick={() => setShowNewTicket(false)}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket list */}
            {ticketsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/30 px-5 py-10 text-center">
                <LifeBuoy className="size-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No tienes tickets de soporte. Crea uno si necesitas ayuda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border bg-card/60 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === t.id ? null : t.id)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          #{t.id} — {t.subject}
                        </span>
                        {statusBadge(t.status)}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-[11px] text-muted-foreground hidden sm:block">
                          {formatDate(t.created_at)}
                        </span>
                        {expandedTicket === t.id ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedTicket === t.id && (
                      <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Categoria: {categoryLabel(t.category)}</span>
                          <span>Actualizado: {formatDate(t.updated_at)}</span>
                        </div>
                        {t.admin_reply && (
                          <div className="mt-3 rounded-lg bg-violet-500/10 border border-violet-500/20 p-3">
                            <p className="text-[11px] font-semibold text-violet-400 mb-1">
                              Respuesta del equipo:
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {t.admin_reply}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
