import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

// Sonnet offers far better synthesis quality than Haiku for long chats.
// Overridable via env in case the default identifier changes.
const CLAUDE_MODEL =
  process.env.MENTORIA_SUMMARY_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

import { isValidAgentId, getAgent } from "@/lib/mentoria/agents";
type ToolType = string;

async function resolveToolLabel(tool: string): Promise<string> {
  const agent = await getAgent(tool);
  if (!agent) return tool;
  return agent.subtitle ? `${agent.title} — ${agent.subtitle}` : agent.title;
}

interface StoredMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

function buildSystemPrompt(toolLabel: string): string {
  return `Eres MentorIA, un mentor senior generando un RESUMEN EJECUTIVO del progreso de un alumno en el curso "${toolLabel}".

Tu tarea es producir un documento claro, estructurado y motivador que el alumno pueda descargar en PDF para consultar su avance.

INCLUYE obligatoriamente estas secciones en orden:
1. Resumen general del progreso (2-3 parrafos)
2. Temas y modulos cubiertos
3. Conceptos clave aprendidos (lista)
4. Insights personales del alumno (lo que mostro entender o aplicar)
5. Areas donde profundizar o pendientes
6. Recomendaciones concretas para continuar (3-5 acciones)

REGLAS DE FORMATO:
- Escribe en texto plano, SIN markdown, SIN asteriscos, SIN numerales de encabezado.
- Separa secciones con titulos en MAYUSCULAS seguidos de dos puntos y salto de linea.
- Parrafos cortos, legibles.
- Idioma: espanol neutral con tuteo.
- Tono: didactico, inspirador, firme y calido — como un mentor que te conoce.
- No uses viñetas con simbolos raros; usa guiones simples "- " para listas.
- No repitas literalmente los mensajes; sintetiza el aprendizaje.`;
}

function messagesToTranscript(messages: StoredMessage[]): string {
  return messages
    .filter((m) => m.id !== "init")
    .map((m) => {
      const who = m.role === "user" ? "ALUMNO" : "MENTORIA";
      return `[${who}]\n${m.content}`;
    })
    .join("\n\n");
}

// ─── POST: generate summary ───────────────────────────────────────────────────
// Body: { sessionId: string } OR { tool: ToolType, messages: StoredMessage[] }
// The first form reads the session server-side (recommended, no retransmit).
// The second is a fallback if the chat hasn't been persisted yet.
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserId(token);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    sessionId?: string;
    tool?: ToolType;
    messages?: StoredMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  let tool: ToolType | undefined;
  let messages: StoredMessage[] = [];

  if (body.sessionId) {
    await ensureTables();
    const pool = getPool();
    const [rows] = (await pool.execute(
      `SELECT tool, messages FROM mt_sessions
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [body.sessionId, userId]
    )) as any[];
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    tool = rows[0].tool as ToolType;

    // Prefer relational log (canonical since Sprint 4)
    const [msgRows] = (await pool.execute(
      `SELECT role, content, ts
         FROM mt_messages
        WHERE session_id = ?
        ORDER BY seq ASC`,
      [body.sessionId]
    )) as any[];
    if (msgRows && msgRows.length > 0) {
      messages = msgRows.map((r: any) => ({
        id: "",
        role: r.role,
        content: r.content,
        timestamp: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
      })) as StoredMessage[];
    } else {
      const raw = rows[0].messages;
      messages = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } else if (body.tool && Array.isArray(body.messages)) {
    if (!isValidAgentId(body.tool)) {
      return NextResponse.json({ ok: false, error: "invalid_tool" }, { status: 400 });
    }
    tool = body.tool;
    messages = body.messages;
  } else {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  if (userMsgCount === 0) {
    return NextResponse.json(
      { ok: false, error: "empty_session" },
      { status: 400 }
    );
  }

  const toolLabel = await resolveToolLabel(tool!);
  const transcript = messagesToTranscript(messages);

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(toolLabel),
      messages: [
        {
          role: "user",
          content: `Este es el historial completo de la conversacion de mentoria. Genera el resumen ejecutivo siguiendo el formato indicado.\n\n---\n\n${transcript}`,
        },
      ],
    });

    const reply = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    if (!reply) {
      return NextResponse.json(
        { ok: false, error: "empty_response" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      reply,
      tool,
      toolLabel,
      provider: "claude-sonnet",
    });
  } catch (e: any) {
    console.error("[MentorIA][summary] error:", e?.message);
    return NextResponse.json(
      { ok: false, error: "No se pudo generar el resumen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
