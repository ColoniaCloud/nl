"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
export const dynamic = "force-dynamic";
import { marked } from "marked";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  X,
  Crown,
  Gem,
  Handshake,
  Eye,
  Flame,
  Zap,
  Sparkles,
  GraduationCap,
  Clock,
  Trash2,
  MessageSquarePlus,
  History,
  NotebookPen,
  FileDown,
  Plus,
  Send,
  Check,
  CloudOff,
  Pencil,
  Search,
  Download,
  Share2,
} from "lucide-react";

// Map icon string (as stored in the subagent registry) to a Lucide component.
const ICON_MAP: Record<string, React.ElementType> = {
  Crown,
  Gem,
  Handshake,
  Eye,
  Flame,
  Zap,
  Sparkles,
  GraduationCap,
  BookOpen,
};
function iconFor(name: string | undefined): React.ElementType {
  return (name && ICON_MAP[name]) || GraduationCap;
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Tool IDs are now arbitrary strings registered in the server-side subagent
// registry (/api/mentoria/agents). Examples: NAPOLEON, NEVILLE_DISRUPTIVO_1,
// NEVILLE_DISRUPTIVO_2.
// type ToolType = string; // Legacy, eliminar
type Step = "dashboard" | "history" | "chat" | "neville-select";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  options?: string[];
  timestamp: Date;
}

interface StoredMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  options?: string[];
  timestamp: string;
}

