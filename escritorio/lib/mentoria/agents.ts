// Registry of MentorIA subagents. Each subagent has a persona, a curriculum
// loaded from JSON, and a provider (anthropic or venice) used for chat.
//
// To add a new subagent:
//   1. Create data/mentoria/<id>.json with lessons + persona
//   2. Register it below in AGENTS
//   3. No other code needs to change.
import { promises as fs } from "fs";
import path from "path";

export type Provider = "anthropic" | "venice" | "nvidia_nim";

export interface Lesson {
  id: number;
  slug: string;
  title: string;
  objectives: string[];
  keyConcepts: string[];
  sourceContext: string;
  advanceCriteria: string[];
  deliverable: string;
  estimatedTurns: number;
}

export interface Curriculum {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  provider: Provider;
  model: string;
  temperature?: number;
  requiresConfirmation?: boolean;
  disclaimer?: string;
  persona: {
    voice: string;
    style: string;
  };
  totalLessons: number;
  welcome: {
    content: string;
    options: string[];
  };
  completionMessage: string;
  lessons: Lesson[];
  promptFile: string;
  resolvedSystemPrompt?: string; // runtime — populated by getAgent(), not in JSON
}

export interface AgentSummary {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  provider: Provider;
  requiresConfirmation?: boolean;
  disclaimer?: string;
  totalLessons: number;
  welcome: {
    content: string;
    options: string[];
  };
}

// Enumerated subagent IDs. Using string (not enum) so adding one requires
// only a JSON file + a line in AGENTS.
const AGENTS: Array<{ id: string; file: string }> = [
  { id: "NAPOLEON", file: "napoleon.json" },
  { id: "NEVILLE_DISRUPTIVO_1", file: "neville-disruptivo-1.json" },
  { id: "NEVILLE_DISRUPTIVO_2", file: "neville-disruptivo-2.json" },
  { id: "TONY_PROFUNDO", file: "tony-profundo.json" },
  { id: "TONY_DISRUPTIVO", file: "tony-disruptivo.json" },
];

const DATA_DIR = path.join(process.cwd(), "data", "mentoria");

// Simple in-process cache — curriculums are static JSON files loaded once.
const cache = new Map<string, Curriculum>();

export function listAgentIds(): string[] {
  return AGENTS.map((a) => a.id);
}

export function isValidAgentId(id: string): boolean {
  return AGENTS.some((a) => a.id === id);
}

export async function getAgent(id: string): Promise<Curriculum | null> {
  if (!isValidAgentId(id)) return null;
  const cached = cache.get(id);
  if (cached) return cached;
  const entry = AGENTS.find((a) => a.id === id);
  if (!entry) return null;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, entry.file), "utf8");
    const parsed = JSON.parse(raw) as Curriculum;
    const promptRaw = await fs.readFile(
      path.join(DATA_DIR, "prompts", parsed.promptFile),
      "utf8"
    );
    parsed.resolvedSystemPrompt = promptRaw.trim();
    cache.set(id, parsed);
    return parsed;
  } catch (e) {
    console.error(`[agents] failed to load curriculum ${id}:`, e);
    return null;
  }
}

export async function listAgentSummaries(): Promise<AgentSummary[]> {
  const out: AgentSummary[] = [];
  for (const a of AGENTS) {
    const c = await getAgent(a.id);
    if (!c) continue;
    out.push({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      icon: c.icon,
      provider: c.provider,
      requiresConfirmation: c.requiresConfirmation,
      disclaimer: c.disclaimer,
      totalLessons: c.totalLessons,
      welcome: c.welcome,
    });
  }
  return out;
}

// Build the system prompt for a given subagent + current lesson state.
// The prompt includes: persona, current lesson context, progress summary,
// and the [AVANZAR] directive rules.
export function buildSystemPrompt(
  agent: Curriculum,
  state: {
    currentLessonId: number;
    completed: number[];
    userName?: string;
  }
): string {
  const lesson =
    agent.lessons.find((l) => l.id === state.currentLessonId) || agent.lessons[0];
  const completedCount = state.completed.length;
  const isComplete = completedCount >= agent.totalLessons;

  const parts: string[] = [];

  parts.push(agent.resolvedSystemPrompt ?? "");
  parts.push("");

  if (isComplete) {
    parts.push("## Estado del curso: COMPLETADO");
    parts.push(`El alumno completo las ${agent.totalLessons} lecciones. Estas en modo de consolidacion y practica.`);
    parts.push("Responde preguntas de repaso, ayudalo a aplicar lo aprendido, sugiere ejercicios.");
    parts.push("No hay mas [AVANZAR] — el curso ya termino.");
    parts.push("");
    parts.push("Mensaje oficial de cierre que ya le diste:");
    parts.push(`> ${agent.completionMessage}`);
    return parts.join("\n");
  }

  parts.push(`## Progreso del alumno`);
  parts.push(`- Lecciones completadas: ${completedCount} de ${agent.totalLessons}`);
  parts.push(`- Leccion actual: ${lesson.id} — ${lesson.title}`);
  parts.push("");
  parts.push(`## Leccion actual (foco de esta conversacion)`);
  parts.push(`**Titulo:** ${lesson.title}`);
  parts.push("");
  parts.push(`**Objetivos de esta leccion:**`);
  lesson.objectives.forEach((o) => parts.push(`- ${o}`));
  parts.push("");
  parts.push(`**Conceptos clave a cubrir:**`);
  lesson.keyConcepts.forEach((k) => parts.push(`- ${k}`));
  parts.push("");
  parts.push(`**Contexto y material fuente:**`);
  parts.push(lesson.sourceContext);
  parts.push("");
  parts.push(`**Criterios para avanzar a la siguiente leccion:**`);
  lesson.advanceCriteria.forEach((c) => parts.push(`- ${c}`));
  parts.push("");
  parts.push(`**Entregable esperado al cerrar la leccion:**`);
  parts.push(lesson.deliverable);
  parts.push("");
  parts.push("## Directiva [AVANZAR]");
  parts.push("Cuando consideres que el alumno CUMPLE los criterios de avance de esta leccion (comprendio los conceptos, produjo un entregable razonable, esta listo), CIERRA la leccion con un breve resumen y termina tu mensaje con el marcador literal:");
  parts.push("");
  parts.push("[AVANZAR]");
  parts.push("");
  parts.push("en una linea aparte al final del mensaje. Ese marcador lo detecta el sistema y avanza el progreso. No lo pongas en cada mensaje — solo cuando realmente proceda. No lo comentes al alumno.");

  return parts.join("\n");
}
