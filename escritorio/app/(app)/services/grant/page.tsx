"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import AgentInput from "@/components/chat/AgentInput";
import { marked } from "marked";
import {
  Handshake,
  ArrowLeft,
  Loader2,
  Trash2,
  MessageSquarePlus,
  History,
  Plus,
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

interface ConversationMeta {
  id: number;
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
      "Hola, soy **Jordan**, tu experto en Funnels de Venta.\n\nVamos a construir o mejorar tu embudo de conversion. Podes elegir uno de los 6 funnels probados del panel lateral, o contame que necesitas y lo armamos desde cero.\n\n¿Por donde empezamos?",
    initialOptions: ["Quiero un Lead Magnet Funnel", "Analizar mi funnel actual", "Empezar desde cero"],
  },
  {
    id: "ESTRATEGIA",
    title: "Estrategia",
    tagline: "Analisis y hoja de ruta",
    description: "Analiza el mercado, define tu propuesta de valor y crea una estrategia para escalar.",
    Icon: ChessKnight,
    initialContent:
      "Hola, soy **Jordan**, tu estratega de negocios.\n\nVamos a analizar tu mercado, tu competencia y definir una hoja de ruta clara para escalar. Primero necesito entender tu negocio.\n\n¿A que te dedicas y cual es tu objetivo principal ahora mismo?",
    initialOptions: ["Analizar mi mercado", "Definir mi propuesta de valor", "Crear un plan de escalado"],
  },
  {
    id: "SETTERS",
    title: "Agentes Setters",
    tagline: "Prospeccion y agendamiento",
    description: "Entrena a tu equipo para prospectar, calificar leads y agendar llamadas de venta.",
    Icon: MessageCircle,
    initialContent:
      "Hola, soy **Jordan**, entrenador de Setters de ventas.\n\nVamos a trabajar en prospeccion, calificacion de leads y tecnicas de agendamiento. Puedo darte scripts listos para usar o practicar roleplay con vos.\n\n¿Con que queres arrancar?",
    initialOptions: ["Scripts de apertura", "Como calificar un lead", "Practicar roleplay setter"],
  },
  {
    id: "CLOSERS",
    title: "Agentes Closers",
    tagline: "Cierre y objeciones",
    description: "Domina el manejo de objeciones y tecnicas de cierre de alto impacto.",
    Icon: Handshake,
    initialContent:
      "Hola, soy **Jordan**, tu experto en cierre de ventas.\n\nEstoy aca para ayudarte a cerrar mas y mejor. Podemos trabajar una objecion especifica, practicar un cierre o armar tu script de ventas.\n\n¿Cual es tu mayor desafio ahora mismo?",
    initialOptions: ["Tengo una objecion que no puedo manejar", "Quiero practicar un cierre", "Armar mi script"],
  },
  {
    id: "DATOS",
    title: "Analisis de Datos",
    tagline: "Metricas de crecimiento",
    description: "Interpreta tus metricas de negocio y encontra oportunidades ocultas de escalado.",
    Icon: BarChart3,
    initialContent:
      "Hola, soy **Jordan**, tu analista de datos de crecimiento.\n\nVamos a revisar tus numeros y encontrar donde esta el dinero que se te esta escapando. Compartirme tus metricas actuales: CPL, CAC, conversion rate, ticket promedio, churn.\n\n¿Que metricas tenes disponibles?",
    initialOptions: ["Analizar mi conversion rate", "Revisar CAC y LTV", "Encontrar cuellos de botella"],
  },
  {
    id: "CRM",
    title: "CRM Personalizado",
    tagline: "Gestion de clientes",
    description: "Disena un sistema de gestion de relaciones con clientes adaptado a tu negocio.",
    Icon: BookUser,
    initialContent:
      "Hola, soy **Jordan**, tu experto en CRM y gestion de clientes.\n\nVamos a disenar o mejorar tu sistema de seguimiento de leads para que ningun prospecto se pierda. Primero contame como manejas hoy tus contactos.\n\n¿Uses algun CRM o herramienta de seguimiento actualmente?",
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

function fromDBMessages(
  rows: { id: number; role: string; content: string; created_at: string }[]
): Message[] {
  return rows.map((r) => ({
    id: String(r.id),
    role: r.role === "assistant" ? "agent" : "user",
    content: r.content,
    options: [],
    timestamp: new Date(r.created_at),
  }));
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

async function apiFetchConversations(tool: ToolType): Promise<ConversationMeta[]> {
  try {
    const res = await fetch(`/api/jordan/conversations?tool=${tool}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations ?? [];
  } catch {
    return [];
  }
}

async function apiDeleteConversation(id: number) {
  try {
    await fetch(`/api/jordan/conversations/${id}`, { method: "DELETE" });
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
  doc.setFillColor(249, 115, 22); // orange-500
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Jordan AI — ${toolTitle}`, margin, 12);

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
    doc.text(`nl360.site · Jordan AI · Pagina ${i}/${totalPages}`, margin, pageH - 8);
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

// ─── FunnelCarousel (mobile) ──────────────────────────────────────────────────

function FunnelCarousel({
  items,
  onSelect,
  disabled,
}: {
  items: FunnelDef[];
  onSelect: (msg: string) => void;
  disabled: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);
  const hasDragged = useRef(false);
  const doubled = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    let lastTs: number | null = null;
    const SPEED = 0.06; // px/ms  (~60px/s, visible but gentle)

    function tick(ts: number) {
      const el = trackRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }
      if (!isDragging.current) {
        if (lastTs !== null) {
          posRef.current -= SPEED * (ts - lastTs);
          const halfW = el.scrollWidth / 2;
          if (-posRef.current >= halfW) posRef.current = 0;
          if (posRef.current > 0) posRef.current = 0;
        }
        lastTs = ts;
      } else {
        lastTs = null;
      }
      el.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function startDrag(clientX: number) {
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = clientX;
    startPos.current = posRef.current;
  }

  function moveDrag(clientX: number) {
    if (!isDragging.current) return;
    const dx = clientX - startX.current;
    if (Math.abs(dx) > 4) hasDragged.current = true;
    const el = trackRef.current;
    if (!el) return;
    const halfW = el.scrollWidth / 2;
    let next = startPos.current + dx;
    if (next > 0) next = 0;
    if (-next >= halfW) next = -((-next) % halfW);
    posRef.current = next;
    el.style.transform = `translateX(${next}px)`;
  }

  function endDrag() { isDragging.current = false; }

  return (
    <div
      className="overflow-hidden py-1.5 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={(e) => startDrag(e.clientX)}
      onMouseMove={(e) => moveDrag(e.clientX)}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={(e) => { e.stopPropagation(); startDrag(e.touches[0].clientX); }}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
    >
      <div
        ref={trackRef}
        className="flex gap-2 pl-4 will-change-transform"
        style={{ width: "max-content" }}
      >
        {doubled.map((f, i) => (
          <button
            key={`${f.id}-${i}`}
            onClick={() => {
              if (hasDragged.current || disabled) return;
              onSelect(`Quiero construir un ${f.title}. ${f.longDesc} Ayudame a disenarlo para mi negocio.`);
            }}
            disabled={disabled}
            className="flex-shrink-0 w-36 text-left px-2.5 py-2 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:border-orange-500/50 transition-all disabled:opacity-50"
          >
            <p className="text-xxs font-semibold text-zinc-300 leading-tight">{f.title}</p>
            <p className="text-2xs text-zinc-600 mt-0.5 leading-tight">{f.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JordanPage() {
  const [step, setStep] = useState<Step>("dashboard");
  const [activeTool, setActiveTool] = useState<ToolType>("CLOSERS");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const loadConversations = useCallback(async (tool: ToolType) => {
    setConvsLoading(true);
    const data = await apiFetchConversations(tool);
    setConversations(data);
    setConvsLoading(false);
  }, []);

  function startNew(tool: ToolType) {
    const toolDef = TOOLS.find((t) => t.id === tool)!;
    const initial: Message = {
      id: genId(),
      role: "agent",
      content: toolDef.initialContent,
      options: toolDef.initialOptions,
      timestamp: new Date(),
    };
    setActiveTool(tool);
    setConversationId(null);
    setMessages([initial]);
    setInput("");
    setStep("chat");
  }

  async function loadConversation(id: number) {
    try {
      const res = await fetch(`/api/jordan/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const conv = data.conversation;
      setActiveTool(conv.tool as ToolType);
      setConversationId(id);
      setMessages(fromDBMessages(conv.messages));
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
          // Send empty history when backend already has the conversation;
          // send full history only for the first message of a new conversation.
          history: conversationId !== null ? [] : buildHistory(messages),
          message: text.trim(),
          ...(conversationId !== null && { conversationId }),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        // Capture the conversation ID returned by the backend on first message
        if (data.conversationId && conversationId === null) {
          setConversationId(data.conversationId);
        }

        const agentMsg: Message = {
          id: genId(),
          role: "agent",
          content: data.reply,
          options: data.options ?? [],
          timestamp: new Date(),
        };
        setMessages([...updatedMessages, agentMsg]);
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
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Handshake className="size-5 text-orange-400" />
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
                  hover:border-orange-500/50 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-colors">
                    <tool.Icon className="size-4 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{tool.title}</div>
                    <div className="text-2xs text-muted-foreground/60">{tool.tagline}</div>
                  </div>
                </div>
                <p className="text-xxs text-zinc-500 leading-relaxed">{tool.description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xxs text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="size-3" />
                  Nueva sesion
                </div>
              </button>
            ))}
          </div>

          {/* Recent conversations */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Conversaciones recientes
            </h2>
            {TOOLS.map((tool) => (
              <RecentConversationsBlock
                key={tool.id}
                tool={tool}
                onLoad={loadConversation}
                onHistory={() => {
                  setActiveTool(tool.id);
                  loadConversations(tool.id);
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
          <toolDef.Icon className="size-4 text-orange-400" />
          <h1 className="text-sm font-semibold text-white">{toolDef.title} -- Historial</h1>
          <div className="ml-auto">
            <button
              onClick={() => startNew(activeTool)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/20 text-xs text-orange-400 hover:bg-orange-500/25 transition-colors"
            >
              <MessageSquarePlus className="size-3.5" />
              Nueva sesion
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {convsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 text-zinc-500 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12">
              <History className="size-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Sin conversaciones guardadas.</p>
              <button
                onClick={() => startNew(activeTool)}
                className="mt-4 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                Empezar la primera
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadConversation(s.id)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]
                    hover:border-orange-500/40 transition-all group cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{s.title || "Sin titulo"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="size-3 text-zinc-600" />
                      <span className="text-2xs text-zinc-600">{formatDate(s.updated_at)}</span>
                      <span className="text-2xs text-zinc-700">·</span>
                      <span className="text-2xs text-zinc-600">{s.message_count} mensajes</span>
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await apiDeleteConversation(s.id);
                      setConversations((prev) => prev.filter((x) => x.id !== s.id));
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
      <div className="border-b border-white/[0.06] flex-shrink-0">
      <div className="mx-auto w-full max-w-3xl flex items-center gap-3 px-5 py-3">
        <button
          onClick={() => setStep("dashboard")}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-7 w-7 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
          <toolDef.Icon className="size-3.5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">{toolDef.title}</span>
          <span className="ml-2 text-2xs text-muted-foreground/60">{toolDef.tagline}</span>
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
            loadConversations(activeTool);
            setStep("history");
          }}
          title="Historial"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <History className="size-4" />
        </button>
      </div>
      </div>

      {/* Body: messages + input */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="pointer-events-none sticky top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent" />
          <div className="mx-auto w-full max-w-3xl px-3 sm:px-5 pb-6 space-y-5 -mt-8 pt-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-1`}
              >
                <div
                  className={[
                    "max-w-[95%] sm:max-w-[80%] text-xs sm:text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-orange-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 sm:px-4 py-2.5 sm:py-3 whitespace-pre-wrap"
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
                          className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-colors disabled:opacity-50"
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
                        className="flex items-center gap-1.5 text-2xs text-muted-foreground/60 hover:text-orange-400 transition-colors"
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

        {/* Input + Funnels panel */}
        <div className="flex-shrink-0 bg-background">

          {/* Funnels — desktop: grid, mobile: carousel */}
          {showFunnelsPanel && (
            <>
              {/* Desktop grid */}
              <div className="hidden sm:block mx-auto max-w-3xl px-4 pt-3 pb-1">
                <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">
                  Funnels probados
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TOP_FUNNELS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() =>
                        sendMessage(
                          `Quiero construir un ${f.title}. ${f.longDesc} Ayudame a disenarlo para mi negocio.`
                        )
                      }
                      disabled={loading}
                      className="text-left p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:border-orange-500/50 transition-all group disabled:opacity-50"
                    >
                      <p className="text-xxs font-semibold text-zinc-300 group-hover:text-white transition-colors leading-tight">
                        {f.title}
                      </p>
                      <p className="text-2xs text-zinc-600 mt-0.5 leading-tight">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile carousel */}
              <div className="sm:hidden">
                <FunnelCarousel
                  items={TOP_FUNNELS}
                  onSelect={sendMessage}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* Input */}
          <div className="px-2 sm:px-4 pt-2 sm:pt-3 pb-5 sm:pb-6">
            <div className="mx-auto w-full max-w-3xl">
              <AgentInput
                accent="amber"
                value={input}
                onChange={setInput}
                onSend={() => sendMessage(input)}
                sending={loading}
                disabled={loading}
                placeholder="Escribe tu mensaje..."
                leftSlot={
                  recognitionRef.current !== undefined ? (
                    <button
                      onClick={toggleVoice}
                      disabled={loading}
                      title={isListening ? "Detener grabacion" : "Hablar"}
                      className={`nl-send-btn flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                        isListening
                          ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                          : "border border-border text-muted-foreground hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10"
                      }`}
                    >
                      {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RecentConversationsBlock ─────────────────────────────────────────────────

function RecentConversationsBlock({
  tool,
  onLoad,
  onHistory,
}: {
  tool: ToolDef;
  onLoad: (id: number) => void;
  onHistory: () => void;
}) {
  const [convs, setConvs] = useState<ConversationMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetchConversations(tool.id).then((data) => {
      setConvs(data.slice(0, 3));
      setLoaded(true);
    });
  }, [tool.id]);

  if (!loaded || convs.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <tool.Icon className="size-3.5 text-muted-foreground/60" />
        <span className="text-xxs text-zinc-600">{tool.title}</span>
      </div>
      <div className="space-y-1.5">
        {convs.map((s) => (
          <button
            key={s.id}
            onClick={() => onLoad(s.id)}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl
              border border-white/[0.05] bg-white/[0.01] hover:border-orange-500/40
              transition-all group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">
                {s.title || "Sin titulo"}
              </p>
              <p className="text-2xs text-zinc-700 mt-0.5">{formatDate(s.updated_at)}</p>
            </div>
          </button>
        ))}
        {convs.length >= 3 && (
          <button
            onClick={onHistory}
            className="w-full text-2xs text-zinc-600 hover:text-orange-400 transition-colors py-1"
          >
            Ver todas las conversaciones
          </button>
        )}
      </div>
    </div>
  );
}