interface SessionMeta {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ToolDef {
  id: string;
  title: string;
  description: string;
  Icon: React.ElementType;
  initialContent: string;
  initialOptions: string[];
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

// Soft warning threshold — when reached, we suggest starting a new chat.
const SESSION_MSG_WARN_THRESHOLD = 100;

// const TOOLS: ToolDef[] = []; // Legacy, eliminar
// references — the real list is fetched dynamically from /api/mentoria/agents
// and stored in state (`availableTools`). Replacing TOOLS everywhere would
// make the diff huge; instead, we read the live list at the render sites.

/** Agent summary as returned by /api/mentoria/agents. */
interface AgentSummary {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  provider: "anthropic" | "venice" | "nvidia_nim";
  requiresConfirmation?: boolean;
  disclaimer?: string;
  totalLessons: number;
  welcome: { content: string; options: string[] };
}

function summaryToToolDef(a: AgentSummary): ToolDef {
  const Icon = iconFor(a.icon);
  return {
    id: a.id,
    title: a.subtitle ? `${a.title} — ${a.subtitle}` : a.title,
    description: a.description,
    Icon,
    initialContent: a.welcome.content,
    initialOptions: a.welcome.options,
  };
}

/* Legacy TOOLS reference — superseded by the dynamic list from the API. */
const _LEGACY_TOOLS: ToolDef[] = [
  {
    id: "LEYES_EXITO",
    title: "Las Leyes del Exito",
    description:
      "Domina tu mentalidad y alcanza el exito con los principios que han guiado a los grandes.",
    Icon: Crown,
    initialContent:
      "Bienvenido. Soy **MentorIA**, tu guia en los principios del exito.\n\nExiste una filosofia del exito que ha transformado a miles de personas — principios documentados despues de décadas de investigacion con los hombres mas exitosos del siglo XX: Carnegie, Ford, Rockefeller, Edison.\n\nEstamos a punto de recorrer esos principios juntos. No como teoria — como un plan de accion real para tu vida.",
    initialOptions: [
      "Empezar por el Modulo 1",
      "Ver el plan completo",
      "Tengo una pregunta especifica",
    ],
  },
  {
    id: "MARKETING_PREMIUM",
    title: "Marketing Premium",
    description:
      "Aprende marketing con los estandares mas altos: posicionamiento de lujo y estrategias de elite.",
    Icon: Gem,
    initialContent:
      "Bienvenido a **Marketing Premium**. Aqui aprenderas a posicionar marcas en la cima del mercado.\n\n¿Cual es nuestro primer objetivo?",
    initialOptions: ["Estrategias de Lujo", "Copywriting de Elite", "Posicionamiento de Marca"],
  },
  {
    id: "CLOSER_PRO",
    title: "Closer Pro",
    description:
      "Transforma tu carrera: de vendedor estandar a Closer profesional de alto impacto.",
    Icon: Handshake,
    initialContent:
      "Bienvenido al entrenamiento de **Closer Pro**. Vamos a convertirte en un cerrador de alto impacto.\n\n¿Que habilidad quieres pulir primero?",
    initialOptions: ["Manejo de Objeciones", "Psicologia del Cliente", "Scripts de Cierre"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  // Prefer crypto.randomUUID (CHAR(36) compatible); fallback for old browsers
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function toStored(messages: Message[]): StoredMessage[] {
  return messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
}

function fromStored(stored: StoredMessage[]): Message[] {
  return stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetchSessions(
  tool: string,
  opts: { before?: string | null; limit?: number; q?: string; trashed?: boolean } = {}
): Promise<{ sessions: SessionMeta[]; hasMore: boolean; nextCursor: string | null }> {
  try {
    const params = new URLSearchParams({ tool });
    if (opts.before) params.set("before", opts.before);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    if (opts.trashed) params.set("trashed", "1");
    const res = await fetch(`/api/mentoria/sessions?${params.toString()}`);
    if (!res.ok) return { sessions: [], hasMore: false, nextCursor: null };
    const data = await res.json();
    return {
      sessions: data.sessions ?? [],
      hasMore: !!data.hasMore,
      nextCursor: data.nextCursor ?? null,
    };
  } catch {
    return { sessions: [], hasMore: false, nextCursor: null };
  }
}

async function apiRenameSession(id: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiFetchNotes(tool: string): Promise<string> {
  try {
    const res = await fetch(`/api/mentoria/notes?tool=${tool}`);
    if (!res.ok) return "";
    const data = await res.json();
    return typeof data.content === "string" ? data.content : "";
  } catch {
    return "";
  }
}

async function apiSaveNotes(tool: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiUpsertSession(
  id: string,
  tool: string,
  messages: Message[]
): Promise<{ ok: boolean; tooLarge?: boolean }> {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return { ok: true };
  const title =
    userMsgs[0].content.slice(0, 100) + (userMsgs[0].content.length > 100 ? "..." : "");

  const body = JSON.stringify({ id, tool, title, messages: toStored(messages) });

  // Retry up to 3 times with exponential backoff (300ms, 800ms)
  const delays = [0, 300, 800];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const res = await fetch("/api/mentoria/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return { ok: true };
      if (res.status === 413) return { ok: false, tooLarge: true };
      // 4xx: don't retry (client error — payload invalid, auth, etc.)
      if (res.status >= 400 && res.status < 500) return { ok: false };
    } catch {
      // network error — retry
    }
  }
  return { ok: false };
}

/** Fire-and-forget save using sendBeacon for page-unload path. */
function beaconUpsertSession(id: string, tool: string, messages: Message[]): void {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const title =
    userMsgs[0].content.slice(0, 100) + (userMsgs[0].content.length > 100 ? "..." : "");
  const body = JSON.stringify({ id, tool, title, messages: toStored(messages) });
  try {
    navigator.sendBeacon(
      "/api/mentoria/sessions",
      new Blob([body], { type: "application/json" })
    );
  } catch {
    // ignore — best-effort path on unload
  }
}

async function apiDeleteSession(id: string, permanent = false): Promise<boolean> {
  try {
    const qs = permanent ? "?permanent=1" : "";
    const res = await fetch(`/api/mentoria/sessions/${id}${qs}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiRestoreSession(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Incremental append — returns the new server seq on success,
 *  "mismatch" if the seqs got out of sync (caller should full-upsert),
 *  "too_large" if the server rejected the payload,
 *  or null on other failures. */
async function apiAppendMessages(
  sessionId: string,
  baseSeq: number,
  tail: Message[]
): Promise<number | "mismatch" | "too_large" | null> {
  if (tail.length === 0) return baseSeq;
  try {
    const res = await fetch(`/api/mentoria/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSeq, messages: toStored(tail) }),
    });
    if (res.ok) {
      const d = await res.json();
      return typeof d.newSeq === "number" ? d.newSeq : baseSeq + tail.length;
    }
    if (res.status === 409) return "mismatch";
    if (res.status === 413) return "too_large";
    return null;
  } catch {
    return null;
  }
}

type SearchHit = {
  sessionId: string;
  tool: string;
  title: string;
  updatedAt: string;
  role: string;
  snippet: string;
  seq: number;
};

async function apiSearch(q: string, tool?: string): Promise<SearchHit[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const params = new URLSearchParams({ q: q.trim() });
    if (tool) params.set("tool", tool);
    const res = await fetch(`/api/mentoria/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

function downloadSessionExport(sessionId: string, format: "md" | "json") {
  const url = `/api/mentoria/sessions/${sessionId}/export?format=${format}`;
  // Use a hidden anchor to trigger browser download with cookies.
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function createShareLink(
  sessionId: string
): Promise<{ url: string; token: string; ttlDays: number } | { error: string }> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${sessionId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.error || `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data.ok || !data.token) return { error: "invalid_response" };
    const absolute =
      typeof window !== "undefined"
        ? `${window.location.origin}/share/${data.token}`
        : `/share/${data.token}`;
    return { url: absolute, token: data.token, ttlDays: Number(data.ttlDays) || 30 };
  } catch {
    return { error: "network" };
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function downloadSummaryPDF(
  toolTitle: string,
  summaryText: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Header
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MentorIA — Resumen de Progreso", margin, 12);

  // Subheader
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const now = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`${toolTitle}  ·  Generado el ${now}`, margin, 17);

  // Divider
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.3);
  doc.line(margin, 23, pageW - margin, 23);

  // Body
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(summaryText, contentW);
  let y = 30;
  const lineH = 5.5;
  const pageH = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Pagina ${i} de ${totalPages}  ·  MentorIA by NL360`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  doc.save(`mentoria-resumen-${Date.now()}.pdf`);
}

// ─── Notes Modal ──────────────────────────────────────────────────────────────

function NotesModal({
  open,
  notes,
  onChange,
  onClose,
}: {
  open: boolean;
  notes: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-4 text-sky-400" />
            <span className="text-sm font-semibold text-foreground">Mis Notas</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* Body */}
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Captura tus ideas clave, conceptos importantes, reflexiones..."
          className="flex-1 w-full bg-transparent resize-none focus:outline-none text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/50 px-4 py-3"
          style={{ minHeight: "300px" }}
          spellCheck={false}
          autoFocus
        />
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-[10px] text-muted-foreground">
            Guardado automaticamente
          </span>
          <button
            onClick={() => onChange("")}
            className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sessions Modal ───────────────────────────────────────────────────────────

function SessionsModal({
  open,
  sessions,
  loading,
  tool,
  onLoad,
  onDelete,
  onClose,
}: {
  open: boolean;
  sessions: SessionMeta[];
  loading: boolean;
  tool: ToolDef | null;
  onLoad: (session: SessionMeta) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (!open || !tool) return null;
  const TIcon = tool.Icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="size-4 text-sky-400" />
            <span className="text-sm font-semibold text-foreground">Mis Sesiones</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: "200px", maxHeight: "60vh" }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay sesiones guardadas.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between gap-3 hover:border-sky-500/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-2.5" />
                        {formatDate(session.updated_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.message_count} msg
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onLoad(session)}
                      className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/40 text-muted-foreground hover:text-destructive p-1.5 transition-all"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ChatMessage ──────────────────────────────────────────────────────────────

function ChatMessage({
  message,
  onButtonClick,
}: {
  message: Message;
  onButtonClick: (text: string) => void;
}) {
  const isUser = message.role === "user";

  const cleanHtml = useMemo(() => {
    if (isUser) return "";
    return marked.parse(message.content) as string;
  }, [message.content, isUser]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={[
          "max-w-[90%] sm:max-w-[80%] text-xs sm:text-sm leading-relaxed",
          isUser
            ? "bg-sky-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 sm:px-4 py-2.5 sm:py-3 whitespace-pre-wrap"
            : "text-foreground px-1 flex flex-col gap-2",
        ].join(" ")}
      >
        {isUser ? (
          message.content
        ) : (
          <>
            <div
              className="prose prose-sm prose-invert max-w-none [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
            {/* Option buttons */}
            {message.options && message.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {message.options.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => onButtonClick(btn)}
                    className="border border-sky-500/40 bg-sky-500/10 text-sky-400 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-all hover:bg-sky-600 hover:text-white hover:border-sky-600 active:scale-95"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SaveStatusIndicator ─────────────────────────────────────────────────────

function SaveStatusIndicator({
  status,
  savedAt,
}: {
  status: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
}) {
  // `tick` forces re-computation of the relative label every 30s.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (status !== "saved" || !savedAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [status, savedAt]);

  const label = useMemo(() => {
    if (status !== "saved" || !savedAt) return "Guardado";
    const diffSec = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 1000));
    if (diffSec < 5) return "Guardado";
    if (diffSec < 60) return `Guardado hace ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Guardado hace ${diffMin}m`;
    return "Guardado";
    // `tick` is intentionally in deps so the label re-computes on the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, savedAt, tick]);

  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span
        title="Guardando tu conversacion"
        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground px-1.5"
      >
        <Loader2 className="size-3 animate-spin" />
        <span className="hidden sm:inline">Guardando...</span>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        title="No se pudo guardar. Reintentando..."
        className="flex items-center gap-1 text-[10px] font-medium text-destructive px-1.5"
      >
        <CloudOff className="size-3" />
        <span className="hidden sm:inline">Error al guardar</span>
      </span>
    );
  }

  // status === "saved"
  return (
    <span
      title={savedAt ? `Ultima vez: ${savedAt.toLocaleTimeString("es-ES")}` : "Guardado"}
      className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 px-1.5"
    >
      <Check className="size-3" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MentoriaPage() {
  const [step, setStep] = useState<Step>("dashboard");
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const [historyTool, setHistoryTool] = useState<ToolDef | null>(null);
  const [historySessions, setHistorySessions] = useState<SessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState<boolean>(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  // Papelera
  const [historyView, setHistoryView] = useState<"active" | "trash">("active");
  const [trashSessions, setTrashSessions] = useState<SessionMeta[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashCursor, setTrashCursor] = useState<string | null>(null);
  const [trashHasMore, setTrashHasMore] = useState<boolean>(false);
  const [trashLoadingMore, setTrashLoadingMore] = useState<boolean>(false);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | null>(null);
  const [sizeWarnDismissed, setSizeWarnDismissed] = useState<boolean>(false);
  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  // Share modal
  const [shareModal, setShareModal] = useState<
    | { status: "loading"; sessionId: string; title: string }
    | { status: "ready"; sessionId: string; title: string; url: string; copied: boolean; ttlDays: number }
    | { status: "error"; sessionId: string; title: string; message: string }
    | null
  >(null);

  // Reset size-warning dismissal when the active session changes.
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(genId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [sessionsModalData, setSessionsModalData] = useState<SessionMeta[]>([]);
  const [sessionsModalLoading, setSessionsModalLoading] = useState(false);
  const [probingTool, setProbingTool] = useState<string | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [sessionHasMore, setSessionHasMore] = useState<Record<string, boolean>>({});
  const [availableTools, setAvailableTools] = useState<ToolDef[]>([]);
  const [agentMeta, setAgentMeta] = useState<Record<string, AgentSummary>>({});
  // Progress state for the active tool (lesson id + completed lessons).
  const [progress, setProgress] = useState<{
    currentLessonId: number;
    completed: number[];
    totalLessons: number;
    isComplete: boolean;
  } | null>(null);
  const [confirmDisruptive, setConfirmDisruptive] = useState<AgentSummary | null>(null);
  const [pendingAutoAgent, setPendingAutoAgent] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputBtnPressed = useRef(false);
  // Track last serialized messages to skip redundant saves
  const lastSavedRef = useRef<string>("");
  // Number of messages already synced to the server (seq in mt_messages).
  // Used for incremental append — if this matches server count we only send
  // the tail. On mismatch (409) we fall back to a full upsert.
  const syncedSeqRef = useRef<number>(0);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Load notes from DB when tool changes. One-shot migration: if there's a
  // legacy value in localStorage and the DB has none, upload it then remove it.
  const notesLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTool) return;
    notesLoadedRef.current = null;
    let cancelled = false;
    (async () => {
      const remote = await apiFetchNotes(activeTool.id);
      if (cancelled) return;
      if (remote) {
        setNotes(remote);
        try {
          localStorage.removeItem(`mentoria_notes_${activeTool.id}`);
        } catch {}
      } else {
        let legacy = "";
        try {
          legacy = localStorage.getItem(`mentoria_notes_${activeTool.id}`) || "";
        } catch {}
        if (legacy) {
          setNotes(legacy);
          const ok = await apiSaveNotes(activeTool.id, legacy);
          if (ok) {
            try {
              localStorage.removeItem(`mentoria_notes_${activeTool.id}`);
            } catch {}
          }
        } else {
          setNotes("");
        }
      }
      // Mark load complete for this tool, now save effect can write.
      notesLoadedRef.current = activeTool.id;
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTool]);

  // Persist notes to DB with debounce (2s). Only runs after the load for the
  // current tool has completed, to avoid overwriting remote with empty.
  useEffect(() => {
    if (!activeTool) return;
    if (notesLoadedRef.current !== activeTool.id) return;
    const t = setTimeout(() => {
      apiSaveNotes(activeTool.id, notes);
    }, 2000);
    return () => clearTimeout(t);
  }, [notes, activeTool]);

  // Refresh session counts when dashboard shown
  const refreshCounts = useCallback(async () => {
    const tools = availableTools;
    if (tools.length === 0) return;
    const results = await Promise.all(tools.map((t) => apiFetchSessions(t.id)));
    const counts: Record<string, number> = {};
    const more: Record<string, boolean> = {};
    tools.forEach((t, i) => {
      counts[t.id] = results[i].sessions.length;
      more[t.id] = results[i].hasMore;
    });
    setSessionCounts(counts);
    setSessionHasMore(more);
  }, [availableTools]);

  // Fetch the list of available subagents from the server on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mentoria/agents");
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ok || !Array.isArray(data.agents)) return;
        if (cancelled) return;
        const agents = data.agents as AgentSummary[];
        setAvailableTools(agents.map(summaryToToolDef));
        const metaMap: Record<string, AgentSummary> = {};
        agents.forEach((a) => {
          metaMap[a.id] = a;
        });
        setAgentMeta(metaMap);
      } catch {
        // silent; dashboard will simply show an empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step === "dashboard") refreshCounts();
  }, [step, refreshCounts]);

  // Detect ?agent= URL param on mount (client-side only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("agent");
    if (param) setPendingAutoAgent(param.toUpperCase());
  }, []);

  // Once agents are loaded, process the pending auto-agent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingAutoAgent || availableTools.length === 0) return;
    const pending = pendingAutoAgent;
    setPendingAutoAgent(null);
    if (pending === "NEVILLE") {
      setStep("neville-select");
    } else {
      const tool = availableTools.find((t) => t.id === pending);
      if (!tool) return;
      const meta = agentMeta[tool.id];
      if (meta?.requiresConfirmation) {
        setConfirmDisruptive(meta);
      } else {
        selectTool(tool);
      }
    }
  }, [pendingAutoAgent, availableTools, agentMeta]);

  // Reset the "chat muy largo" dismissal whenever we change session.
  useEffect(() => {
    setSizeWarnDismissed(false);
  }, [currentSessionId]);

  // Debounced search: runs when user types in the history search box.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const hits = await apiSearch(q, historyTool?.id);
      setSearchResults(hits);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, historyTool]);

  // ── Autosave: debounced save on every message change ─────────────────────────
  // Strategy: when messages only grew at the tail (and server's syncedSeq
  // matches what we think it has), send just the tail via the incremental
  // append endpoint. Otherwise fall back to a full upsert.
  useEffect(() => {
    if (!activeTool || step !== "chat") return;
    if (messages.filter((m) => m.role === "user").length === 0) return;

    const serialized = JSON.stringify(toStored(messages));
    if (serialized === lastSavedRef.current) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      const base = syncedSeqRef.current;
      const canAppend =
        base > 0 &&
        messages.length > base &&
        // Prefix must be unchanged — an append can't rewrite history.
        // We detect that by checking the serialized length prefix is stable;
        // if any earlier message was edited, we fall back to full upsert.
        lastSavedRef.current.length > 0 &&
        serialized.startsWith(lastSavedRef.current.slice(0, -1)); // strip trailing ']'

      if (canAppend) {
        const tail = messages.slice(base);
        const r = await apiAppendMessages(currentSessionId, base, tail);
        if (typeof r === "number") {
          syncedSeqRef.current = r;
          lastSavedRef.current = serialized;
          setSaveStatus("saved");
          setSavedAt(new Date());
          return;
        }
        if (r === "too_large") {
          setSaveStatus("error");
          setError("La sesion es demasiado grande. Inicia un chat nuevo para continuar.");
          return;
        }
        // "mismatch" or null → fall through to full upsert
      }

      const res = await apiUpsertSession(currentSessionId, activeTool.id, messages);
      if (res.ok) {
        lastSavedRef.current = serialized;
        syncedSeqRef.current = messages.length;
        setSaveStatus("saved");
        setSavedAt(new Date());
      } else {
        setSaveStatus("error");
        if (res.tooLarge) {
          setError("La sesion es demasiado grande. Inicia un chat nuevo para continuar.");
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [messages, activeTool, step, currentSessionId]);

  // ── Best-effort save on page unload ──────────────────────────────────────────
  useEffect(() => {
    if (!activeTool || step !== "chat") return;
    const handler = () => {
      const serialized = JSON.stringify(toStored(messages));
      if (serialized === lastSavedRef.current) return;
      beaconUpsertSession(currentSessionId, activeTool.id, messages);
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [messages, activeTool, step, currentSessionId]);

  // Reset save state when switching session
  useEffect(() => {
    lastSavedRef.current = "";
    syncedSeqRef.current = 0;
    setSaveStatus("idle");
    setSavedAt(null);
  }, [currentSessionId]);

  // ── Session helpers ───────────────────────────────────────────────────────────

  async function saveCurrentSession(tool: ToolDef, msgs: Message[], sessionId: string) {
    if (msgs.filter((m) => m.role === "user").length === 0) return;
    const res = await apiUpsertSession(sessionId, tool.id, msgs);
    if (res.ok) {
      lastSavedRef.current = JSON.stringify(toStored(msgs));
      syncedSeqRef.current = msgs.length;
      setSaveStatus("saved");
      setSavedAt(new Date());
    } else {
      setSaveStatus("error");
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  async function goBack() {
    if (activeTool) await saveCurrentSession(activeTool, messages, currentSessionId);
    setStep("dashboard");
    setActiveTool(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function startNewChat() {
    if (!activeTool) return;
    await saveCurrentSession(activeTool, messages, currentSessionId);
    setCurrentSessionId(genId());
    setMessages([
      {
        id: "init",
        role: "agent",
        content: activeTool.initialContent,
        options: activeTool.initialOptions,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setError(null);
  }

  async function openSessionsModal() {
    if (!activeTool) return;
    setSessionsModalOpen(true);
    setSessionsModalLoading(true);
    const { sessions } = await apiFetchSessions(activeTool.id);
    setSessionsModalData(sessions);
    setSessionsModalLoading(false);
  }

  async function loadSessionFromModal(session: SessionMeta) {
    if (!activeTool) return;
    // Save current session first
    await saveCurrentSession(activeTool, messages, currentSessionId);
    // Load the selected session
    try {
      const res = await fetch(`/api/mentoria/sessions/${session.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentSessionId(session.id);
      const loaded = fromStored(data.messages);
      setMessages(loaded);
      syncedSeqRef.current = typeof data.seq === "number" ? data.seq : loaded.length;
      lastSavedRef.current = JSON.stringify(toStored(loaded));
      setSessionsModalOpen(false);
      setError(null);
    } catch {
      setError("No se pudo cargar la sesion.");
    }
  }

  async function deleteSessionFromModal(id: string) {
    await apiDeleteSession(id);
    setSessionsModalData((prev) => prev.filter((s) => s.id !== id));
  }

  async function probe(): Promise<boolean> {
    try {
      const res = await fetch("/api/mentoria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (res.status === 401) throw new Error("Sesion expirada. Recarga la pagina.");
      if (!res.ok) throw new Error("No se pudo conectar con MentorIA.");
      return true;
    } catch (e: any) {
      setProbeError(e.message || "Error al conectar. Intenta de nuevo.");
      return false;
    }
  }

  async function selectTool(tool: ToolDef) {
    setProbeError(null);
    setProbingTool(tool.id);
    const ok = await probe();
    setProbingTool(null);
    if (!ok) return;
    setCurrentSessionId(genId());
    setActiveTool(tool);
    setStep("chat");
    setMessages([
      {
        id: "init",
        role: "agent",
        content: tool.initialContent,
        options: tool.initialOptions,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    // Fetch current progress for this subagent (fire-and-forget).
    (async () => {
      try {
        const r = await fetch(`/api/mentoria/progress?tool=${tool.id}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d?.ok && d.progress) {
          setProgress({
            currentLessonId: d.progress.currentLessonId,
            completed: d.progress.completed ?? [],
            totalLessons: d.progress.totalLessons,
            isComplete: !!d.progress.isComplete,
          });
        }
      } catch {}
    })();
  }

  async function openHistory(tool: ToolDef) {
    setHistoryTool(tool);
    setHistorySessions([]);
    setHistoryCursor(null);
    setHistoryHasMore(false);
    setHistoryLoading(true);
    setStep("history");
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(tool.id);
    setHistorySessions(sessions);
    setHistoryHasMore(hasMore);
    setHistoryCursor(nextCursor);
    setHistoryLoading(false);
  }

  async function loadMoreHistory() {
    if (!historyTool || !historyCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(historyTool.id, {
      before: historyCursor,
    });
    setHistorySessions((prev) => [...prev, ...sessions]);
    setHistoryHasMore(hasMore);
    setHistoryCursor(nextCursor);
    setHistoryLoadingMore(false);
  }

  async function renameHistorySession(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = await apiRenameSession(id, trimmed.slice(0, 200));
    if (ok) {
      setHistorySessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed.slice(0, 200) } : s))
      );
    }
  }

  async function loadSession(session: SessionMeta, tool: ToolDef) {
    setProbeError(null);
    setProbingTool(tool.id);
    const ok = await probe();
    setProbingTool(null);
    if (!ok) return;
    try {
      const res = await fetch(`/api/mentoria/sessions/${session.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveTool(tool);
      setCurrentSessionId(session.id);
      const loaded = fromStored(data.messages);
      setMessages(loaded);
      syncedSeqRef.current = typeof data.seq === "number" ? data.seq : loaded.length;
      lastSavedRef.current = JSON.stringify(toStored(loaded));
      setStep("chat");
      setError(null);
    } catch {
      setProbeError("No se pudo cargar la sesion. Intenta de nuevo.");
    }
  }

  async function deleteSession(id: string) {
    // Soft-delete: goes to trash, reversible.
    const ok = await apiDeleteSession(id, false);
    if (!ok) return;
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    if (historyTool) {
      setSessionCounts((prev) => ({
        ...prev,
        [historyTool.id]: Math.max(0, (prev[historyTool.id] ?? 1) - 1),
      }));
    }
  }

  async function loadTrash(tool: ToolDef) {
    setTrashLoading(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(tool.id, {
      trashed: true,
    });
    setTrashSessions(sessions);
    setTrashHasMore(hasMore);
    setTrashCursor(nextCursor);
    setTrashLoading(false);
  }

  async function loadMoreTrash() {
    if (!historyTool || !trashCursor || trashLoadingMore) return;
    setTrashLoadingMore(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(historyTool.id, {
      before: trashCursor,
      trashed: true,
    });
    setTrashSessions((prev) => [...prev, ...sessions]);
    setTrashHasMore(hasMore);
    setTrashCursor(nextCursor);
    setTrashLoadingMore(false);
  }

  async function restoreFromTrash(id: string) {
    const ok = await apiRestoreSession(id);
    if (!ok) return;
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    if (historyTool) {
      setSessionCounts((prev) => ({
        ...prev,
        [historyTool.id]: (prev[historyTool.id] ?? 0) + 1,
      }));
    }
  }

  async function permanentDelete(id: string) {
    const ok = await apiDeleteSession(id, true);
    if (!ok) return;
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    setConfirmPermanentId(null);
  }

  // ── Summary PDF ───────────────────────────────────────────────────────────────

  async function handleSummary() {
    if (!activeTool || summaryLoading) return;
    setSummaryLoading(true);
    setError(null);

    try {
      // Ensure the latest messages are persisted so the server reads fresh data.
      // Falls back to sending the messages inline if the save fails (offline, etc).
      const persisted = await apiUpsertSession(
        currentSessionId,
        activeTool.id,
        messages
      );
      if (persisted.ok) {
        lastSavedRef.current = JSON.stringify(toStored(messages));
        syncedSeqRef.current = messages.length;
        setSaveStatus("saved");
        setSavedAt(new Date());
      }

      const body = persisted.ok
        ? { sessionId: currentSessionId }
        : { tool: activeTool.id, messages: toStored(messages) };

      const res = await fetch("/api/mentoria/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo generar el resumen.");
      }
      await downloadSummaryPDF(activeTool.title, data.reply);
    } catch (e: any) {
      setError(e.message || "No se pudo generar el resumen.");
    } finally {
      setSummaryLoading(false);
    }
  }

  // ── handleSend ───────────────────────────────────────────────────────────────

  async function handleSend(text?: string) {
    const content = (text || input).trim();
    if (!content || !activeTool || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    // Pre-seed the agent bubble so tokens can stream into it
    const agentMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: agentMsgId,
        role: "agent",
        content: "",
        options: [],
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setLoading(true);
    setShowWarmup(false);
    setError(null);
    const warmupTimer = activeTool.provider === "nvidia_nim"
      ? setTimeout(() => setShowWarmup(true), 8_000)
      : null;

    const history = messages
      .filter((m) => m.id !== "init")
      .map((m) => ({
        role: m.role === "agent" ? ("model" as const) : ("user" as const),
        parts: m.content,
      }));

    try {
      const res = await fetch("/api/mentoria/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: activeTool.id, history, message: content }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const secs = data.retryAfter || 10;
        throw new Error(
          data.message || `Estas enviando mensajes muy rapido. Espera ${secs}s.`
        );
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error desconocido del servidor.");
      }

      // ── SSE consumer ──────────────────────────────────────────────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let currentEvent = "";
      let accumulatedReply = "";
      let finalOptions: string[] = [];
      let streamError: string | null = null;

      const applyLine = (line: string) => {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          try {
            const data = JSON.parse(payload);
            if (currentEvent === "delta" && typeof data.text === "string") {
              accumulatedReply += data.text;
              // Live update of the agent bubble
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: accumulatedReply } : m
                )
              );
            } else if (currentEvent === "done") {
              if (typeof data.reply === "string") accumulatedReply = data.reply;
              if (Array.isArray(data.options))
                finalOptions = data.options.map(String);
              // If the backend detected [AVANZAR] and advanced the progress,
              // update local state so the UI reflects the new lesson.
              if (data.advanced && typeof data.advanced === "object") {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentLessonId: Number(data.advanced.currentLessonId) || prev.currentLessonId,
                        completed: Array.isArray(data.advanced.completed)
                          ? data.advanced.completed
                          : prev.completed,
                        isComplete: !!data.advanced.isComplete,
                      }
                    : prev
                );
              }
            } else if (currentEvent === "error") {
              streamError = String(data.message || "Error de MentorIA.");
            }
          } catch {
            // ignore malformed chunks
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line (\n\n)
        let idx;
        while ((idx = sseBuffer.indexOf("\n\n")) !== -1) {
          const frame = sseBuffer.slice(0, idx);
          sseBuffer = sseBuffer.slice(idx + 2);
          frame.split("\n").forEach(applyLine);
          currentEvent = "";
        }
      }

      if (streamError) throw new Error(streamError);

      // Final apply with options + canonical reply
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content: accumulatedReply || m.content,
                options: finalOptions,
              }
            : m
        )
      );
    } catch (e: any) {
      // Roll back the empty agent bubble on error
      setMessages((prev) => prev.filter((m) => m.id !== agentMsgId));
      setError(e.message || "Error de conexion. Intenta de nuevo.");
    } finally {
      if (warmupTimer) clearTimeout(warmupTimer);
      setShowWarmup(false);
      setLoading(false);
    }
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  if (step === "dashboard") {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 flex flex-col items-center">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://nl360.site/wp-content/uploads/2026/01/MentorIA-Next-Level-Logo.png"
              alt="MentorIA Logo"
              className="h-14 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20">
              <BookOpen className="size-4 text-sky-400" />
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Hola, soy <span className="text-sky-400">MentorIA</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              Tu asistente de aprendizaje. Juntos exploraremos cursos exclusivos y
              llevaremos tu carrera al siguiente nivel.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              ¿En que mentoria nos enfocaremos hoy?
            </p>
          </div>

          {/* Tool cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10">
            {availableTools.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Cargando mentores...
              </div>
            )}
            {availableTools.map((tool) => {
              const TIcon = tool.Icon;
              const isProbing = probingTool === tool.id;
              const isDisabled = !!probingTool;
              const count = sessionCounts[tool.id] ?? 0;
              const moreCount = sessionHasMore[tool.id] ?? false;
              const meta = agentMeta[tool.id];
              const needsConfirm = !!meta?.requiresConfirmation;
              return (
                <div
                  key={tool.id}
                  className="group relative text-left rounded-xl border border-border bg-card/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-card hover:border-sky-500/50 hover:shadow-[0_0_24px_rgba(14,165,233,0.18)]"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 group-hover:bg-sky-500/30 transition-all">
                    {isProbing ? <Loader2 className="size-4 animate-spin" /> : <TIcon className="size-4" />}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{tool.description}</p>

                  {count > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-0.5">
                        <History className="size-2.5" />
                        {count}{moreCount ? "+" : ""} {count === 1 ? "chat" : "chats"}
                      </span>
                      <button
                        onClick={() => !isDisabled && openHistory(tool)}
                        disabled={isDisabled}
                        className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground hover:text-sky-400 transition-colors disabled:opacity-40"
                      >
                        Ver historial
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (isDisabled) return;
                      if (needsConfirm && meta) {
                        setConfirmDisruptive(meta);
                      } else {
                        selectTool(tool);
                      }
                    }}
                    disabled={isDisabled}
                    className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 disabled:opacity-40"
                  >
                    {isProbing ? "Conectando..." : needsConfirm ? "Entrar" : "Comenzar"}
                    {!isProbing && <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>}
                  </button>
                  {needsConfirm && (
                    <div className="mt-2 text-[9px] font-bold uppercase tracking-wide text-amber-400/80">
                      Sin filtros
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {probeError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive w-full">
              <span>{probeError}</span>
              <button onClick={() => setProbeError(null)}><X className="size-4" /></button>
            </div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <BookOpen className="size-3 text-sky-400" />
            Estamos entrenando MentorIA con nuevos cursos
          </div>
        </div>

        {/* Disruptive (uncensored) confirmation modal */}
        {confirmDisruptive && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDisruptive(null)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md rounded-xl border border-amber-500/40 bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-5 text-amber-400" />
                <span className="text-sm font-bold uppercase tracking-widest text-amber-400">
                  Entrada al modo sin filtros
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {confirmDisruptive.title}
                {confirmDisruptive.subtitle ? ` — ${confirmDisruptive.subtitle}` : ""}
              </h3>
              {confirmDisruptive.disclaimer && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {confirmDisruptive.disclaimer}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDisruptive(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const def = summaryToToolDef(confirmDisruptive);
                    setConfirmDisruptive(null);
                    selectTool(def);
                  }}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black"
                >
                  Entiendo, entrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Neville version selector ─────────────────────────────────────────────────

  if (step === "neville-select") {
    const neville1 = availableTools.find((t) => t.id === "NEVILLE_DISRUPTIVO_1");
    const neville2Meta = agentMeta["NEVILLE_DISRUPTIVO_2"];
    const neville2Tool = availableTools.find((t) => t.id === "NEVILLE_DISRUPTIVO_2");

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button
            onClick={() => setStep("dashboard")}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Volver
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20">
              <Eye className="size-3.5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">Neville</span>
          </div>
        </div>

        {/* Selector */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="mb-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 mb-3">
                <Eye className="size-6 text-sky-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">¿Con qué versión de Neville quieres trabajar?</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                La enseñanza es la misma. Solo cambia el tono con el que Neville te habla.
              </p>
            </div>

            <div className="space-y-3">
              {/* Versión Reflexiva */}
              <button
                onClick={() => neville1 && selectTool(neville1)}
                disabled={!!probingTool}
                className="w-full text-left rounded-xl border border-border bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:bg-card hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 mt-0.5">
                    {probingTool === "NEVILLE_DISRUPTIVO_1" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">Versión Reflexiva</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400/70">Claude</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pausado, profundo, poético pero claro. Guía con metáforas y calma hacia la ley del ser.
                    </p>
                  </div>
                </div>
              </button>

              {/* Sin Filtros */}
              <button
                onClick={() => neville2Meta && setConfirmDisruptive(neville2Meta)}
                disabled={!!probingTool}
                className="w-full text-left rounded-xl border border-amber-500/30 bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:bg-card hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <Flame className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">Sin Filtros</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Venice AI</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Directo, crudo, sin eufemismos. La misma ley dicha de frente, sin adornos ni disclaimers.
                    </p>
                    <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
                      Aviso de seguridad requerido
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {probeError && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span>{probeError}</span>
                <button onClick={() => setProbeError(null)}><X className="size-4" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Security confirmation modal */}
        {confirmDisruptive && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDisruptive(null)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md rounded-xl border border-amber-500/40 bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-5 text-amber-400" />
                <span className="text-sm font-bold uppercase tracking-widest text-amber-400">
                  Aviso de seguridad
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {confirmDisruptive.title}
                {confirmDisruptive.subtitle ? ` — ${confirmDisruptive.subtitle}` : ""}
              </h3>
              {confirmDisruptive.disclaimer && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {confirmDisruptive.disclaimer}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDisruptive(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const def = neville2Tool ? neville2Tool : summaryToToolDef(confirmDisruptive);
                    setConfirmDisruptive(null);
                    selectTool(def);
                  }}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black"
                >
                  Entiendo, entrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── History view ─────────────────────────────────────────────────────────────

  if (step === "history" && historyTool) {
    const HTIcon = historyTool.Icon;
    return (
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setStep("dashboard")}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Volver
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20">
                <HTIcon className="size-3.5 text-sky-400" />
              </div>
              <span className="text-sm font-semibold text-foreground">{historyTool.title}</span>
            </div>
            <button
              onClick={() => selectTool(historyTool)}
              disabled={!!probingTool}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all"
            >
              {probingTool ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquarePlus className="size-3.5" />}
              Nuevo chat
            </button>
          </div>

          <h2 className="text-base font-bold text-foreground mb-1">Historial de conversaciones</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {historyView === "active" ? (
              <>
                {historySessions.length}
                {historyHasMore ? "+" : ""}{" "}
                {historySessions.length === 1 ? "conversacion guardada" : "conversaciones guardadas"}
              </>
            ) : (
              <>Los chats en la papelera se borran automaticamente tras 30 dias.</>
            )}
          </p>

          {/* Toggle activo / papelera */}
          <div className="mb-4 inline-flex rounded-lg border border-border bg-card/60 p-1 text-[11px] font-bold uppercase tracking-wide">
            <button
              onClick={() => setHistoryView("active")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                historyView === "active"
                  ? "bg-sky-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activos
            </button>
            <button
              onClick={async () => {
                setHistoryView("trash");
                if (historyTool) await loadTrash(historyTool);
              }}
              className={`rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                historyView === "trash"
                  ? "bg-sky-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trash2 className="size-3" />
              Papelera
            </button>
          </div>

          {/* Search box — solo en vista activa */}
          {historyView === "active" && (
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar en ${historyTool.title}...`}
                maxLength={100}
                className="w-full rounded-lg border border-border bg-card/60 pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {probeError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>{probeError}</span>
              <button onClick={() => setProbeError(null)}><X className="size-4" /></button>
            </div>
          )}

          {historyLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : historyView === "active" && searchQuery.trim().length >= 2 ? (
            // Search results view
            searchLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin resultados para &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground mb-1">
                  {searchResults.length} resultado{searchResults.length === 1 ? "" : "s"}
                </p>
                {searchResults.map((hit) => (
                  <button
                    key={`${hit.sessionId}-${hit.seq}`}
                    onClick={async () => {
                      // Load the matching session
                      const fake: SessionMeta = {
                        id: hit.sessionId,
                        title: hit.title,
                        message_count: 0,
                        updated_at: hit.updatedAt,
                      };
                      await loadSession(fake, historyTool);
                    }}
                    className="text-left rounded-xl border border-border bg-card/60 p-4 hover:border-sky-500/40 transition-colors"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{hit.title}</p>
                    <div className="flex items-center gap-3 mt-1 mb-2">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" />{formatDate(hit.updatedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {hit.role === "user" ? "Alumno" : "MentorIA"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{hit.snippet}</p>
                  </button>
                ))}
              </div>
            )
          ) : historyView === "active" && historySessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay conversaciones guardadas aun.</p>
            </div>
          ) : historyView === "trash" ? (
            trashLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : trashSessions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Trash2 className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">La papelera esta vacia.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {trashSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-border bg-card/30 p-4 flex items-center justify-between gap-4 opacity-80"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate line-through decoration-muted-foreground/50">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" />{formatDate(session.updated_at)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{session.message_count} mensajes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => restoreFromTrash(session.id)}
                        className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all"
                      >
                        Restaurar
                      </button>
                      {confirmPermanentId === session.id ? (
                        <>
                          <button
                            onClick={() => permanentDelete(session.id)}
                            className="rounded-lg bg-destructive hover:bg-destructive/80 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmPermanentId(null)}
                            className="rounded-lg border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmPermanentId(session.id)}
                          title="Eliminar definitivamente"
                          className="rounded-lg border border-border bg-transparent hover:bg-destructive/10 hover:border-destructive/40 text-muted-foreground hover:text-destructive p-1.5 transition-all"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {trashHasMore && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={loadMoreTrash}
                      disabled={trashLoadingMore}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card/60 hover:border-sky-500/40 hover:bg-card text-muted-foreground hover:text-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                    >
                      {trashLoadingMore ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <History className="size-3.5" />
                      )}
                      Cargar mas
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {historySessions.map((session) => {
                const isRenaming = renamingId === session.id;
                return (
                  <div
                    key={session.id}
                    className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between gap-4 hover:border-sky-500/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              await renameHistorySession(session.id, renameValue);
                              setRenamingId(null);
                            } else if (e.key === "Escape") {
                              setRenamingId(null);
                            }
                          }}
                          onBlur={async () => {
                            await renameHistorySession(session.id, renameValue);
                            setRenamingId(null);
                          }}
                          maxLength={200}
                          className="w-full bg-background border border-sky-500/40 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-sky-500"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground truncate">{session.title}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" />{formatDate(session.updated_at)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{session.message_count} mensajes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setRenamingId(session.id);
                          setRenameValue(session.title);
                        }}
                        title="Renombrar"
                        className="rounded-lg border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground p-1.5 transition-all"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => downloadSessionExport(session.id, "md")}
                        title="Descargar Markdown"
                        className="rounded-lg border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground p-1.5 transition-all"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          setShareModal({
                            status: "loading",
                            sessionId: session.id,
                            title: session.title,
                          });
                          const result = await createShareLink(session.id);
                          if ("error" in result) {
                            setShareModal({
                              status: "error",
                              sessionId: session.id,
                              title: session.title,
                              message:
                                result.error === "not_found"
                                  ? "La sesion no existe o fue eliminada."
                                  : "No se pudo generar el enlace. Intenta de nuevo.",
                            });
                          } else {
                            setShareModal({
                              status: "ready",
                              sessionId: session.id,
                              title: session.title,
                              url: result.url,
                              copied: false,
                              ttlDays: result.ttlDays,
                            });
                          }
                        }}
                        title="Compartir (link publico)"
                        className="rounded-lg border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground p-1.5 transition-all"
                      >
                        <Share2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => loadSession(session, historyTool)}
                        disabled={!!probingTool}
                        className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all min-w-[80px] flex items-center justify-center"
                      >
                        {probingTool ? <Loader2 className="size-3 animate-spin" /> : "Continuar"}
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="rounded-lg border border-border bg-transparent hover:bg-destructive/10 hover:border-destructive/40 text-muted-foreground hover:text-destructive p-1.5 transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {historyHasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={loadMoreHistory}
                    disabled={historyLoadingMore}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card/60 hover:border-sky-500/40 hover:bg-card text-muted-foreground hover:text-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                  >
                    {historyLoadingMore ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <History className="size-3.5" />
                    )}
                    Cargar mas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Share modal */}
        {shareModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShareModal(null)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Compartir sesion</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-[22rem]">
                    {shareModal.title}
                  </p>
                </div>
                <button
                  onClick={() => setShareModal(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  title="Cerrar"
                >
                  <X className="size-4" />
                </button>
              </div>

              {shareModal.status === "loading" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" /> Generando enlace...
                </div>
              )}

              {shareModal.status === "error" && (
                <p className="text-sm text-destructive py-4">{shareModal.message}</p>
              )}

              {shareModal.status === "ready" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Enlace publico de solo lectura. Cualquiera con el link puede ver la
                    conversacion. Expira en {shareModal.ttlDays} dias.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareModal.url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(shareModal.url);
                        if (ok) setShareModal({ ...shareModal, copied: true });
                      }}
                      className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wide px-3 py-2 transition whitespace-nowrap"
                    >
                      {shareModal.copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <a
                      href={shareModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Abrir en nueva pestana
                    </a>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/mentoria/sessions/${shareModal.sessionId}/share`,
                            { method: "DELETE" }
                          );
                          if (res.ok) setShareModal(null);
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition"
                    >
                      Revocar todos los enlaces
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Chat view (Manu Dev style) ────────────────────────────────────────────────

  const ActiveIcon = activeTool?.Icon || BookOpen;

  return (
    <>
      {/* Notes modal */}
      <NotesModal
        open={notesOpen}
        notes={notes}
        onChange={setNotes}
        onClose={() => setNotesOpen(false)}
      />

      {/* Sessions modal */}
      <SessionsModal
        open={sessionsModalOpen}
        sessions={sessionsModalData}
        loading={sessionsModalLoading}
        tool={activeTool}
        onLoad={loadSessionFromModal}
        onDelete={deleteSessionFromModal}
        onClose={() => setSessionsModalOpen(false)}
      />

      <div className="flex h-full flex-col bg-background">
        {/* ── Header ── */}
        <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex-shrink-0">
          <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-2">
            {/* Left: Back + icon + title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={goBack}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/20">
                <ActiveIcon className="size-3.5 text-sky-400" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">
                {activeTool?.title}
              </span>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Sesiones */}
              <button
                onClick={openSessionsModal}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <History className="size-3.5" />
                <span className="hidden sm:inline">Sesiones</span>
              </button>

              {/* Notas */}
              <button
                onClick={() => setNotesOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <NotebookPen className="size-3.5" />
                <span className="hidden sm:inline">Notas</span>
              </button>

              {/* Resumen */}
              <button
                onClick={handleSummary}
                disabled={summaryLoading || messages.filter(m => m.role === "user").length === 0}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                {summaryLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileDown className="size-3.5" />
                )}
                <span className="hidden sm:inline">Resumen</span>
              </button>

              {/* Nuevo */}
              <button
                onClick={startNewChat}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>

              {/* Divider + provider badge */}
              <div className="h-4 w-px bg-border mx-1" />
              <SaveStatusIndicator status={saveStatus} savedAt={savedAt} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-sky-500 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-0.5">
                MentorIA
              </span>
            </div>
          </div>
          {/* Progress bar (current lesson + completion ratio) */}
          {progress && progress.totalLessons > 0 && (
            <div className="mx-auto w-full max-w-3xl mt-2 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((progress.completed.length + (progress.isComplete ? 0 : 0)) /
                          progress.totalLessons) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                {progress.isComplete
                  ? "Completado"
                  : `Leccion ${progress.currentLessonId} de ${progress.totalLessons}`}
              </span>
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Gradient fade at top */}
          <div className="pointer-events-none sticky top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent" />
          <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 pb-6 space-y-5 -mt-8 pt-4">
            {/* Error banner */}
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span>{error}</span>
                <button onClick={() => setError(null)}><X className="size-4" /></button>
              </div>
            )}

            {/* Size warning banner */}
            {messages.length >= SESSION_MSG_WARN_THRESHOLD && !sizeWarnDismissed && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                <span>
                  Esta conversacion ya tiene {messages.length} mensajes. Considera iniciar un chat nuevo para mejor rendimiento.
                </span>
                <button onClick={() => setSizeWarnDismissed(true)}><X className="size-4" /></button>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onButtonClick={(t) => handleSend(t)}
              />
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex justify-start">
                  <div className="text-foreground px-1 flex gap-1.5 items-center py-2">
                    <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                    <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:100ms]" />
                    <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:200ms]" />
                  </div>
                </div>
                {showWarmup && (
                  <p className="px-1 text-xs text-muted-foreground">
                    El primer mensaje a Tony puede tardar hasta un minuto (el modelo se está calentando). Aguardá...
                  </p>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Input area ── */}
        <div className="flex-shrink-0 border-t border-border bg-background px-2 sm:px-4 py-2 sm:py-3">
          <div className="mx-auto w-full max-w-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-1.5 sm:gap-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pregunta a MentorIA..."
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-lg sm:rounded-xl border border-border bg-muted px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 min-h-[36px] sm:min-h-[42px] max-h-[120px]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                onPointerDown={() => { inputBtnPressed.current = true; }}
                onPointerUp={() => { inputBtnPressed.current = false; }}
                className="flex h-9 w-9 sm:h-[42px] sm:w-[42px] flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 transition-all duration-150 active:scale-90"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
