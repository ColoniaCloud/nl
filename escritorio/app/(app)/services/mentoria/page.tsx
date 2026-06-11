"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
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
  Check,
  CloudOff,
  Pencil,
  Search,
  Download,
  Share2,
} from "lucide-react";
import type {
  Step,
  Message,
  SessionMeta,
  ToolDef,
  AgentSummary,
} from "@/hooks/mentoria/types";
import {
  formatDate,
  downloadSessionExport,
  createShareLink,
  copyToClipboard,
  apiFetchNotes,
  apiSaveNotes,
  apiDeleteSession,
} from "@/hooks/mentoria/api";
import { useMentoriaSession } from "@/hooks/mentoria/useMentoriaSession";
import { useMentoriaHistory } from "@/hooks/mentoria/useMentoriaHistory";
import { useMentoriaProgress } from "@/hooks/mentoria/useMentoriaProgress";
import AgentInput from "@/components/chat/AgentInput";
import VoiceMicButton from "@/components/chat/VoiceMicButton";

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

// ─── Tool definitions ─────────────────────────────────────────────────────────

// Soft warning threshold — when reached, we suggest starting a new chat.
const SESSION_MSG_WARN_THRESHOLD = 100;

function summaryToToolDef(a: AgentSummary): ToolDef {
  const Icon = iconFor(a.icon);
  return {
    id: a.id,
    title: a.subtitle ? `${a.title} — ${a.subtitle}` : a.title,
    description: a.description,
    Icon,
    initialContent: a.welcome.content,
    initialOptions: a.welcome.options,
    provider: a.provider,
  };
}

/* Legacy TOOLS reference — superseded by the dynamic list from the API. */
const _LEGACY_TOOLS = [
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
            aria-label="Cerrar notas"
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
          <span className="text-2xs text-muted-foreground">
            Guardado automaticamente
          </span>
          <button
            onClick={() => onChange("")}
            className="text-2xs font-bold uppercase text-muted-foreground hover:text-destructive transition-colors"
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
            aria-label="Cerrar sesiones"
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
                      <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Clock className="size-2.5" />
                        {formatDate(session.updated_at)}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {session.message_count} msg
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onLoad(session)}
                      className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 text-xxs font-bold uppercase tracking-wide transition-all"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      aria-label="Eliminar sesión"
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

// ─── ConfirmDeleteModal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="size-5 text-destructive" />
          <span className="text-sm font-bold text-foreground">Eliminar conversación</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          ¿Eliminar{" "}
          <span className="font-semibold text-foreground">"{title}"</span>
          ? La conversación se moverá a la papelera.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-destructive hover:bg-destructive/80 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
          >
            Eliminar
          </button>
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
                    className="border border-sky-500/40 bg-sky-500/10 text-sky-400 px-3 py-1.5 rounded-full text-xxs font-semibold uppercase tracking-wide transition-all hover:bg-sky-600 hover:text-white hover:border-sky-600 active:scale-95"
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
        className="flex items-center gap-1 text-2xs font-medium text-muted-foreground px-1.5"
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
        className="flex items-center gap-1 text-2xs font-medium text-destructive px-1.5"
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
      className="flex items-center gap-1 text-2xs font-medium text-emerald-500 px-1.5"
    >
      <Check className="size-3" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Mentor definitions (the 3 personas shown on the dashboard) ──────────────
const MENTORS = [
  {
    key: "napoleon",
    name: "Napoleón Hill",
    image: "/agentes/Napoleon.png",
    primaryId: "NAPOLEON",
    disruptiveId: null as string | null,
  },
  {
    key: "neville",
    name: "Neville Goddard",
    image: "/agentes/Neville.png",
    primaryId: "NEVILLE_DISRUPTIVO_1",
    disruptiveId: "NEVILLE_DISRUPTIVO_2",
  },
  {
    key: "tony",
    name: "Tony Robbins",
    image: "/agentes/Tony.png",
    primaryId: "TONY_PROFUNDO",
    disruptiveId: "TONY_DISRUPTIVO",
  },
] as const;

