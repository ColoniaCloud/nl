"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faCheck,
  faArrowUpRightFromSquare,
  faWandMagicSparkles,
  faTriangleExclamation,
  faExpand,
  faCompress,
  faBars,
  faShop,
} from "@fortawesome/free-solid-svg-icons";
import {
  Package,
  ShoppingBag,
  CreditCard,
  Palette,
  RotateCcw,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChatBubble } from "@/components/chat/ChatBubble";
import NubiaProductManager from "@/components/nubia/NubiaProductManager";
import NubiaOrdersPanel from "@/components/nubia/NubiaOrdersPanel";
import NubiaPaymentConfig from "@/components/nubia/NubiaPaymentConfig";
import { TemplatePicker, ColorPalettePreview, NubiaFontPreview } from "@/components/nubia/NubiaVisualPickers";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  options?: string[];
  templatePicker?: boolean;
  colorPalettes?: Array<{ name: string; primary: string; secondary: string; accent: string }>;
  fontOptions?: Array<{ label: string; heading: string; body: string }>;
  selectedTemplate?: string;
}

type Step = "welcome" | "onboarding" | "ready" | "building" | "complete" | "cms";

type CmsTab = "products" | "orders" | "payments" | "design";

interface Project {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  site_url: string | null;
  template: string;
  industry: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  welcome: "Inicio",
  onboarding: "Configuracion",
  ready: "Configuracion",
  building: "Construyendo",
  complete: "Listo",
  cms: "Administrar",
};

