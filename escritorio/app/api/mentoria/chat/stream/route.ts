import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getPool, getUserId, ensureTables } from "@/lib/db-mentoria";
import { rateLimit } from "@/lib/rate-limit";
import { getAgent, buildSystemPrompt, isValidAgentId } from "@/lib/mentoria/agents";
import { getProvider, mapErrorToUserMessage, ChatMessage } from "@/lib/providers";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

const RATE_CAPACITY = 20;
const RATE_REFILL_PER_SEC = 1 / 3;

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthenticated(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) return true;
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res2.ok;
  } catch {
    return false;
  }
}

// ─── Progress helper ──────────────────────────────────────────────────────────

interface ProgressState {
  currentLessonId: number;
  completed: number[];
}

async function getOrInitProgress(
  userId: number,
  tool: string
): Promise<ProgressState> {
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
  return { currentLessonId: 1, completed: [] };
}

async function advanceProgress(
  userId: number,
  tool: string,
  lessonId: number,
  totalLessons: number
): Promise<{ currentLessonId: number; completed: number[]; isComplete: boolean }> {
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
  return {
    currentLessonId: nextLesson,
    completed: Array.from(completed),
    isComplete,
  };
}

// ─── POST: SSE stream ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await isAuthenticated(token))) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = await getUserId(token);
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bucketKey = `chat:${userId}`;
  const rl = rateLimit(bucketKey, RATE_CAPACITY, RATE_REFILL_PER_SEC);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "rate_limited",
        message: `Estas enviando mensajes muy rapido. Espera ${rl.resetSeconds}s.`,
        retryAfter: rl.resetSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.resetSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: {
    tool: string;
    history: { role: "user" | "model"; parts: string }[];
    message: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { tool, history = [], message } = body;
  if (!tool || !isValidAgentId(tool)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_tool" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await ensureTables();
  const agent = await getAgent(tool);
  if (!agent) {
    return new Response(JSON.stringify({ ok: false, error: "agent_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const progress = await getOrInitProgress(userId, tool);
  const system = buildSystemPrompt(agent, progress);
  const provider = getProvider(agent.provider);

  const messages: ChatMessage[] = [
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.parts,
    })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        let fullText = "";
        const advanceMarker = "[AVANZAR]";

        const iter = provider.streamChat({
          system,
          messages,
          model: agent.model,
          maxTokens: 2048,
          temperature: agent.temperature,
        });

        for await (const ev of iter) {
          if (ev.type === "delta") {
            fullText += ev.text;
            // Strip the [AVANZAR] marker from user-visible deltas. We still
            // keep it in fullText so we can detect it after the stream ends.
            const visible = ev.text.includes(advanceMarker)
              ? ev.text.replace(advanceMarker, "")
              : ev.text;
            if (visible) send("delta", { text: visible });
          }
        }

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

        send("done", {
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
        controller.close();
      } catch (e) {
        console.error("[MentorIA stream] error:", e);
        send("error", { message: mapErrorToUserMessage(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
