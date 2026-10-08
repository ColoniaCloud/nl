import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables } from "@/lib/db-mentoria";
import { rateLimit } from "@/lib/rate-limit";
import { checkAgentAccess } from "@/lib/billing-access";
import { getAgent, buildSystemPrompt, isValidAgentId } from "@/lib/mentoria/agents";
import { getProvider, mapErrorToUserMessage, ChatMessage } from "@/lib/providers";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

const RATE_CAPACITY = 20;
const RATE_REFILL_PER_SEC = 1 / 3;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

async function getOrInitProgress(userId: number, tool: string) {
  const p = getPool();
  const [rows] = (await p.execute(
    `SELECT current_lesson, completed FROM mt_progress WHERE user_id=? AND tool=?`,
    [userId, tool]
  )) as any[];
  if (rows.length > 0) {
    const completed = rows[0].completed;
    return {
      currentLessonId: rows[0].current_lesson || 1,
      completed: typeof completed === "string" ? JSON.parse(completed) : completed ?? [],
    };
  }
  await p.execute(
    `INSERT INTO mt_progress (user_id, tool, current_lesson, completed, deliverables)
     VALUES (?, ?, 1, JSON_ARRAY(), JSON_OBJECT())`,
    [userId, tool]
  );
  return { currentLessonId: 1, completed: [] as number[] };
}

async function advanceProgress(
  userId: number,
  tool: string,
  lessonId: number,
  totalLessons: number
) {
  const p = getPool();
  const current = await getOrInitProgress(userId, tool);
  const completed = new Set<number>(current.completed);
  completed.add(lessonId);
  const nextLesson = Math.min(lessonId + 1, totalLessons);
  const isComplete = completed.size >= totalLessons;
  await p.execute(
    `UPDATE mt_progress
        SET current_lesson = ?,
            completed = CAST(? AS JSON),
            completed_at = ${isComplete ? "NOW()" : "NULL"}
      WHERE user_id = ? AND tool = ?`,
    [nextLesson, JSON.stringify(Array.from(completed)), userId, tool]
  );
  return { currentLessonId: nextLesson, completed: Array.from(completed), isComplete };
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const user = await getUser(token);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // F3: Verificar acceso al agente por plan
  const agentCheck = checkAgentAccess(user.roles, "mentoria");
  if (!agentCheck.allowed) {
    return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
  }

  const userId = user.id;

  const rl = rateLimit(`chat:${userId}`, RATE_CAPACITY, RATE_REFILL_PER_SEC);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: `Estas enviando mensajes muy rapido. Espera ${rl.resetSeconds}s.`,
        retryAfter: rl.resetSeconds,
      },
      { status: 429, headers: { "Retry-After": String(rl.resetSeconds) } }
    );
  }

  let body: {
    tool?: string;
    history?: { role: "user" | "model"; parts: string }[];
    message?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // Si no hay body, permitimos el probe vacío
    return NextResponse.json({ ok: true });
  }

  const { tool, history = [], message } = body;
  // Permitir POST vacío para probe
  if (!tool && !message) {
    return NextResponse.json({ ok: true });
  }
  if (!tool || !isValidAgentId(tool)) {
    return NextResponse.json({ ok: false, error: "invalid_tool" }, { status: 400 });
  }

  await ensureTables();
  const agent = await getAgent(tool);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "agent_not_found" }, { status: 404 });
  }

  const progress = await getOrInitProgress(userId, tool);
  const system = buildSystemPrompt(agent, progress);
  const provider = getProvider(agent.provider);

  const messages: ChatMessage[] = [
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.parts ?? "",
    })),
    { role: "user", content: message ?? "" },
  ];

  try {
    let fullText = "";
    const iter = provider.streamChat({
      system,
      messages,
      model: agent.model,
      maxTokens: 2048,
    });
    for await (const ev of iter) {
      if (ev.type === "delta") fullText += ev.text;
    }
    const advanceMarker = "[AVANZAR]";
    const hasAdvance = fullText.includes(advanceMarker);
    const cleanReply = fullText.replace(advanceMarker, "").trim();

    let advanced: Awaited<ReturnType<typeof advanceProgress>> | null = null;
    if (hasAdvance) {
      advanced = await advanceProgress(
        userId,
        tool,
        progress.currentLessonId,
        agent.totalLessons
      );
    }

    return NextResponse.json({
      ok: true,
      reply: cleanReply,
      options: [],
      provider: agent.provider,
      advanced: advanced
        ? {
            fromLessonId: progress.currentLessonId,
            currentLessonId: advanced.currentLessonId,
            completed: advanced.completed,
            isComplete: advanced.isComplete,
          }
        : null,
    });
  } catch (e) {
    console.error("[MentorIA chat] error:", e);
    return NextResponse.json(
      { ok: false, error: "provider_error", message: mapErrorToUserMessage(e) },
      { status: 502 }
    );
  }
}
