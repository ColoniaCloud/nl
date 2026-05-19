"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import {
  Handshake,
  ArrowLeft,
  Loader2,
  Trash2,
  MessageSquarePlus,
  History,
  Plus,
  Send,
  Clock,
  Filter,
  ChessKnight,
  MessageCircle,
  BarChart3,
  BookUser,
  Mic,
  MicOff,
  FileDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolType = "FUNNELS" | "ESTRATEGIA" | "SETTERS" | "CLOSERS" | "DATOS" | "CRM";
type Step = "dashboard" | "history" | "chat";

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
  id: ToolType;
  title: string;
  tagline: string;
  description: string;
  Icon: React.ElementType;
  initialContent: string;
  initialOptions: string[];
}

interface FunnelDef {
  id: number;
  title: string;
  desc: string;
  longDesc: string;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  {
    id: "FUNNELS",
    title: "Funnels de Venta",
    tagline: "Embudos de conversion",
    description: "Disenha, optimiza y analiza embudos de conversion para tu negocio.",
    Icon: Filter,
    initialContent:
      "Hola, soy **Jordan**, tu experto en Funnels de Venta.\n\nVamos a construir o mejorar tu embudo de conversion. Podes elegir uno de los 6 funnels probados del panel lateral, o contame que necesitas y lo armamos desde cero.\n\n\u00bfPor donde empezamos?",
    initialOptions: ["Quiero un Lead Magnet Funnel", "Analizar mi funnel actual", "Empezar desde cero"],
  },
  {
    id: "ESTRATEGIA",
    title: "Estrategia",
    tagline: "Analisis y hoja de ruta",
    description: "Analiza el mercado, define tu propuesta de valor y crea una estrategia para escalar.",
    Icon: ChessKnight,
    initialContent:
      "Hola, soy **Jordan**, tu estratega de negocios.\n\nVamos a analizar tu mercado, tu competencia y definir una hoja de ruta clara para escalar. Primero necesito entender tu negocio.\n\n\u00bfA que te dedicas y cual es tu objetivo principal ahora mismo?",
    initialOptions: ["Analizar mi mercado", "Definir mi propuesta de valor", "Crear un plan de escalado"],
  },
  {
    id: "SETTERS",
    title: "Agentes Setters",
    tagline: "Prospeccion y agendamiento",
    description: "Entrena a tu equipo para prospectar, calificar leads y agendar llamadas de venta.",
    Icon: MessageCircle,
    initialContent:
      "Hola, soy **Jordan**, entrenador de Setters de ventas.\n\nVamos a trabajar en prospeccion, calificacion de leads y tecnicas de agendamiento. Puedo darte scripts listos para usar o practicar roleplay con vos.\n\n\u00bfCon que queres arrancar?",
    initialOptions: ["Scripts de apertura", "Como calificar un lead", "Practicar roleplay setter"],
  },
  {
    id: "CLOSERS",
    title: "Agentes Closers",
    tagline: "Cierre y objeciones",
    description: "Domina el manejo de objeciones y tecnicas de cierre de alto impacto.",
    Icon: Handshake,
    initialContent:
      "Hola, soy **Jordan**, tu experto en cierre de ventas.\n\nEstoy aca para ayudarte a cerrar mas y mejor. Podemos trabajar una objecion especifica, practicar un cierre o armar tu script de ventas.\n\n\u00bfCual es tu mayor desafio ahora mismo?",
    initialOptions: ["Tengo una objecion que no puedo manejar", "Quiero practicar un cierre", "Armar mi script"],
  },
  {
    id: "DATOS",
    title: "Analisis de Datos",
    tagline: "Metricas de crecimiento",
    description: "Interpreta tus metricas de negocio y encontra oportunidades ocultas de escalado.",
    Icon: BarChart3,
    initialContent:
      "Hola, soy **Jordan**, tu analista de datos de crecimiento.\n\nVamos a revisar tus numeros y encontrar donde esta el dinero que se te esta escapando. Compartirme tus metricas actuales: CPL, CAC, conversion rate, ticket promedio, churn.\n\n\u00bfQue metricas tenes disponibles?",
    initialOptions: ["Analizar mi conversion rate", "Revisar CAC y LTV", "Encontrar cuellos de botella"],
  },
  {
    id: "CRM",
    title: "CRM Personalizado",
    tagline: "Gestion de clientes",
    description: "Disena un sistema de gestion de relaciones con clientes adaptado a tu negocio.",
    Icon: BookUser,
    initialContent:
      "Hola, soy **Jordan**, tu experto en CRM y gestion de clientes.\n\nVamos a disenar o mejorar tu sistema de seguimiento de leads para que ningun prospecto se pierda. Primero contame como manejas hoy tus contactos.\n\n\u00bfUses algun CRM o herramienta de seguimiento actualmente?",
    initialOptions: ["Disenar mi CRM desde cero", "Mejorar mi pipeline", "Automatizar seguimiento"],
  },
];