export default function MentoriaPage() {
  // ── Page-level state (navigation + shared agent registry) ────────────────────
  const [step, setStep] = useState<Step>("dashboard");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [availableTools, setAvailableTools] = useState<ToolDef[]>([]);
  const [agentMeta, setAgentMeta] = useState<Record<string, AgentSummary>>({});
  const [confirmDisruptive, setConfirmDisruptive] = useState<AgentSummary | null>(null);
  const [pendingAutoAgent, setPendingAutoAgent] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [recentSessions, setRecentSessions] = useState<Array<{ id: string; title: string; updated_at: string; agentId: string; agentName: string }>>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<{ id: string; title: string; onConfirm: () => Promise<void> } | null>(null);

  // ── Extracted hooks ──────────────────────────────────────────────────────────
  const {
    sessionCounts,
    sessionHasMore,
    dashboardProgress,
    progressLoading,
    refreshCounts,
    refreshProgress,
    adjustSessionCount,
  } = useMentoriaProgress({ availableTools });

  const {
    historyTool,
    historySessions,
    historyLoading,
    historyHasMore,
    historyLoadingMore,
    renamingId,
    renameValue,
    historyView,
    trashSessions,
    trashLoading,
    trashHasMore,
    trashLoadingMore,
    confirmPermanentId,
    searchQuery,
    searchResults,
    searchLoading,
    shareModal,
    setRenamingId,
    setRenameValue,
    setHistoryView,
    setConfirmPermanentId,
    setSearchQuery,
    setShareModal,
    openHistory,
    loadMoreHistory,
    renameHistorySession,
    deleteSession,
    loadTrash,
    loadMoreTrash,
    restoreFromTrash,
    permanentDelete,
  } = useMentoriaHistory({ setStep, onCountChange: adjustSessionCount });

  const {
    activeTool,
    messages,
    currentSessionId,
    input,
    loading,
    showWarmup,
    summaryLoading,
    error,
    probingTool,
    probeError,
    sizeWarnDismissed,
    progress,
    saveStatus,
    savedAt,
    sessionsModalOpen,
    sessionsModalData,
    sessionsModalLoading,
    chatEndRef,
    inputBtnPressed,
    setInput,
    setError,
    setProbeError,
    setSizeWarnDismissed,
    setSessionsModalOpen,
    goBack,
    startNewChat,
    openSessionsModal,
    loadSessionFromModal,
    deleteSessionFromModal,
    selectTool,
    loadSession,
    handleSummary,
    handleSend,
  } = useMentoriaSession({ step, setStep });

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
    if (step === "dashboard") {
      refreshCounts();
      refreshProgress();
    }
  }, [step, refreshCounts, refreshProgress]);

  // Fetch username once on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const name = d?.user?.display_name || d?.user?.name || d?.display_name || "";
        if (name) setUsername(name.split(" ")[0]);
      })
      .catch(() => {});
  }, []);

  // Fetch recent sessions across all agents when dashboard opens
  useEffect(() => {
    if (step !== "dashboard") return;
    setRecentLoading(true);
    const allIds = MENTORS.flatMap((m) => m.disruptiveId ? [m.primaryId, m.disruptiveId] : [m.primaryId]);
    const mentorNameByToolId: Record<string, string> = {};
    MENTORS.forEach((m) => {
      mentorNameByToolId[m.primaryId] = m.name;
      if (m.disruptiveId) mentorNameByToolId[m.disruptiveId] = m.name;
    });

    Promise.all(
      allIds.map((id) =>
        fetch(`/api/mentoria/sessions?tool=${id}&limit=5`)
          .then((r) => r.ok ? r.json() : { sessions: [] })
          .then((d) => (d.sessions || []).map((s: SessionMeta) => ({
            id: s.id,
            title: s.title,
            updated_at: s.updated_at,
            agentId: id,
            agentName: mentorNameByToolId[id] || id,
          })))
          .catch(() => [])
      )
    ).then((groups) => {
      const flat = groups.flat().sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setRecentSessions(flat.slice(0, 12));
    }).finally(() => setRecentLoading(false));
  }, [step]);

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
    if (false) {
      // neville-select removed
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

  // ── Dashboard ────────────────────────────────────────────────────────────────

  if (step === "dashboard") {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">

          {/* ── Greeting ── */}
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5">
              Hola{username ? ` ${username}` : ""},{" "}
              <span className="text-sky-400">bienvenido/a a MentorIA.</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              El camino del éxito es la constancia, ¿con quién quieres charlar hoy?
            </p>
          </div>

          {/* ── Mentor cards ── */}
          {availableTools.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <Loader2 className="size-4 animate-spin" />
              Cargando mentores...
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-12">
              {MENTORS.map((mentor) => {
                const primaryTool = availableTools.find((t) => t.id === mentor.primaryId);
                if (!primaryTool) return null;
                const isProbing = probingTool === mentor.primaryId || probingTool === mentor.disruptiveId;
                const isDisabled = !!probingTool;
                const totalSessions =
                  (sessionCounts[mentor.primaryId] ?? 0) +
                  (mentor.disruptiveId ? (sessionCounts[mentor.disruptiveId] ?? 0) : 0);
                const hasSession = totalSessions > 0;
                const progress1 = dashboardProgress[mentor.primaryId];
                const progress2 = mentor.disruptiveId ? dashboardProgress[mentor.disruptiveId] : null;
                const hasProgress = !!(
                  (progress1 && (progress1.completed > 0 || progress1.isComplete)) ||
                  (progress2 && (progress2.completed > 0 || progress2.isComplete))
                );
                return (
                  <div key={mentor.key} className="flex flex-col items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className={[
                        "w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden transition-all duration-300",
                        hasProgress
                          ? "ring-[3px] ring-sky-400 ring-offset-2 ring-offset-background"
                          : "ring-1 ring-border",
                      ].join(" ")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mentor.image}
                          alt={mentor.name}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: "50% 15%" }}
                        />
                      </div>
                      <div className="absolute bottom-0 right-0 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-sky-500 border-2 border-background shadow">
                        <Check className="size-2.5 sm:size-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                    {/* Name */}
                    <p className="text-xs sm:text-sm font-semibold text-foreground text-center leading-tight">
                      {mentor.name}
                    </p>
                    {/* CTA */}
                    <button
                      onClick={() => { if (!isDisabled) selectTool(primaryTool); }}
                      disabled={isDisabled}
                      className={[
                        "w-full rounded-xl px-2 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50",
                        hasSession
                          ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_2px_8px_rgba(56,189,248,0.35)] hover:from-sky-300 hover:to-sky-500"
                          : "bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.4)] hover:from-zinc-700 hover:to-zinc-800",
                      ].join(" ")}
                    >
                      {isProbing ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" /> Conectando...
                        </span>
                      ) : hasSession ? "Continuar mentoría" : "Iniciar mentoría"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {probeError && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>{probeError}</span>
              <button aria-label="Cerrar" onClick={() => setProbeError(null)}><X className="size-4" /></button>
            </div>
          )}

          {/* ── Divider ── */}
          <div className="border-t border-border mb-8" />

          {/* ── Recent conversations ── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Conversaciones recientes
            </h3>
            {recentLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <History className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Todavía no hay conversaciones guardadas.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSessions.map((session) => {
                  const mentor = MENTORS.find(
                    (m) => m.primaryId === session.agentId || m.disruptiveId === session.agentId
                  );
                  const tool = availableTools.find((t) => t.id === session.agentId);
                  return (
                    <div
                      key={`${session.id}-${session.agentId}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 hover:border-sky-500/40 hover:bg-card/70 transition-all group"
                    >
                      {/* Clickable area */}
                      <button
                        onClick={() => tool && loadSession(
                          { id: session.id, title: session.title, updated_at: session.updated_at, message_count: 0 },
                          tool
                        )}
                        disabled={!!probingTool}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-50"
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden ring-1 ring-border">
                          {mentor && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mentor.image} alt={mentor.name} className="w-full h-full object-cover" style={{ objectPosition: "50% 15%" }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate font-medium">{session.title}</p>
                          <span className="flex items-center gap-1 text-2xs text-muted-foreground mt-0.5">
                            <Clock className="size-2.5" />{formatDate(session.updated_at)}
                          </span>
                        </div>
                        <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-0.5">
                          {mentor?.name.split(" ")[0] ?? session.agentName}
                        </span>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteSession({
                            id: session.id,
                            title: session.title,
                            onConfirm: async () => {
                              await apiDeleteSession(session.id);
                              setRecentSessions((prev) =>
                                prev.filter((s) => !(s.id === session.id && s.agentId === session.agentId))
                              );
                              setConfirmDeleteSession(null);
                            },
                          });
                        }}
                        title="Eliminar conversación"
                        className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Delete confirmation modal ── */}
        {confirmDeleteSession && (
          <ConfirmDeleteModal
            title={confirmDeleteSession.title}
            onConfirm={confirmDeleteSession.onConfirm}
            onCancel={() => setConfirmDeleteSession(null)}
          />
        )}

        {/* ── Disruptive confirmation modal ── */}
        {confirmDisruptive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDisruptive(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-xl border border-amber-500/40 bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-5 text-amber-400" />
                <span className="text-sm font-bold uppercase tracking-widest text-amber-400">Modo sin filtros</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {confirmDisruptive.title}{confirmDisruptive.subtitle ? ` — ${confirmDisruptive.subtitle}` : ""}
              </h3>
              {confirmDisruptive.disclaimer && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{confirmDisruptive.disclaimer}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDisruptive(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
                <button
                  onClick={() => { const def = summaryToToolDef(confirmDisruptive); setConfirmDisruptive(null); selectTool(def); }}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black"
                >Entiendo, entrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // (neville-select step removed — version toggle moved inside chat input)
  // ──────────────────────────────────────────────────────────────────────────
  // Old neville-select block intentionally deleted; disruptive toggle is now
  // rendered inline in the chat input area below.
  // ──────────────────────────────────────────────────────────────────────────
  if (step === ("neville-select" as any)) {
    // Fallback: if somehow landed here, redirect to dashboard
    setStep("dashboard");
    return null;
  }

  // neville-select removed — disruptive toggle lives in chat input now

  if (false as boolean && step === "neville-select") {
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
                className="w-full text-left rounded-xl border border-border bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:bg-card hover:border-sky-500/50 hover:shadow-[var(--glow-sky-sm)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <span className="text-2xs font-bold uppercase tracking-widest text-sky-400/70">Claude</span>
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
                className="w-full text-left rounded-xl border border-amber-500/30 bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:bg-card hover:border-amber-500/60 hover:shadow-[var(--glow-amber)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <Flame className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">Sin Filtros</span>
                      <span className="text-2xs font-bold uppercase tracking-widest text-amber-400/70">Venice AI</span>
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
                <button aria-label="Cerrar" onClick={() => setProbeError(null)}><X className="size-4" /></button>
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
          <div className="mb-4 inline-flex rounded-lg border border-border bg-card/60 p-1 text-xxs font-bold uppercase tracking-wide">
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
                  aria-label="Limpiar búsqueda"
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
              <button aria-label="Cerrar" onClick={() => setProbeError(null)}><X className="size-4" /></button>
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
                <p className="text-xxs text-muted-foreground mb-1">
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
                      <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Clock className="size-3" />{formatDate(hit.updatedAt)}
                      </span>
                      <span className="text-2xs text-muted-foreground">
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
                        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <Clock className="size-3" />{formatDate(session.updated_at)}
                        </span>
                        <span className="text-2xs text-muted-foreground">{session.message_count} mensajes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => restoreFromTrash(session.id)}
                        className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xxs font-bold uppercase tracking-wide transition-all"
                      >
                        Restaurar
                      </button>
                      {confirmPermanentId === session.id ? (
                        <>
                          <button
                            onClick={() => permanentDelete(session.id)}
                            className="rounded-lg bg-destructive hover:bg-destructive/80 text-white px-3 py-1.5 text-xxs font-bold uppercase tracking-wide transition-all"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmPermanentId(null)}
                            className="rounded-lg border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 text-xxs font-bold uppercase tracking-wide transition-all"
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
                      className="flex items-center gap-2 rounded-lg border border-border bg-card/60 hover:border-sky-500/40 hover:bg-card text-muted-foreground hover:text-foreground px-4 py-2 text-xxs font-bold uppercase tracking-wide transition-all disabled:opacity-50"
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
                        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <Clock className="size-3" />{formatDate(session.updated_at)}
                        </span>
                        <span className="text-2xs text-muted-foreground">{session.message_count} mensajes</span>
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
                        className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-1.5 text-xxs font-bold uppercase tracking-wide transition-all min-w-[80px] flex items-center justify-center"
                      >
                        {probingTool ? <Loader2 className="size-3 animate-spin" /> : "Continuar"}
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        aria-label="Eliminar sesión"
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
                    className="flex items-center gap-2 rounded-lg border border-border bg-card/60 hover:border-sky-500/40 hover:bg-card text-muted-foreground hover:text-foreground px-4 py-2 text-xxs font-bold uppercase tracking-wide transition-all disabled:opacity-50"
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

      {/* Delete confirmation modal */}
      {confirmDeleteSession && (
        <ConfirmDeleteModal
          title={confirmDeleteSession.title}
          onConfirm={confirmDeleteSession.onConfirm}
          onCancel={() => setConfirmDeleteSession(null)}
        />
      )}

      <div className="flex h-full flex-col bg-background">
        {/* ── Header ── */}
        <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex-shrink-0">
          <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-2">
            {/* Left: Back + icon + title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={goBack}
                aria-label="Volver al dashboard"
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
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xxs font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <History className="size-3.5" />
                <span className="hidden sm:inline">Sesiones</span>
              </button>

              {/* Notas */}
              <button
                onClick={() => setNotesOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xxs font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <NotebookPen className="size-3.5" />
                <span className="hidden sm:inline">Notas</span>
              </button>

              {/* Resumen */}
              <button
                onClick={handleSummary}
                disabled={summaryLoading || messages.filter(m => m.role === "user").length === 0}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xxs font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
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
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xxs font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>

              {/* Eliminar sesión actual */}
              <button
                onClick={() => setConfirmDeleteSession({
                  id: currentSessionId,
                  title: activeTool?.title ?? "esta conversación",
                  onConfirm: async () => {
                    await apiDeleteSession(currentSessionId);
                    setConfirmDeleteSession(null);
                    goBack();
                  },
                })}
                title="Eliminar esta conversación"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xxs font-bold uppercase tracking-wide text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Eliminar</span>
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
              <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
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
                <button aria-label="Cerrar" onClick={() => setError(null)}><X className="size-4" /></button>
              </div>
            )}

            {/* Size warning banner */}
            {messages.length >= SESSION_MSG_WARN_THRESHOLD && !sizeWarnDismissed && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                <span>
                  Esta conversacion ya tiene {messages.length} mensajes. Considera iniciar un chat nuevo para mejor rendimiento.
                </span>
                <button aria-label="Cerrar aviso" onClick={() => setSizeWarnDismissed(true)}><X className="size-4" /></button>
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
        <div className="flex-shrink-0 bg-background px-2 sm:px-4 pt-2 sm:pt-3 pb-5 sm:pb-6">
          <div className="mx-auto w-full max-w-3xl">
            {/* Disruptive toggle — shown only for Neville and Tony */}
            {activeTool && (activeTool.id === "NEVILLE_DISRUPTIVO_1" || activeTool.id === "NEVILLE_DISRUPTIVO_2" || activeTool.id === "TONY_PROFUNDO" || activeTool.id === "TONY_DISRUPTIVO") && (() => {
              const isNeville = activeTool.id === "NEVILLE_DISRUPTIVO_1" || activeTool.id === "NEVILLE_DISRUPTIVO_2";
              const isDisruptiveActive = activeTool.id === "NEVILLE_DISRUPTIVO_2" || activeTool.id === "TONY_DISRUPTIVO";
              const normalId = isNeville ? "NEVILLE_DISRUPTIVO_1" : "TONY_PROFUNDO";
              const disruptiveId = isNeville ? "NEVILLE_DISRUPTIVO_2" : "TONY_DISRUPTIVO";
              const normalLabel = isNeville ? "Reflexiva" : "Profundo";
              const disruptiveLabel = "Sin filtros";
              return (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Modo:</span>
                  <div className="inline-flex rounded-full border border-border bg-card/60 p-0.5 gap-0.5">
                    <button
                      onClick={() => {
                        if (isDisruptiveActive) {
                          const tool = availableTools.find((t) => t.id === normalId);
                          if (tool) selectTool(tool);
                        }
                      }}
                      className={[
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all",
                        !isDisruptiveActive ? "bg-sky-600 text-white" : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {normalLabel}
                    </button>
                    <button
                      onClick={() => {
                        if (!isDisruptiveActive) {
                          const meta = agentMeta[disruptiveId];
                          if (meta?.requiresConfirmation) {
                            setConfirmDisruptive(meta);
                          } else {
                            const tool = availableTools.find((t) => t.id === disruptiveId);
                            if (tool) selectTool(tool);
                          }
                        }
                      }}
                      className={[
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all",
                        isDisruptiveActive ? "bg-amber-500 text-black" : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {disruptiveLabel}
                    </button>
                  </div>
                </div>
              );
            })()}
            <AgentInput
              accent="sky"
              value={input}
              onChange={setInput}
              onSend={handleSend}
              sending={loading}
              disabled={loading}
              placeholder="Pregunta a MentorIA..."
              leftSlot={<VoiceMicButton accent="sky" onText={setInput} disabled={loading} />}
            />
          </div>
        </div>

        {/* Disruptive confirmation modal (from toggle) */}
        {confirmDisruptive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDisruptive(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-xl border border-amber-500/40 bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-5 text-amber-400" />
                <span className="text-sm font-bold uppercase tracking-widest text-amber-400">Modo sin filtros</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {confirmDisruptive.title}{confirmDisruptive.subtitle ? ` — ${confirmDisruptive.subtitle}` : ""}
              </h3>
              {confirmDisruptive.disclaimer && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{confirmDisruptive.disclaimer}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDisruptive(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
                <button
                  onClick={() => { const def = summaryToToolDef(confirmDisruptive); setConfirmDisruptive(null); selectTool(def); }}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black"
                >Entiendo, entrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
