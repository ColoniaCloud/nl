"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Megaphone,
  Send,
  ChevronRight,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Calendar,
  Image,
  CheckCircle2,
  Circle,
  PanelLeft,
  BarChart3,
  Users,
  Hash,
  Globe,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_META } from "@/lib/agent-colors";
import AgentInput, { type AgentInputHandle } from "@/components/chat/AgentInput";
import VoiceMicButton from "@/components/chat/VoiceMicButton";

// Icono representativo de Margarita (fuente unica: AGENT_META)
const MargaritaIcon = AGENT_META.margarita.icon;

// ─── Types ─────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  options?: string[];
}

type Step =
  | "welcome"
  | "brandbook_source"
  | "brandbook_collect"
  | "brandbook_confirm"
  | "social_select"
  | "strategy"
  | "strategy_confirm"
  | "content_generate"
  | "calendar_create"
  | "complete";

interface Strategy {
  id: number;
  title: string;
  objectives: string[];
  target_audience: string;
  content_pillars: { name: string; description: string; percentage: number }[];
  posting_frequency: Record<string, number>;
  brand_voice_guidelines: string;
  hashtag_strategy: string;
  selected_platforms: string[];
  calendar_url?: string;
}

interface ContentPost {
  id?: number;
  platform: string;
  post_type: string;
  pillar: string;
  title: string;
  caption: string;
  hashtags: string;
  visual_description: string;
  scheduled_at: string;
  status?: string;
  media_url?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STEP_PHASES: { steps: Step[]; label: string }[] = [
  { steps: ["welcome", "brandbook_source", "brandbook_collect", "brandbook_confirm"], label: "Brandbook" },
  { steps: ["social_select"], label: "Redes" },
  { steps: ["strategy", "strategy_confirm"], label: "Estrategia" },
  { steps: ["content_generate"], label: "Contenido" },
  { steps: ["calendar_create", "complete"], label: "Calendario" },
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  facebook: <Facebook className="size-3.5" />,
  instagram: <Instagram className="size-3.5" />,
  linkedin: <Linkedin className="size-3.5" />,
  x: <Twitter className="size-3.5" />,
  gmb: <Globe className="size-3.5" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-600",
  instagram: "bg-gradient-to-br from-pink-500 to-orange-400",
  linkedin: "bg-sky-700",
  x: "bg-zinc-900",
  gmb: "bg-red-500",
};

function getPhaseIndex(step: Step): number {
  for (let i = 0; i < STEP_PHASES.length; i++) {
    if (STEP_PHASES[i].steps.includes(step)) return i;
  }
  return 0;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BRANDBOOK_ID_KEY = "margarita_brandbook_id";
const SESSION_ID_KEY = "margarita_session_id";

export default function MargaritaPage() {
  const { open, isMobile, setOpenMobile } = useSidebar();

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [brandbookId, setBrandbookId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SESSION_ID_KEY)
  );
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [needsClickUpConnect, setNeedsClickUpConnect] = useState(false);
  const [pendingCalendarStrategyId, setPendingCalendarStrategyId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"chat" | "strategy" | "content">("chat");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<AgentInputHandle>(null);
  // Refs mirroring brandbookId/sessionId so sendMessage always reads the latest value,
  // even when called synchronously right after ensureSessionId() sets it (state updates are async).
  const brandbookIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    brandbookIdRef.current = brandbookId;
    if (typeof window !== "undefined" && brandbookId) {
      localStorage.setItem(BRANDBOOK_ID_KEY, String(brandbookId));
    }
  }, [brandbookId]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (typeof window !== "undefined" && sessionId) {
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  }, [sessionId]);

  function ensureSessionId(): string {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sid = crypto.randomUUID();
    sessionIdRef.current = sid;
    setSessionId(sid);
    return sid;
  }

