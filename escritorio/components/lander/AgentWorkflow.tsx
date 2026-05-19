"use client";

import { useEffect, useState, useRef } from "react";
import {
  Globe,
  Megaphone,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  GraduationCap,
} from "lucide-react";

type AgentStatus = "idle" | "working" | "done";

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  output: string;
}

interface WorkflowEvent {
  from: string;
  to: string;
  label: string;
  delay: number;
}

const AGENTS: Agent[] = [
  {
    id: "user",
    name: "Cliente",
    role: "Solicitud inicial",
    icon: <Zap className="size-5" />,
    color: "border-violet-500/60 bg-violet-500/10",
    glow: "shadow-violet-500/20",
    output: "Quiero crecer mi negocio online",
  },
  {
    id: "manu-dev",
    name: "Manu Dev",
    role: "Genera tu sitio Next.js",
    icon: <Globe className="size-5" />,
    color: "border-sky-500/60 bg-sky-500/10",
    glow: "shadow-sky-500/20",
    output: "Sitio generado y desplegado en 45s",
  },
  {
    id: "margarita",
    name: "Margarita",
    role: "Marketing en redes",
    icon: <Megaphone className="size-5" />,
    color: "border-pink-500/60 bg-pink-500/10",
    glow: "shadow-pink-500/20",
    output: "3 posts + campaña de lanzamiento publicados",
  },
  {
    id: "mentoria",
    name: "MentorIA",
    role: "Formacion y onboarding",
    icon: <GraduationCap className="size-5" />,
    color: "border-amber-500/60 bg-amber-500/10",
    glow: "shadow-amber-500/20",
    output: "Equipo capacitado con agente mentor",
  },
];

const EVENTS: WorkflowEvent[] = [
  { from: "user", to: "manu-dev", label: "nueva solicitud", delay: 800 },
  { from: "manu-dev", to: "margarita", label: "sitio en vivo", delay: 2400 },
  { from: "margarita", to: "mentoria", label: "campana activa", delay: 4000 },
  { from: "mentoria", to: "user", label: "onboarding listo", delay: 5600 },
];

const CYCLE_MS = 8000;

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === "working")
    return <Loader2 className="size-3.5 animate-spin text-amber-400" />;
  if (status === "done")
    return <CheckCircle2 className="size-3.5 text-emerald-400" />;
  return <Clock className="size-3.5 text-zinc-600" />;
}

export default function AgentWorkflow() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({
    user: "idle",
    "manu-dev": "idle",
    margarita: "idle",
    mentoria: "idle",
  });
  const [activeEdge, setActiveEdge] = useState<string | null>(null);
  const [log, setLog] = useState<{ text: string; ts: number }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function runCycle() {
      setStatuses({ user: "idle", "manu-dev": "idle", margarita: "idle", mentoria: "idle" });
      setActiveEdge(null);
      setLog([]);

      setTimeout(() => {
        setStatuses((s) => ({ ...s, user: "working" }));
      }, 200);

      EVENTS.forEach((ev, i) => {
        setTimeout(() => {
          setActiveEdge(`${ev.from}-${ev.to}`);
          setLog((l) => [
            ...l,
            { text: `[${ev.from}] → [${ev.to}]: ${ev.label}`, ts: Date.now() },
          ]);
          setStatuses((s) => ({ ...s, [ev.from]: "done", [ev.to]: "working" }));
        }, ev.delay);

        setTimeout(() => {
          setActiveEdge(null);
        }, ev.delay + 600);

        if (i === EVENTS.length - 1) {
          setTimeout(() => {
            setStatuses((s) => ({ ...s, mentoria: "done", user: "done" }));
          }, ev.delay + 700);
        }
      });
    }

    runCycle();
    cycleRef.current = setInterval(runCycle, CYCLE_MS);
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const edgeKey = (a: string, b: string) => `${a}-${b}`;

  return (
    <section className="mt-20 mb-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3.5 py-1.5 text-xs text-zinc-400 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Agentes en tiempo real
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
          Tu equipo de IA{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
            trabajando junto
          </span>
        </h2>
        <p className="text-zinc-500 text-sm max-w-lg mx-auto">
          Cada agente se especializa en una tarea. Cuando colaboran, tu negocio
          se construye, despliega y promociona solo.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-8 backdrop-blur-sm">
        <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0 items-center">
          {AGENTS.map((agent, idx) => {
            const status = statuses[agent.id];
            const isActive = status === "working";
            const isDone = status === "done";
            const nextAgent = AGENTS[idx + 1];
            const edgeActive = nextAgent
              ? activeEdge === edgeKey(agent.id, nextAgent.id)
              : false;

            return (
              <>
                <div
                  key={agent.id}
                  className={`
                    relative flex flex-col items-center gap-3 p-5 rounded-xl border transition-all duration-500
                    ${agent.color}
                    ${isActive ? `shadow-lg ${agent.glow} scale-105` : ""}
                    ${isDone ? "opacity-80" : "opacity-60"}
                    ${status === "idle" ? "opacity-40" : ""}
                  `}
                >
                  <div className="absolute -top-2 -right-2 flex items-center justify-center h-5 w-5 rounded-full bg-zinc-900 border border-zinc-700">
                    <StatusIcon status={status} />
                  </div>

                  <div
                    className={`
                      flex items-center justify-center h-10 w-10 rounded-xl
                      ${isActive ? "text-white" : "text-zinc-400"}
                      transition-colors duration-300
                    `}
                  >
                    {agent.icon}
                  </div>

                  <div className="text-center">
                    <div
                      className={`text-sm font-semibold transition-colors duration-300 ${
                        isActive ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {agent.name}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {agent.role}
                    </div>
                  </div>

                  {isDone && (
                    <div className="text-[10px] text-emerald-400/80 text-center leading-tight mt-1 animate-fade-in">
                      {agent.output}
                    </div>
                  )}

                  {isActive && (
                    <span className="absolute inset-0 rounded-xl border border-white/20 animate-ping opacity-30" />
                  )}
                </div>

                {nextAgent && (
                  <div
                    key={`edge-${agent.id}`}
                    className="hidden md:flex flex-col items-center justify-center px-2 gap-1 transition-all duration-300"
                  >
                    <ArrowRight
                      className={`
                        size-4 transition-all duration-300
                        ${edgeActive ? "text-white scale-125" : "text-zinc-700"}
                      `}
                    />
                    {edgeActive && (
                      <span className="text-[9px] text-zinc-500 whitespace-nowrap animate-fade-in">
                        {EVENTS.find(
                          (e) => edgeKey(e.from, e.to) === activeEdge
                        )?.label}
                      </span>
                    )}
                  </div>
                )}
              </>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.05] bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
              Activity log
            </span>
          </div>
          <div
            ref={logRef}
            className="space-y-1 max-h-24 overflow-y-auto scrollbar-none"
          >
            {log.length === 0 && (
              <p className="text-[11px] text-zinc-700 font-mono">
                Esperando eventos...
              </p>
            )}
            {log.map((entry, i) => (
              <p
                key={i}
                className="text-[11px] text-zinc-400 font-mono animate-fade-in"
              >
                <span className="text-zinc-600 mr-2">
                  {new Date(entry.ts).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                {entry.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