// ─── Funnels preestablecidos ──────────────────────────────────────────────────

const TOP_FUNNELS: FunnelDef[] = [
  {
    id: 1,
    title: "Lead Magnet Funnel",
    desc: "Captacion masiva de contactos.",
    longDesc: "Ideal para construir tu lista de prospectos ofreciendo valor gratuito a cambio de datos de contacto.",
  },
  {
    id: 2,
    title: "Webinar Funnel",
    desc: "Venta de infoproductos ticket medio.",
    longDesc: "Vende mediante la autoridad y la educacion. Ideal para productos de ticket medio que requieren explicacion detallada.",
  },
  {
    id: 3,
    title: "High Ticket Funnel",
    desc: "Cierre mediante llamadas estrategicas.",
    longDesc: "Disenado para filtrar leads y llevarlos a una llamada de cierre personalizada para productos de alto valor.",
  },
  {
    id: 4,
    title: "Tripwire Funnel",
    desc: "Oferta irresistible de bajo costo.",
    longDesc: "Convierte desconocidos en clientes rapidamente con una oferta de bajo costo para luego hacer un upsell.",
  },
  {
    id: 5,
    title: "Launch Funnel",
    desc: "Lanzamientos estilo Jeff Walker.",
    longDesc: "Crea anticipacion brutal con una serie de videos educativos antes de abrir inscripciones.",
  },
  {
    id: 6,
    title: "Membership Funnel",
    desc: "Suscripciones y pago recurrente.",
    longDesc: "Enfocado en la retencion y en generar ingresos predecibles mes a mes.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
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
    " \u00b7 " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetchSessions(tool: ToolType): Promise<SessionMeta[]> {
  try {
    const res = await fetch(`/api/jordan/sessions?tool=${tool}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions ?? [];
  } catch {
    return [];
  }
}

async function apiUpsertSession(id: string, tool: ToolType, messages: Message[]) {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return;
  const title =
    userMsgs[0].content.slice(0, 100) + (userMsgs[0].content.length > 100 ? "..." : "");
  try {
    await fetch("/api/jordan/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tool, title, messages: toStored(messages) }),
    });
  } catch {}
}

async function apiDeleteSession(id: string) {
  try {
    await fetch(`/api/jordan/sessions/${id}`, { method: "DELETE" });
  } catch {}
}

// ─── PDF export ───────────────────────────────────────────────────────────────

async function downloadMessagePDF(msg: Message, toolTitle: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;

  // Header
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Jordan AI \u2014 ${toolTitle}`, margin, 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const dateStr = msg.timestamp.toLocaleString("es-ES");
  doc.text(dateStr, margin, 17);

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.line(margin, 23, pageW - margin, 23);

  // Body — strip markdown symbols
  const cleanText = msg.content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#+\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`/g, "");

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(cleanText, contentW);
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
    doc.text(`nl360.site \u00b7 Jordan AI \u00b7 Pagina ${i}/${totalPages}`, margin, pageH - 8);
  }

  doc.save(`Jordan_${toolTitle}_${msg.id}.pdf`);
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const html = marked.parse(content, { breaks: true }) as string;
  return (
    <div
      className="prose prose-invert prose-sm max-w-none
        prose-p:my-1 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1
        [&_strong]:font-semibold [&_em]:italic
        [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
        [&_p]:mb-2 [&_p:last-child]:mb-0
        [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JordanPage() {
  const [step, setStep] = useState<Step>("dashboard");
  const [activeTool, setActiveTool] = useState<ToolType>("CLOSERS");
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Voice recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleVoice() {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }

  const loadSessions = useCallback(async (tool: ToolType) => {
    setSessionsLoading(true);
    const data = await apiFetchSessions(tool);
    setSessions(data);
    setSessionsLoading(false);
  }, []);

  function startNew(tool: ToolType) {
    const toolDef = TOOLS.find((t) => t.id === tool)!;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : genId();
    const initial: Message = {
      id: genId(),
      role: "agent",
      content: toolDef.initialContent,
      options: toolDef.initialOptions,
      timestamp: new Date(),
    };
    setActiveTool(tool);
    setSessionId(id);
    setMessages([initial]);
    setInput("");
    setStep("chat");
  }

  async function loadSession(id: string) {
    try {
      const res = await fetch(`/api/jordan/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveTool(data.tool as ToolType);
      setSessionId(id);
      setMessages(fromStored(data.messages));
      setInput("");
      setStep("chat");
    } catch {}
  }

  function buildHistory(msgs: Message[]) {
    return msgs
      .filter((m, i) => !(m.role === "agent" && i === 0))
      .map((m) => ({
        role: (m.role === "agent" ? "model" : "user") as "user" | "model",
        parts: m.content,
      }));
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/jordan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: activeTool,
          history: buildHistory(messages),
          message: text.trim(),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        const agentMsg: Message = {
          id: genId(),
          role: "agent",
          content: data.reply,
          options: data.options ?? [],
          timestamp: new Date(),
        };
        const finalMessages = [...updatedMessages, agentMsg];
        setMessages(finalMessages);
        await apiUpsertSession(sessionId, activeTool, finalMessages);
      } else {
        setMessages([
          ...updatedMessages,
          {
            id: genId(),
            role: "agent",
            content: data.error || "Hubo un problema. Intenta de nuevo.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages([
        ...updatedMessages,
        {
          id: genId(),
          role: "agent",
          content: "Error de conexion. Verifica tu red e intenta de nuevo.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  if (step === "dashboard") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Handshake className="size-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Jordan</h1>
              <p className="text-xs text-zinc-500">Ventas y cierre comercial</p>
            </div>
          </div>

          <p className="text-sm text-zinc-400 mb-8 mt-4">
            Selecciona el area en la que queres trabajar hoy.
          </p>

          {/* 6 tool cards — 3 col grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => startNew(tool.id)}
                className="group text-left p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]
                  hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-colors">
                    <tool.Icon className="size-4 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{tool.title}</div>
                    <div className="text-[10px] text-muted-foreground/60">{tool.tagline}</div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{tool.description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="size-3" />
                  Nueva sesion
                </div>
              </button>
            ))}
          </div>

          {/* Recent sessions */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Conversaciones recientes
            </h2>
            {TOOLS.map((tool) => (
              <RecentSessionsBlock
                key={tool.id}
                tool={tool}
                onLoad={loadSession}
                onHistory={() => {
                  setActiveTool(tool.id);
                  loadSessions(tool.id);
                  setStep("history");
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── History ────────────────────────────────────────────────────────────────

  if (step === "history") {
    const toolDef = TOOLS.find((t) => t.id === activeTool)!;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setStep("dashboard")}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <toolDef.Icon className="size-4 text-emerald-400" />
          <h1 className="text-sm font-semibold text-white">{toolDef.title} -- Historial</h1>
          <div className="ml-auto">
            <button
              onClick={() => startNew(activeTool)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-xs text-orange-400 hover:bg-orange-500/25 transition-colors"
            >
              <MessageSquarePlus className="size-3.5" />
              Nueva sesion
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sessionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 text-zinc-500 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <History className="size-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Sin conversaciones guardadas.</p>
              <button
                onClick={() => startNew(activeTool)}
                className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Empezar la primera
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]
                    hover:border-orange-500/20 hover:bg-orange-500/5 transition-all group cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{s.title || "Sin titulo"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="size-3 text-zinc-600" />
                      <span className="text-[10px] text-zinc-600">{formatDate(s.updated_at)}</span>
                      <span className="text-[10px] text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-600">{s.message_count} mensajes</span>
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await apiDeleteSession(s.id);
                      setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600
                      hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  const toolDef = TOOLS.find((t) => t.id === activeTool)!;
  const showFunnelsPanel = activeTool === "FUNNELS";

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={() => setStep("dashboard")}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-7 w-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <toolDef.Icon className="size-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">{toolDef.title}</span>
          <span className="ml-2 text-[10px] text-muted-foreground/60">{toolDef.tagline}</span>
        </div>
        <button
          onClick={() => startNew(activeTool)}
          title="Nueva sesion"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
        >
          <MessageSquarePlus className="size-4" />
        </button>
        <button
          onClick={() => {
            loadSessions(activeTool);
            setStep("history");
          }}
          title="Historial"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <History className="size-4" />
        </button>
      </div>

      {/* Body: funnels panel + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* Funnels side panel */}
        {showFunnelsPanel && (
          <aside className="w-56 flex-shrink-0 border-r border-white/[0.06] bg-[#1a1a1c] overflow-y-auto">
            <div className="px-3 py-3 border-b border-white/[0.05]">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Funnels probados
              </p>
            </div>
            <div className="p-2 space-y-1.5">
              {TOP_FUNNELS.map((f) => (
                <button
                  key={f.id}
                  onClick={() =>
                    sendMessage(
                      `Quiero construir un ${f.title}. ${f.longDesc} Ayudame a disenarlo para mi negocio.`
                    )
                  }
                  disabled={loading}
                  className="w-full text-left p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.01]
                    hover:border-orange-500/30 hover:bg-orange-500/8 transition-all group disabled:opacity-50"
                >
                  <p className="text-[11px] font-semibold text-zinc-300 group-hover:text-white transition-colors leading-tight">
                    {f.title}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{f.desc}</p>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Messages */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="pointer-events-none sticky top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent" />
            <div className="px-3 sm:px-5 pb-6 space-y-5 -mt-8 pt-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-1`}
              >
                <div
                  className={[
                    "max-w-[95%] sm:max-w-[80%] text-xs sm:text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 sm:px-4 py-2.5 sm:py-3 whitespace-pre-wrap"
                      : "text-foreground px-1 flex flex-col gap-1",
                  ].join(" ")}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  {/* Quick reply options */}
                  {msg.role === "agent" && msg.options && msg.options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(opt)}
                          disabled={loading}
                          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* PDF export */}
                  {msg.role === "agent" && msg.content.length > 100 && (
                    <div className="mt-1">
                      <button
                        onClick={() => downloadMessagePDF(msg, toolDef.title)}
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-emerald-400 transition-colors"
                      >
                        <FileDown className="size-3" />
                        Exportar PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-1 px-1 py-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border bg-background px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-lg sm:rounded-xl border border-border bg-muted px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 min-h-[36px] sm:min-h-[42px] max-h-[120px]"
              />
              {/* Mic button */}
              {recognitionRef.current !== undefined && (
                <button
                  onClick={toggleVoice}
                  disabled={loading}
                  title={isListening ? "Detener grabacion" : "Hablar"}
                  className={`flex-shrink-0 h-9 w-9 sm:h-[42px] sm:w-[42px] rounded-lg sm:rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 ${
                    isListening
                      ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                      : "border border-border text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                  }`}
                >
                  {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 sm:h-[42px] sm:w-[42px] flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Enter para enviar \u00b7 Shift+Enter para nueva linea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RecentSessionsBlock ──────────────────────────────────────────────────────

function RecentSessionsBlock({
  tool,
  onLoad,
  onHistory,
}: {
  tool: ToolDef;
  onLoad: (id: string) => void;
  onHistory: () => void;
}) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetchSessions(tool.id).then((data) => {
      setSessions(data.slice(0, 3));
      setLoaded(true);
    });
  }, [tool.id]);

  if (!loaded || sessions.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <tool.Icon className="size-3.5 text-muted-foreground/60" />
        <span className="text-[11px] text-zinc-600">{tool.title}</span>
      </div>
      <div className="space-y-1.5">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onLoad(s.id)}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl
              border border-white/[0.05] bg-white/[0.01] hover:border-emerald-500/20
              hover:bg-emerald-500/5 transition-all group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">
                {s.title || "Sin titulo"}
              </p>
              <p className="text-[10px] text-zinc-700 mt-0.5">{formatDate(s.updated_at)}</p>
            </div>
          </button>
        ))}
        {sessions.length >= 3 && (
          <button
            onClick={onHistory}
            className="w-full text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors py-1"
          >
            Ver todas las conversaciones
          </button>
        )}
      </div>
    </div>
  );
}