const STEPS_FLOW: Step[] = ["welcome", "onboarding", "building", "complete"];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const displayStep: Step = current === "ready" ? "onboarding" : current;
  const idx = STEPS_FLOW.indexOf(displayStep);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {STEPS_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className={[
              "flex items-center gap-1 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[11px] font-medium whitespace-nowrap",
              done ? "bg-muted text-muted-foreground"
                : active ? "bg-foreground text-background"
                : "text-muted-foreground/40",
            ].join(" ")}>
              {done && <FontAwesomeIcon icon={faCheck} className="text-[9px]" />}
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
      <div className="flex items-center gap-2 bg-zinc-800 px-3 py-2 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <span className="ml-1 text-[11px] font-mono text-zinc-400 flex-1 text-center">
          NL360 Backoffice - Nubia v1.0 {status === "running" ? "construyendo" : status === "done" ? "listo" : "error"}
        </span>
        {status === "running" && (
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-zinc-400 text-[10px]" />
        )}
        {status === "done" && (
          <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-[10px]" />
        )}
        {status === "error" && (
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400 text-[10px]" />
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Minimizar" : "Ampliar consola"}
          className="ml-1 text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
        >
          <FontAwesomeIcon icon={expanded ? faCompress : faExpand} className="text-[10px]" />
        </button>
      </div>
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
              {line}
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

// ─── Main page ────────────────────────────────────────────────────────────────

function NubiaPageInner() {
  const { isMobile, setOpenMobile } = useSidebar();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectParam = searchParams.get("project");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [showCms, setShowCms] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<"running" | "done" | "error" | null>(null);
  const [cmsTab, setCmsTab] = useState<CmsTab>("products");
  const [sendBtnPressed, setSendBtnPressed] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [chosenTemplate, setChosenTemplate] = useState<string>("boutique");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buildingRef = useRef(false);

  function triggerSendPress() {
    setSendBtnPressed(true);
    setTimeout(() => setSendBtnPressed(false), 150);
  }

  // Load project from URL param
  useEffect(() => {
    if (!projectParam) return;
    fetch("/api/nubia/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const project = Array.isArray(d?.projects)
          ? d.projects.find((p: Project) => String(p.id) === projectParam)
          : null;
        if (!project) return;
        setActiveProject(project);
        setProjectId(project.id);
        if (project.site_url) {
          setSiteUrl(project.site_url);
          setStarted(true);
          setShowCms(true);
          setStep("cms");
        }
      })
      .catch(() => {});
  }, [projectParam]);

  // Handle Manu Dev -> Nubia handoff
  const handoffParam = searchParams.get("handoff");
  const handoffProcessed = useRef(false);
  useEffect(() => {
    if (!handoffParam || handoffProcessed.current) return;
    handoffProcessed.current = true;
    try {
      const data = JSON.parse(handoffParam);
      if (data.name) {
        setStarted(true);
        setStep("onboarding");
        // Build a summary message from the collected data
        const parts: string[] = [`Mi tienda se llama "${data.name}"`];
        if (data.industry) parts.push(`y vende ${data.industry}`);
        if (data.subdomain) parts.push(`El subdominio seria ${data.subdomain}`);
        if (data.colors?.primary) parts.push(`Colores: primario ${data.colors.primary}, secundario ${data.colors.secondary}, acento ${data.colors.accent}`);
        if (data.fonts?.heading) parts.push(`Fuentes: ${data.fonts.heading} para titulos y ${data.fonts.body} para texto`);
        if (data.email) parts.push(`Email: ${data.email}`);
        if (data.whatsapp) parts.push(`WhatsApp: ${data.whatsapp}`);
        const summaryMsg = parts.join(". ") + ". Vengo de Manu Dev y quiero crear una tienda completa con carrito y pagos.";
        // Auto-send as first message
        setMessages([{
          id: uid(),
          role: "assistant",
          content: "Hola! Veo que vienes de Manu Dev con datos de tu negocio. Voy a revisar la informacion y continuar desde aqui.",
        }]);
        setTimeout(() => sendMessage(summaryMsg), 500);
      }
    } catch {}
  }, [handoffParam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startBuild(pid: number) {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setStep("building");
    setBuildLogs(["Iniciando despliegue de la tienda..."]);
    setBuildStatus("running");
    setLoading(true);

    try {
      const res = await fetch("/api/nubia/create-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: pid }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}));
        setBuildLogs((prev) => [...prev, errJson?.error || "Error al iniciar el despliegue."]);
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

          if (parsed.type === "status" && parsed.message) {
            setBuildLogs((prev) => [...prev, parsed.message]);
          }
          if (parsed.type === "done") {
            setSiteUrl(parsed.site_url);
            setStep("complete");
            setBuildStatus("done");
            setBuildLogs((prev) => [...prev, `Tienda disponible en: ${parsed.site_url}`]);
            setMessages((prev) => [...prev, {
              id: uid(), role: "assistant",
              content: `**Tu tienda esta lista!**\n\nYa podes acceder en: ${parsed.site_url}\n\nDesde el **panel de administracion** podes:\n- Agregar y editar productos\n- Configurar metodos de pago\n- Personalizar colores y fuentes\n- Ver y gestionar pedidos`,
            }]);
          }
          if (parsed.type === "error") {
            setBuildStatus("error");
            setBuildLogs((prev) => [...prev, parsed.message || "Error en el despliegue."]);
          }
        }
      }
    } catch (err: any) {
      setBuildLogs((prev) => [...prev, `Error: ${err?.message || "Error desconocido"}`]);
      setBuildStatus("error");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string, opts: { skipUserMsg?: boolean } = {}) {
    if (!opts.skipUserMsg) {
      setMessages((prev) => [...prev, { id: uid(), role: "user", content: text }]);
    }
    setLoading(true);

    // Add streaming placeholder
    const assistantId = uid();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/nubia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, project_id: projectId, step: step === "welcome" ? "onboarding" : step }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: data.error || "Error al conectar", streaming: false }
            : m
        ));
        return;
      }

      const reply = data.reply || "";
      const newStep = data.step as Step;
      const newProjectId = data.project_id;

      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? {
          ...m,
          content: reply,
          streaming: false,
          templatePicker: data.templatePicker || undefined,
          colorPalettes: data.colorPalettes || undefined,
          fontOptions: data.fontOptions || undefined,
        } : m
      ));

      if (newStep) setStep(newStep as Step);
      if (newProjectId) setProjectId(newProjectId);
      if (data.subdomain) setSubdomain(data.subdomain);

      // If ready, auto-trigger build
      if (newStep === "ready" && (newProjectId || projectId) && !buildingRef.current) {
        const pidToUse = newProjectId || projectId;
        if (pidToUse) startBuild(pidToUse);
      }

    } catch (err: any) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "Error de conexion. Intenta de nuevo.", streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    if (!started) {
      setStarted(true);
      setStep("onboarding");
    }

    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSendPress();
      handleSubmit();
    }
  }

  // ── CMS view ──────────────────────────────────────────────────────────────
  if ((showCms || step === "cms") && (projectId || activeProject) && (siteUrl || activeProject?.site_url)) {
    const pid = projectId || activeProject!.id;
    const url = siteUrl || activeProject!.site_url!;
    const pname = activeProject?.name || subdomain || "Tienda";
    const psub = activeProject?.subdomain || subdomain || "";

    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          {isMobile && (
            <button
              onClick={() => setOpenMobile(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <FontAwesomeIcon icon={faBars} className="text-xs" />
            </button>
          )}
          <button
            onClick={() => {
              setShowCms(false);
              setStep("complete");
              if (!projectParam) router.push("/services/nubia");
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400 text-[10px]">
              <FontAwesomeIcon icon={faShop} />
            </div>
            <span className="text-sm font-semibold text-foreground">{pname}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex-1 min-w-0">
            <div className="flex gap-1 overflow-x-auto">
              {([
                { id: "products", label: "Productos", icon: Package },
                { id: "orders", label: "Ordenes", icon: ShoppingBag },
                { id: "payments", label: "Pagos", icon: CreditCard },
                { id: "design", label: "Diseno", icon: Palette },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setCmsTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0",
                    cmsTab === id
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
            <span className="hidden sm:inline">Ver tienda</span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {cmsTab === "products" && (
            <NubiaProductManager projectId={pid} industry={activeProject?.industry ?? null} />
          )}
          {cmsTab === "orders" && (
            <NubiaOrdersPanel projectId={pid} />
          )}
          {cmsTab === "payments" && (
            <NubiaPaymentConfig projectId={pid} />
          )}
          {cmsTab === "design" && (
            <NubiaDesignPanel projectId={pid} />
          )}
        </div>
      </div>
    );
  }

  // ── Welcome screen ─────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="flex h-full flex-col bg-background">
        {isMobile && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-border">
            <button
              onClick={() => setOpenMobile(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 text-xl">
              <FontAwesomeIcon icon={faShop} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Nubia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu agente para crear tiendas online. Te ayudo a configurar todo en minutos.
            </p>
            <p className="mt-4 text-base text-foreground font-medium">
              Como se llama tu tienda o negocio?
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-2 sm:px-4 py-2 sm:py-3">
          <div className="mx-auto w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: La Boutique de Ana, Sabores del Valle, Digital Pro..."
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-lg sm:rounded-xl border border-border bg-muted px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 min-h-[36px] sm:min-h-[42px] max-h-[120px]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={`flex h-9 w-9 sm:h-[42px] sm:w-[42px] flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all duration-150 ${sendBtnPressed ? "scale-90" : "scale-100"}`}
              >
                {loading
                  ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
                  : <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
                }
              </button>
            </form>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Enter para enviar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat view ─────────────────────────────────────────────────────────────
  const isBlocked = loading || step === "building";

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
                  <FontAwesomeIcon icon={faBars} className="text-sm" />
                </button>
              )}
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                <FontAwesomeIcon icon={faShop} />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">Nubia</span>
            </div>
            {siteUrl && (
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
                  <span className="hidden sm:inline">Ver tienda</span>
                </a>
                {step === "complete" && (
                  <button
                    onClick={() => setShowCms(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px]" />
                    <span className="hidden sm:inline">Administrar</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <StepIndicator current={step} />
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
              onOption={(opt) => {
                if (!loading) {
                  setMessages((prev) => prev.map((m) =>
                    m.id === msg.id ? { ...m, options: [] } : m
                  ));
                  sendMessage(opt);
                }
              }}
            >
              {msg.templatePicker && !msg.streaming && (
                <TemplatePicker onSelect={(template) => {
                  setChosenTemplate(template);
                  const label = { boutique: "Boutique", fresh: "Fresh", spark: "Spark", classic: "Classic", neon: "Neon", terra: "Terra" }[template] || template;
                  sendMessage(label);
                }} />
              )}
              {msg.colorPalettes && msg.colorPalettes.length > 0 && !msg.streaming && (
                <ColorPalettePreview
                  palettes={msg.colorPalettes}
                  template={chosenTemplate || "boutique"}
                  onSelect={(palette) => {
                    sendMessage(`${palette.name} (${palette.primary}, ${palette.secondary}, ${palette.accent})`);
                  }}
                />
              )}
              {msg.fontOptions && msg.fontOptions.length > 0 && !msg.streaming && (
                <NubiaFontPreview
                  options={msg.fontOptions}
                  onSelect={(opt) => {
                    sendMessage(`${opt.label} (${opt.heading} + ${opt.body})`);
                  }}
                />
              )}
            </ChatBubble>
          ))}
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
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex items-center gap-3">
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
                  Ver tienda
                </a>
                <button
                  onClick={() => setShowCms(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors"
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  Administrar tienda
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Desde el panel podes agregar productos, configurar pagos y personalizar el diseno de tu tienda.
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-background px-2 sm:px-4 py-2 sm:py-3">
        <div className="mx-auto w-full max-w-3xl">
          <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                step === "building" ? "Construyendo tu tienda..."
                  : step === "complete" ? "La tienda ya esta lista. Usa el panel para administrarla."
                  : "Escribe tu mensaje..."
              }
              disabled={isBlocked || step === "complete"}
              rows={1}
              className="flex-1 resize-none rounded-lg sm:rounded-xl border border-border bg-muted px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 min-h-[36px] sm:min-h-[42px] max-h-[120px]"
            />
            <button
              type="submit"
              disabled={isBlocked || !input.trim() || step === "complete"}
              className={`flex h-9 w-9 sm:h-[42px] sm:w-[42px] flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all duration-150 ${sendBtnPressed ? "scale-90" : "scale-100"}`}
            >
              {loading
                ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
                : <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
              }
            </button>
          </form>
          {step !== "complete" && (
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Enter para enviar · Shift+Enter para nueva linea
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NubiaPage() {
  return (
    <Suspense>
      <NubiaPageInner />
    </Suspense>
  );
}

// ─── Design Panel ─────────────────────────────────────────────────────────────

function NubiaDesignPanel({ projectId }: { projectId: number }) {
  const [design, setDesign] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/nubia/design?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => { setDesign(d.design ?? {}); setLoading(false); });
  }, [projectId]);

  async function save() {
    setSaving(true);
    await fetch("/api/nubia/design", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, ...design }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const FONTS = ["Inter", "Playfair Display", "Lora", "Poppins", "Roboto", "Montserrat", "Space Grotesk", "DM Sans", "Source Sans 3", "Raleway", "Open Sans", "Nunito"];

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-semibold text-foreground">Diseno de la tienda</h2>
      <p className="text-xs text-muted-foreground">Los cambios de diseno requieren reconstruir la tienda para aplicarse.</p>

      <div className="space-y-4">
        {[
          { key: "primary_color", label: "Color primario" },
          { key: "secondary_color", label: "Color secundario" },
          { key: "accent_color", label: "Color de acento" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-sm text-foreground w-36">{label}</label>
            <input
              type="color"
              value={design[key] || "#6366f1"}
              onChange={(e) => setDesign((p: any) => ({ ...p, [key]: e.target.value }))}
              className="w-10 h-10 rounded-xl border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={design[key] || ""}
              onChange={(e) => setDesign((p: any) => ({ ...p, [key]: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        ))}

        {[
          { key: "font_heading", label: "Fuente de titulos" },
          { key: "font_body", label: "Fuente de texto" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm text-foreground mb-1">{label}</label>
            <select
              value={design[key] || "Inter"}
              onChange={(e) => setDesign((p: any) => ({ ...p, [key]: e.target.value }))}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ))}

        <div>
          <label className="block text-sm text-foreground mb-1">Tagline</label>
          <input
            value={design.tagline || ""}
            onChange={(e) => setDesign((p: any) => ({ ...p, tagline: e.target.value }))}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500"
            placeholder="Tu tagline de la tienda..."
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        {saved ? "Guardado!" : "Guardar diseno"}
      </button>
    </div>
  );
}
