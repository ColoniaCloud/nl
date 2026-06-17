"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import { Globe, Loader2, Check, ExternalLink, Wand2, ChevronRight, AlertTriangle, Maximize2, Minimize2, Upload, Menu } from "lucide-react";
import { AGENT_META } from "@/lib/agent-colors";
import { ChatBubble } from "@/components/chat/ChatBubble";
import AgentInput, { type AgentInputHandle } from "@/components/chat/AgentInput";
import VoiceMicButton from "@/components/chat/VoiceMicButton";
import CmsPanel from "@/components/manu-dev/CmsPanel";
import { TemplateSelector, ModePicker } from "@/components/manu-dev/TemplateSelector";
import type { LiteTemplateId } from "@/components/manu-dev/TemplateSelector";
import type { ModeOption } from "@/components/manu-dev/TemplateSelector";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface ColorSwatch {
  name: string;
  hex: string;
}

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  options?: string[];
  colors?: ColorSwatch[];
  fonts?: { name: string }[];
  upload?: string;
  logoPreview?: string;
  logoGenerating?: boolean;
}

type Step =
  | "pick_type"
  | "welcome"
  | "subdomain"
  | "identity"
  | "address"
  | "logo"
  | "colors"
  | "fonts"
  | "social"
  | "site_type"
  | "building"
  | "complete"
  | "cms";

type GenerationMode = "next" | "lite" | "lite_plus" | "auto";



// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  pick_type: "Tipo",
  welcome: "Nombre",
  subdomain: "Direccion",
  identity: "Identidad",
  address: "Ubicacion",
  logo: "Logo",
  colors: "Colores",
  fonts: "Tipografia",
  social: "Redes",
  site_type: "Estilo",
  building: "Construyendo",
  complete: "Listo",
  cms: "Administrar",
};