  // Rehydrate the conversation on mount (e.g. after a page refresh) from whatever
  // brandbook_id / session_id we have persisted locally, so the chat doesn't appear to "forget" everything.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedBrandbookId = localStorage.getItem(BRANDBOOK_ID_KEY);
    const storedSessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!storedBrandbookId && !storedSessionId) return;

    (async () => {
      try {
        const qs = new URLSearchParams();
        if (storedBrandbookId) qs.set("brandbook_id", storedBrandbookId);
        if (storedSessionId) qs.set("session_id", storedSessionId);
        const res = await fetch(`/api/margarita/chat?${qs.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) return;

        setMessages(
          data.messages.map((m: any, i: number) => ({
            id: `hist-${i}`,
            role: m.role,
            content: m.content,
          }))
        );
        setStep((data.step as Step) || "welcome");
        if (data.brandbook_id) setBrandbookId(data.brandbook_id);
        if (data.strategy) {
          setStrategy(data.strategy);
          setStrategyId(data.strategy.id);
        }
        if (data.posts?.length) setPosts(data.posts);
        if (data.calendar_url) setCalendarUrl(data.calendar_url);
        setStarted(true);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check URL params for OAuth callbacks
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const error = params.get("social_error");
    if (connected || error) {
      window.history.replaceState({}, "", "/services/margarita");
      // Auto-retry calendar creation if ClickUp just connected
      if (connected === "clickup" && pendingCalendarStrategyId) {
        setNeedsClickUpConnect(false);
        setTimeout(() => triggerCalendarCreation(pendingCalendarStrategyId), 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMessage(role: Role, content: string, opts?: Partial<Message>): string {
    const id = `msg-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { id, role, content, ...opts }]);
    return id;
  }

  function updateMessage(id: string, updates: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setSending(true);

      addMessage("user", text);
      setInput("");

      const assistantId = addMessage("assistant", "", { streaming: true });

      try {
        const res = await fetch("/api/margarita/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            brandbook_id: brandbookIdRef.current,
            session_id: sessionIdRef.current,
          }),
        });

        if (!res.ok || !res.body) {
          updateMessage(assistantId, { content: "Error al conectar con Margarita.", streaming: false });
          setSending(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              if (data.text) {
                accumulated += data.text;
                updateMessage(assistantId, { content: accumulated, streaming: true });
              }

              if (data.done) {
                updateMessage(assistantId, {
                  content: data.cleanText || accumulated,
                  streaming: false,
                  options: data.options,
                });
                if (data.step) setStep(data.step as Step);
                if (data.brandbook_id) setBrandbookId(data.brandbook_id);

                // Trigger automatic actions based on step transition.
                // NOTA: la generacion de contenido debe dispararse al ENTRAR a "strategy_confirm"
                // (que es cuando el backend ya asume que el contenido se esta generando/genero),
                // no al llegar a "content_generate" (ese paso es para REVISAR contenido ya generado).
                const newStep = data.step as Step;
                const newBrandbookId = data.brandbook_id ?? brandbookIdRef.current;
                const newStrategyId = strategyId;

                if (newStep === "strategy" && newBrandbookId) {
                  setTimeout(() => triggerStrategyGeneration(newBrandbookId), 500);
                } else if (newStep === "strategy_confirm" && newStrategyId) {
                  setTimeout(() => triggerContentGeneration(newStrategyId), 500);
                } else if (newStep === "calendar_create" && newStrategyId) {
                  setTimeout(() => triggerCalendarCreation(newStrategyId), 500);
                }
              }

              if (data.error) {
                updateMessage(assistantId, { content: `Error: ${data.error}`, streaming: false });
              }
            } catch {}
          }
        }
      } catch (err: any) {
        updateMessage(assistantId, { content: "Error de conexion.", streaming: false });
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending, strategyId]
  );

  async function triggerStrategyGeneration(bbId: number) {
    setGeneratingStrategy(true);
    try {
      const res = await fetch("/api/margarita/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandbook_id: bbId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategyId(data.strategy_id);
        setStrategy(data.strategy);
        setActivePanel("strategy");
        // El texto viene del backend, que ya lo persistio en mm_chat_history — asi el modelo
        // ve exactamente lo mismo que el usuario, sin huecos en el historial.
        addMessage("assistant", data.chat_message || "La estrategia esta lista. Revisa el panel de estrategia a la derecha.", {
          options: ["Apruebo la estrategia", "Quiero ajustar algo"],
        });
        setStep("strategy");
      }
    } catch {}
    setGeneratingStrategy(false);
  }

  async function triggerContentGeneration(sId: number) {
    setGeneratingContent(true);
    try {
      const res = await fetch("/api/margarita/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: sId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setActivePanel("content");
        addMessage("assistant", data.chat_message || `Genere ${data.generated} posts para 2 semanas de contenido. Revisa el panel de contenido.`, {
          options: ["Crear calendario en ClickUp", "Revisar los posts primero"],
        });
        setStep("strategy_confirm");
      }
    } catch {}
    setGeneratingContent(false);
  }

  async function connectClickUp() {
    const res = await fetch("/api/margarita/social/connect?platform=clickup");
    if (res.ok) {
      const data = await res.json();
      if (data.auth_url) window.location.href = data.auth_url;
    }
  }

  async function triggerCalendarCreation(sId: number) {
    if (!strategyId && !sId) return;
    setCreatingCalendar(true);
    setNeedsClickUpConnect(false);
    try {
      const res = await fetch("/api/margarita/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: sId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.needs_clickup_connect) {
          setPendingCalendarStrategyId(sId);
          setNeedsClickUpConnect(true);
          addMessage("assistant", "Para crear el calendario necesitas conectar tu cuenta de ClickUp.", {});
        } else {
          setCalendarUrl(data.calendar_url || null);
          addMessage("assistant", data.chat_message || `Calendario creado en ClickUp con ${data.tasks_created || 0} tareas.${data.calendar_url ? ` Accede aqui: ${data.calendar_url}` : ""}`, {});
          setStep("complete");
        }
      }
    } catch {}
    setCreatingCalendar(false);
  }

  function startConversation() {
    ensureSessionId();
    setStarted(true);
    sendMessage("Hola Margarita, quiero crear mi estrategia de marketing en redes sociales.");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const phaseIndex = getPhaseIndex(step);

  // ── Landing ──────────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="flex flex-col h-full bg-background">
        {isMobile && (
          <button
            onClick={() => setOpenMobile(true)}
            className="absolute top-4 left-4 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-white/[0.07] z-10"
          >
            <PanelLeft className="size-5" />
          </button>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-2xl flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 mb-5">
              <MargaritaIcon className="size-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Margarita Mkt</h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-2 max-w-lg">
              Tu estratega de marketing digital con IA. Creo estrategias de contenido
              personalizadas, genero posts listos para publicar y los programo en tus redes sociales.
            </p>
            <p className="text-muted-foreground/60 text-xs sm:text-sm mb-8">
              Integrado con tu brandbook de Manu Dev &bull; ClickUp &bull; Meta &bull; LinkedIn
            </p>

            <div className="grid grid-cols-2 gap-3 w-full text-left">
              {[
                { icon: <Sparkles className="size-4 text-emerald-400" />, title: "Brandbook con IA", desc: "Importa tu marca de Manu Dev o creala desde cero" },
                { icon: <BarChart3 className="size-4 text-blue-400" />, title: "Estrategia de contenido", desc: "Pilares, frecuencia y guia de voz por plataforma" },
                { icon: <Image className="size-4 text-emerald-400" />, title: "Posts generados", desc: "Captions, hashtags e imagenes para 2 semanas" },
                { icon: <Calendar className="size-4 text-amber-400" />, title: "Calendario en ClickUp", desc: "Aprueba y programa desde ClickUp automaticamente" },
              ].map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2">{f.icon}</div>
                  <div className="text-sm font-medium text-foreground mb-1">{f.title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Input fixed at bottom */}
        <div className="flex-shrink-0 bg-background px-4 pt-3 pb-5 sm:pb-6">
          <div className="mx-auto w-full max-w-2xl">
            <AgentInput
              accent="emerald"
              value={input}
              onChange={setInput}
              onSend={() => {
                if (!input.trim()) return;
                ensureSessionId();
                setStarted(true);
                sendMessage(input);
              }}
              sending={sending}
              disabled={sending}
              placeholder="Hola Margarita, quiero crear mi estrategia de marketing..."
              leftSlot={<VoiceMicButton accent="emerald" onText={setInput} disabled={sending} />}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Chat + Panels ────────────────────────────────────────────────────────

  return (
    <div className="flex h-dvh flex-col bg-background overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card/50">
        <div className="flex items-center gap-3 px-4 h-12">
          {isMobile && (
            <button
              onClick={() => setOpenMobile(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
          <Megaphone className="size-4 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-sm text-foreground">Margarita Mkt</span>

          {/* Phase progress */}
          <div className="flex items-center gap-1 ml-4 flex-1 overflow-x-auto scrollbar-none">
            {STEP_PHASES.map((phase, idx) => (
              <div key={phase.label} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    idx < phaseIndex
                      ? "bg-emerald-500/20 text-emerald-400"
                      : idx === phaseIndex
                      ? "bg-emerald-600 text-white"
                      : "text-muted-foreground/50"
                  )}
                >
                  {idx < phaseIndex ? (
                    <CheckCircle2 className="size-3" />
                  ) : idx === phaseIndex ? (
                    <Circle className="size-3 fill-white" />
                  ) : (
                    <Circle className="size-3" />
                  )}
                  {phase.label}
                </div>
                {idx < STEP_PHASES.length - 1 && (
                  <ChevronRight className="size-3 text-muted-foreground/30 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Panel switcher */}
          {(strategy || posts.length > 0) && (
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {[
                { key: "chat", label: "Chat", icon: <Megaphone className="size-3" /> },
                { key: "strategy", label: "Estrategia", icon: <BarChart3 className="size-3" />, show: !!strategy },
                { key: "content", label: "Contenido", icon: <Image className="size-3" />, show: posts.length > 0 },
              ]
                .filter((p) => p.show !== false)
                .map((panel) => (
                  <button
                    key={panel.key}
                    onClick={() => setActivePanel(panel.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      activePanel === panel.key
                        ? "bg-white/[0.10] text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                    )}
                  >
                    {panel.icon}
                    {panel.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Chat Panel ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex flex-col",
            activePanel === "chat" || !strategy ? "flex-1" : "w-[380px] flex-shrink-0 border-r border-border",
            activePanel !== "chat" && strategy && !isMobile ? "" : "",
            isMobile && activePanel !== "chat" ? "hidden" : ""
          )}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 sm:px-4 py-2.5 sm:py-3"
                      : "text-foreground"
                  )}
                >
                  {msg.streaming && !msg.content ? (
                    <span className="flex gap-1 items-center py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"0ms"}} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"150ms"}} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"300ms"}} />
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  {msg.streaming && msg.content && (
                    <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}

            {/* Option buttons */}
            {messages.length > 0 && !sending && (
              (() => {
                const last = messages[messages.length - 1];
                if (last?.role === "assistant" && last.options?.length && !last.streaming) {
                  return (
                    <div className="flex flex-wrap gap-2 pl-2">
                      {last.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(opt)}
                          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Loading states */}
            {generatingStrategy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"300ms"}} />
                </span>
                <span>Generando estrategia con Claude Sonnet...</span>
              </div>
            )}
            {generatingContent && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay:"300ms"}} />
                </span>
                <span>Generando 14 posts para 2 semanas...</span>
              </div>
            )}
            {creatingCalendar && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" style={{animationDelay:"300ms"}} />
                </span>
                <span>Creando calendario en ClickUp...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="flex-shrink-0 bg-card/30 px-4 pt-3 pb-5 sm:pb-6">
            <div className="mx-auto w-full max-w-3xl">
              <AgentInput
                ref={inputRef}
                accent="emerald"
                value={input}
                onChange={setInput}
                onSend={() => sendMessage(input)}
                sending={sending}
                disabled={sending}
                placeholder="Escribe tu mensaje..."
                leftSlot={<VoiceMicButton accent="emerald" onText={setInput} disabled={sending} />}
              />
            </div>
          </div>
        </div>

        {/* ── Strategy Panel ──────────────────────────────────────────────── */}
        {strategy && activePanel === "strategy" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">{strategy.title}</h2>
                <p className="text-sm text-muted-foreground">{strategy.target_audience}</p>
              </div>

              {/* Objectives */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  Objetivos
                </h3>
                <ul className="space-y-2">
                  {strategy.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Content Pillars */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="size-4 text-blue-400" />
                  Pilares de Contenido
                </h3>
                <div className="space-y-4">
                  {strategy.content_pillars.map((pillar, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{pillar.name}</span>
                        <span className="text-xs text-muted-foreground">{pillar.percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${pillar.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Posting Frequency */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-emerald-400" />
                  Frecuencia de Publicacion
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(strategy.posting_frequency).map(([platform, freq]) => (
                    <div
                      key={platform}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-md text-white text-xs", PLATFORM_COLORS[platform] || "bg-zinc-700")}>
                        {PLATFORM_ICONS[platform] || <Globe className="size-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground capitalize">{platform}</div>
                        <div className="text-xs text-muted-foreground">{freq}x/semana</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Voice */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="size-4 text-amber-400" />
                  Voz de Marca
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{strategy.brand_voice_guidelines}</p>
              </div>

              {/* Hashtags */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Hash className="size-4 text-sky-400" />
                  Estrategia de Hashtags
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{strategy.hashtag_strategy}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => sendMessage("Apruebo la estrategia")}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Aprobar estrategia
                </button>
                <button
                  onClick={() => {
                    setActivePanel("chat");
                    sendMessage("Quiero ajustar algo de la estrategia");
                  }}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
                >
                  Ajustar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Content Panel ────────────────────────────────────────────────── */}
        {posts.length > 0 && activePanel === "content" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Calendario de Contenido
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {posts.length} posts generados para 2 semanas
                  </p>
                </div>
                <div className="flex gap-2">
                  {calendarUrl && (
                    <a
                      href={calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="size-4" />
                      Ver en ClickUp
                    </a>
                  )}
                  {strategyId && !calendarUrl && !needsClickUpConnect && (
                    <button
                      onClick={() => triggerCalendarCreation(strategyId)}
                      disabled={creatingCalendar}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                    >
                      {creatingCalendar ? (
                        <span className="flex gap-0.5 items-center">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" style={{animationDelay:"0ms"}} />
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" style={{animationDelay:"150ms"}} />
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" style={{animationDelay:"300ms"}} />
                        </span>
                      ) : (
                        <Calendar className="size-4" />
                      )}
                      Crear en ClickUp
                    </button>
                  )}
                  {needsClickUpConnect && (
                    <button
                      onClick={connectClickUp}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                    >
                      <ExternalLink className="size-4" />
                      Conectar ClickUp
                    </button>
                  )}
                </div>
              </div>

              {/* Posts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Platform badge */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded text-white", PLATFORM_COLORS[post.platform] || "bg-zinc-700")}>
                          {PLATFORM_ICONS[post.platform] || <Globe className="size-3" />}
                        </div>
                        <span className="text-xs font-medium text-foreground capitalize">{post.platform}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{post.post_type}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {post.scheduled_at
                          ? new Date(post.scheduled_at).toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>

                    {/* Visual description (placeholder) */}
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center p-3 relative">
                      {post.media_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.media_url} alt={post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Image className="size-6 text-zinc-700 mx-auto mb-1" />
                          <p className="text-xs text-zinc-600 line-clamp-3">{post.visual_description}</p>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">{post.pillar}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">{post.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{post.caption}</p>
                      {post.hashtags && (
                        <p className="text-xs text-blue-400/70 line-clamp-2">{post.hashtags}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