const STEPS_FLOW: Step[] = [
  "pick_type", "welcome", "subdomain", "identity", "address", "logo",
  "colors", "fonts", "social", "site_type", "building", "complete",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function toUiErrorMessage(input: unknown, fallback = "Error de red"): string {
  const msg = String(input || "").toLowerCase();
  if (msg.includes("timeout")) return "La solicitud tardo demasiado (timeout). Intenta de nuevo.";
  if (msg.includes("429") || msg.includes("rate")) return "El proveedor de IA esta saturado. Reintenta en unos segundos.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) return "Error de red. Verifica tu conexion e intenta nuevamente.";
  if (msg.includes("503") || msg.includes("502")) return "Servicio temporalmente no disponible. Intenta nuevamente.";
  return String(input || fallback);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS_FLOW.indexOf(current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {STEPS_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className={[
              "flex items-center gap-1 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-xxs font-medium whitespace-nowrap",
              done ? "bg-muted text-muted-foreground"
                : active ? "bg-foreground text-background"
                : "text-muted-foreground/40",
            ].join(" ")}>
              {done && <Check className="size-2.5" />}
              {STEP_LABELS[s]}
            </div>
            {i < STEPS_FLOW.length - 1 && (
              <div className={`w-3 h-px mx-0.5 flex-shrink-0 ${done ? "bg-muted-foreground/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColorSwatches({ colors }: { colors: ColorSwatch[] }) {
  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      {colors.map((c) => (
        <div key={c.hex} className="flex items-center gap-1.5">
          <div
            className="h-5 w-5 rounded border border-white/20 flex-shrink-0"
            style={{ backgroundColor: c.hex }}
          />
          <span className="text-xs text-muted-foreground">
            {c.name} <span className="font-mono">{c.hex}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function FontPreview({ fonts }: { fonts: { name: string }[] }) {
  useEffect(() => {
    fonts.forEach((f) => {
      const id = `gf-${f.name.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, [fonts]);

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {fonts.map((font) => (
        <div
          key={font.name}
          className="rounded-lg border border-border bg-muted/50 px-3 py-4 text-center"
          style={{ fontFamily: `"${font.name}", sans-serif` }}
        >
          <span className="text-base font-semibold text-foreground">{font.name}</span>
        </div>
      ))}
    </div>
  );
}

function BuildTerminal({ logs, status }: {
  logs: string[];
  status: "running" | "done" | "error";
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className={`mb-4 rounded-lg sm:rounded-xl overflow-hidden border border-zinc-700 shadow-lg transition-all duration-200 ${expanded ? "fixed inset-2 sm:inset-4 z-50 flex flex-col" : ""}`}>
      {/* Terminal header */}
      <div className="flex items-center gap-2 bg-zinc-800 px-3 py-2 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <span className="ml-1 text-xxs font-mono text-zinc-400 flex-1 text-center">
          NL360 Backoffice - Manu Dev v1.6 {status === "running" ? "trabajando" : status === "done" ? "listo" : "error"}
        </span>
        {status === "running" && (
          <Loader2 className="animate-spin size-3 text-zinc-400" />
        )}
        {status === "done" && (
          <Check className="size-3 text-emerald-400" />
        )}
        {status === "error" && (
          <AlertTriangle className="size-3 text-red-400" />
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Minimizar" : "Ampliar consola"}
          className="ml-1 text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
        >
          {expanded ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
        </button>
      </div>
      {/* Log area */}
      <div className={`bg-zinc-950 px-3 sm:px-4 py-2.5 sm:py-3 overflow-y-auto font-mono text-xs leading-relaxed ${expanded ? "flex-1" : "max-h-[30vh] sm:max-h-[40vh] md:max-h-52"}`}>
        {logs.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-zinc-600 select-none flex-shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={
              status === "error" && i === logs.length - 1
                ? "text-red-400"
                : status === "done" && i === logs.length - 1
                ? "text-emerald-400"
                : "text-green-400"
            }>
              {status === "error" && i === logs.length - 1 && line.startsWith("<")
                ? <span dangerouslySetInnerHTML={{ __html: line }} />
                : line}
            </span>
          </div>
        ))}
        {status === "running" && (
          <div className="flex gap-2 mt-0.5">
            <span className="text-zinc-600 select-none">&#9607;</span>
            <span className="text-green-400 animate-pulse">_</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Hub / Landing page ───────────────────────────────────────────────────────

const SUBAGENTS = [
  {
    href: "/services/manu-dev",
    label: "Dev",
    desc: "Crea un sitio web completo desde cero con IA",
    icon: Globe,
    color: "text-emerald-400 bg-emerald-500/20",
    isChat: true,
  },
  {
    href: "/services/nubia",
    label: "Nubia",
    desc: "Construi tu tienda online con productos y pagos",
    icon: AGENT_META.nubia.icon,
    color: "text-violet-400 bg-violet-500/20",
  },
  {
    href: "/services/forge",
    label: "Forge",
    desc: "Tokeniza activos reales en blockchain",
    icon: AGENT_META.forge.icon,
    color: "text-amber-400 bg-amber-500/20",
  },
];

interface RecentItem {
  id: string;
  agent: string;
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
}

function ManuDevHub({
  isMobile,
  setOpenMobile,
  onStart,
}: {
  isMobile: boolean;
  setOpenMobile: (v: boolean) => void;
  onStart: (text: string) => void;
}) {
  const [hubInput, setHubInput] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const inputRef = useRef<AgentInputHandle>(null);

  useEffect(() => {
    fetch("/api/recent", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.items)) setRecent(d.items); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = hubInput.trim();
    if (!text) return;
    onStart(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = hubInput.trim();
      if (text) onStart(text);
    }
  }

  const agentIcon: Record<string, React.ElementType> = {
    "manu-dev": Globe,
    nubia: AGENT_META.nubia.icon,
    forge: AGENT_META.forge.icon,
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {isMobile && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-border">
          <button
            onClick={() => setOpenMobile(true)}
            aria-label="Abrir menú lateral"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="size-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 text-xl">
              <Globe className="size-5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Que queres construir hoy?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Decime tu idea y te conecto con el agente indicado, o elegi uno directamente.
            </p>
          </div>

          {/* Input */}
          <div className="mb-8">
            <AgentInput
              ref={inputRef}
              accent="emerald"
              value={hubInput}
              onChange={setHubInput}
              onSend={() => { const text = hubInput.trim(); if (text) onStart(text); }}
              placeholder="Ej: Quiero una tienda de ropa, quiero tokenizar un terreno..."
              leftSlot={<VoiceMicButton accent="emerald" onText={setHubInput} />}
            />
          </div>

          {/* Agent cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {SUBAGENTS.map((agent) => (
              <Link
                key={agent.href}
                href={agent.href}
                className="group rounded-xl border border-border bg-muted/30 p-4 hover:bg-muted/60 hover:border-emerald-500/30 transition-all"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${agent.color} mb-3`}>
                  <agent.icon className="size-4" />
                </div>
                <div className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                  {agent.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {agent.desc}
                </p>
              </Link>
            ))}
          </div>

          {/* Recent conversations */}
          {recent.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                Recientes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {recent.slice(0, 6).map((item) => {
                  const Icon = agentIcon[item.agent] || Globe;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/50 hover:border-border transition-all min-w-0"
                    >
                      <Icon className="size-3.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-foreground truncate">{item.title}</div>
                        <div className="text-2xs text-muted-foreground truncate">{item.subtitle}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ManuDevPage() {
  const { isMobile, setOpenMobile } = useSidebar();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectParam = searchParams.get("project");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("pick_type");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [showCms, setShowCms] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<"running" | "done" | "error" | null>(null);
  const [buildDegraded, setBuildDegraded] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("auto");
  const [entryMode, setEntryMode] = useState<GenerationMode | null>(null);
  const [recommendedMode, setRecommendedMode] = useState<"next" | "lite" | null>(null);
  const [liteEligible, setLiteEligible] = useState<boolean | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [pendingBuildPid, setPendingBuildPid] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LiteTemplateId | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<AgentInputHandle>(null);
  const buildingRef = useRef(false);
  const [sendBtnPressed, setSendBtnPressed] = useState(false);

  function triggerSendPress() {
    setSendBtnPressed(true);
    setTimeout(() => setSendBtnPressed(false), 150);
  }

  // Fetch user roles on mount
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          const roles = d.user?.roles || d.roles || [];
          setUserRoles(Array.isArray(roles) ? roles : []);
        }
      })
      .catch(() => {});
  }, []);

  // Determine plan tier from roles
  const isFreeUser = userRoles.length === 0 || (userRoles.some((r) => r === "nl360_free") && !userRoles.some((r) => /^nl360_(basic|pro|elite)$/.test(r) || r === "nl_setters" || r === "administrator"));
  const isBasicUser = userRoles.some((r) => r === "nl360_basic");
  const hasNextAccess = userRoles.some((r) => /^nl360_(pro|elite)$/.test(r) || r === "nl_setters" || r === "administrator");

  // Available modes for mode picker
  const availableModes: ModeOption[] = (() => {
    const modes: ModeOption[] = [
      { id: "lite_plus", label: "Lite+", desc: "IA genera HTML unico" },
    ];
    if (hasNextAccess) {
      modes.push({ id: "next", label: "Next.js", desc: "Sitio premium con React" });
    }
    return modes;
  })();

  // Load project from URL param (?project=ID) — re-runs on param change
  useEffect(() => {
    if (!projectParam) return;

    fetch("/api/manu-dev/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const project = Array.isArray(d?.projects)
          ? d.projects.find((p: any) => String(p.id) === projectParam)
          : null;
        if (!project) return;
        setProjectId(project.id);
        if (project.site_url) {
          setSiteUrl(project.site_url);
          setStarted(true);
          setShowCms(true);
        }
      })
      .catch(() => {});
  }, [projectParam]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/manu-dev/generation-mode?project_id=${projectId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.mode) setGenerationMode(d.mode);
        if (d?.recommended_mode) setRecommendedMode(d.recommended_mode);
        if (typeof d?.lite_eligible === "boolean") setLiteEligible(d.lite_eligible);
      })
      .catch(() => {});
  }, [projectId]);

  async function updateGenerationMode(mode: GenerationMode) {
    setGenerationMode(mode);
    if (!projectId || modeSaving) {
      return;
    }

    setModeSaving(true);
    try {
      const res = await fetch("/api/manu-dev/generation-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, mode }),
      });
      if (res.ok) {
        setGenerationMode(mode);
      } else {
        setBuildLogs((prev) => [...prev, "No se pudo guardar el modo de generacion."]);
      }
    } catch {
      setBuildLogs((prev) => [...prev, "Error de red al guardar el modo de generacion."]);
    } finally {
      setModeSaving(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startBuild(pid: number, overrideMode?: string, template?: string) {
    setBuildLogs(["Iniciando proceso de construccion..."]);
    setBuildStatus("running");
    setLoading(true);
    setPendingBuildPid(null);

    const mode = overrideMode || generationMode;

    try {
      const res = await fetch("/api/manu-dev/create-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: pid, generation_mode: mode, ...(template ? { template } : {}) }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}));
        setBuildLogs((prev) => [...prev, toUiErrorMessage(errJson?.error || "Error al iniciar la construccion.")]);
        setBuildStatus("error");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let parsed: any;
          try { parsed = JSON.parse(line.slice(6)); } catch { continue; }

          if (parsed.message) {
            setBuildLogs((prev) => [...prev, parsed.message]);
          }
          if (parsed.mode && parsed.status !== "done") {
            setBuildLogs((prev) => [...prev, `Modo efectivo: ${parsed.mode}`]);
          }
          if (parsed.status === "mode_degraded") setBuildDegraded(true);
          if (parsed.status === "done") {
            setSiteUrl(parsed.url);
            setStep("complete");
            setBuildStatus("done");
            setBuildDegraded(false);
            setMessages((prev) => [...prev, {
              id: uid(), role: "assistant",
              content: `Tu sitio web esta listo!\n${parsed.url}`,
            }]);
          }
          if (parsed.status === "error") {
            setBuildStatus("error");
          }
        }
      }
    } catch (err: any) {
      setBuildLogs((prev) => [...prev, `Error: ${toUiErrorMessage(err?.message)}`]);
      setBuildStatus("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (!projectId) return;
    const formData = new FormData();
    formData.append("project_id", String(projectId));
    formData.append("file", file);
    try {
      const res = await fetch("/api/manu-dev/logo", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        // Notify user that logo was uploaded
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "user", content: "Logo subido correctamente." },
        ]);
        await sendMessage("Ya subi mi logo", { skipUserMsg: true });
      } else {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: `No pude subir el logo: ${json.error}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: "Error al subir el logo. Intenta de nuevo." },
      ]);
    }
  }

  async function sendMessage(
    text: string,
    opts: { silent?: boolean; skipUserMsg?: boolean; pid?: number | null; initialMode?: GenerationMode; newConversation?: boolean } = {}
  ) {
    if (!opts.silent && !opts.skipUserMsg) {
      const userMsg: Message = { id: uid(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
    }
    setLoading(true);
    const effectivePid = opts.pid !== undefined ? opts.pid : projectId;

    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    let triggerBuildPid: number | null = null;

    try {
      const res = await fetch("/api/manu-dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          project_id: effectivePid,
          generation_mode: opts.initialMode ?? generationMode,
          ...(opts.newConversation && { new_conversation: true }),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Error de red" }));
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: toUiErrorMessage(err.error, "Error al conectar"), streaming: false } : m
        ));
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let parsed: any;
          try { parsed = JSON.parse(raw); } catch { continue; }

          if (parsed.error) {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, content: parsed.error, streaming: false } : m
            ));
            break;
          }
          if (parsed.text) {
            accumulated += parsed.text;
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated, streaming: true } : m
            ));
          }
          if (parsed.logoGenerating) {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, logoGenerating: true, streaming: false } : m
            ));
          }
          if (parsed.done) {
            const newStep = parsed.step as Step;
            const newPid = parsed.project_id ?? projectId;
            if (parsed.step) setStep(newStep);
            if (parsed.project_id) setProjectId(parsed.project_id);
            if (parsed.mode) setGenerationMode(parsed.mode as GenerationMode);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    // Use cleanText from backend to include any text that came after markers
                    content: parsed.cleanText || accumulated,
                    streaming: false,
                    logoGenerating: false,
                    options: parsed.options ?? [],
                    colors: parsed.colors,
                    fonts: parsed.fonts,
                    upload: parsed.upload,
                    logoPreview: parsed.logoPreview,
                  }
                : m
            ));
            if (newStep === "building" && newPid && !buildingRef.current) {
              buildingRef.current = true;
              triggerBuildPid = newPid;
            }
            if (parsed.step === "redirect_nubia") {
              // M2: Pass the DB-stored handoff id instead of the full JSON in the URL
              const params = new URLSearchParams();
              if (parsed.handoffId) {
                params.set("handoff_id", String(parsed.handoffId));
              }
              router.push(`/services/nubia?${params.toString()}`);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: toUiErrorMessage(err?.message, "Error de conexion. Intenta de nuevo."), streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
      if (triggerBuildPid) {
        if (isFreeUser) {
          // Free users only have lite_plus — start immediately, no picker needed
          startBuild(triggerBuildPid, "lite_plus");
        } else if (isBasicUser || hasNextAccess) {
          // Paid users pick their generation mode (lite_plus or next)
          setPendingBuildPid(triggerBuildPid);
        } else {
          // Fallback: start immediately with lite_plus
          startBuild(triggerBuildPid, "lite_plus");
        }
      }
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    if (!started) {
      // First message — start conversation with auto mode (server resolves per plan)
      setEntryMode("auto");
      setGenerationMode("auto");
      setStarted(true);
      await sendMessage(text, { newConversation: true, initialMode: "auto" });
    } else {
      await sendMessage(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSendPress();
      handleSubmit();
    }
  }

  // ── CMS view ──────────────────────────────────────────────────────────────
  if (showCms && projectId && siteUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          {isMobile && (
            <button
              onClick={() => setOpenMobile(true)}
              aria-label="Abrir menú lateral"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <Menu className="size-3" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-2xs">
              <Globe className="size-3" />
            </div>
            <span className="text-sm font-semibold text-foreground">Manu Dev</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">Panel de administracion</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CmsPanel
            projectId={projectId}
            siteUrl={siteUrl}
            onBack={() => setShowCms(false)}
          />
        </div>
      </div>
    );
  }

  // ── Welcome screen ─────────────────────────────────────────────────────
  // ── Hub / Welcome screen ─────────────────────────────────────────────────
  if (!started) {
    return <ManuDevHub
      isMobile={isMobile}
      setOpenMobile={setOpenMobile}
      onStart={(text: string) => {
        setInput(text);
        setStarted(true);
        setTimeout(() => {
          setGenerationMode("auto");
          sendMessage(text, { newConversation: true, initialMode: "auto" });
        }, 0);
      }}
    />;
  }

  // ── Chat view ─────────────────────────────────────────────────────────────
  const isBlocked = loading || (step === "building" && !pendingBuildPid);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex-shrink-0">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setOpenMobile(true)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  title="Abrir menu"
                >
                  <Menu className="size-4" />
                </button>
              )}
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                <Globe className="size-3.5" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">Manu Dev</span>
            </div>
            {siteUrl && (
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <ExternalLink className="size-3" />
                  <span className="hidden sm:inline">Ver sitio</span>
                </a>
                {step === "complete" && (
                  <button
                    onClick={() => setShowCms(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    <Wand2 className="size-3" />
                    <span className="hidden sm:inline">Administrar</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <StepIndicator current={step} />
          <div className="mt-2">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xxs text-muted-foreground hover:bg-muted transition-colors"
            >
              <ChevronRight className={`size-3 transition-transform ${advancedOpen ? "rotate-90" : ""}`} />
              Opciones avanzadas
            </button>
            {advancedOpen && (
              <div className="mt-2 rounded-xl border border-border bg-muted/40 p-2.5 sm:p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xxs text-muted-foreground">Modo de generacion:</span>
                  {(hasNextAccess ? ["lite_plus", "next"] as GenerationMode[] : ["lite_plus"] as GenerationMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateGenerationMode(m)}
                      disabled={modeSaving || loading}
                      className={[
                        "rounded-full px-2.5 py-1 text-xxs font-medium border transition-colors",
                        generationMode === m
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-border text-foreground hover:bg-emerald-500/10 hover:border-emerald-500/40",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  Modo activo: {generationMode === "auto" ? "lite_plus" : generationMode}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="pointer-events-none sticky top-0 z-10 h-10 bg-gradient-to-b from-background to-transparent" />
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 pb-6 space-y-5 -mt-10 pt-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              markdown={false}
              onOption={(opt) => {
                if (!loading) {
                  setMessages((prev) => prev.map((m) =>
                    m.id === msg.id ? { ...m, options: [] } : m
                  ));
                  sendMessage(opt);
                }
              }}
            >
              {/* Color swatches */}
              {msg.colors && msg.colors.length > 0 && !msg.streaming && (
                <ColorSwatches colors={msg.colors} />
              )}
              {/* Font preview */}
              {msg.fonts && msg.fonts.length > 0 && !msg.streaming && (
                <FontPreview fonts={msg.fonts} />
              )}
              {/* Logo generating skeleton */}
              {msg.logoGenerating && !msg.logoPreview && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-20 w-20 rounded-xl border border-border bg-muted animate-pulse flex-shrink-0" />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="animate-spin size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Generando logo con IA...</span>
                    </div>
                    <p className="text-xxs text-muted-foreground/60">Esto puede tardar unos segundos</p>
                  </div>
                </div>
              )}
              {/* Logo preview */}
              {msg.logoPreview && !msg.streaming && (
                <div className="mt-3 space-y-2">
                  <img
                    src={msg.logoPreview}
                    alt="Logo generado"
                    className="h-32 w-32 rounded-xl border border-border object-contain bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground">Logo generado con IA</p>
                </div>
              )}
              {/* Logo upload area */}
              {msg.upload === "logo" && !msg.streaming && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 hover:bg-muted transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  <Upload className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Haz clic para subir tu logo</span>
                </label>
              )}
            </ChatBubble>
          ))}
          {/* Template / Mode picker before build */}
          {pendingBuildPid && !buildStatus && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <ModePicker
                modes={availableModes}
                onSelect={(modeId) => {
                  setGenerationMode(modeId as GenerationMode);
                  startBuild(pendingBuildPid, modeId);
                }}
              />
            </div>
          )}
          {/* Mode degraded banner */}
          {buildDegraded && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-3 text-sm">
              <span className="text-amber-400 mt-0.5">⚠️</span>
              <p className="text-amber-200 flex-1">
                El modo <strong>PRO</strong> no estaba disponible.
                Tu sitio se construyó con <strong>Lite+</strong>.
              </p>
              <button
                onClick={() => setBuildDegraded(false)}
                className="text-amber-400/60 hover:text-amber-400 transition-colors ml-2"
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          )}
          {/* Build terminal */}
          {buildStatus && (
            <BuildTerminal logs={buildLogs} status={buildStatus} />
          )}
          {/* Thinking indicator */}
          {loading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <div className="flex justify-start">
              <div className="flex gap-1 px-1 py-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          {/* CTA after complete */}
          {step === "complete" && siteUrl && !showCms && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => setShowCms(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors"
              >
                <Wand2 className="size-4" />
                Abrir panel de administracion
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-background px-2 sm:px-4 pt-2 sm:pt-3 pb-5 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <AgentInput
            ref={inputRef}
            accent="emerald"
            value={input}
            onChange={setInput}
            onSend={() => handleSubmit()}
            sending={loading}
            disabled={isBlocked || step === "complete"}
            placeholder={
              pendingBuildPid ? "Elige una opcion arriba para continuar..."
              : step === "building" ? "Construyendo tu sitio..."
              : step === "complete" ? "El sitio ya esta listo. Usa el panel para editarlo."
              : "Escribe tu mensaje..."
            }
            leftSlot={<VoiceMicButton accent="emerald" onText={setInput} disabled={isBlocked || step === "complete"} />}
          />
        </div>
      </div>
    </div>
  );
}

export default function ManuDevPageWrapper() {
  return (
    <Suspense>
      <ManuDevPage />
    </Suspense>
  );
}
