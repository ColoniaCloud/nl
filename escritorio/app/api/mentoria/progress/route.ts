import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";
import { getAgent, isValidAgentId } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

async function auth(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return (await getUserId(token)) || null;
}

interface ProgressRow {
  user_id: number;
  tool: string;
  current_lesson: number;
  completed: number[];
  deliverables: Record<string, string>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

async function getOrCreateProgress(
  userId: number,
  tool: string
): Promise<ProgressRow> {
  const p = getPool();
  const [rows] = (await p.execute(
    `SELECT user_id, tool, current_lesson, completed, deliverables,
            started_at, updated_at, completed_at
       FROM mt_progress
      WHERE user_id = ? AND tool = ?`,
    [userId, tool]
  )) as any[];
  if (rows.length > 0) {
    const r = rows[0];
    return {
      ...r,
      completed: typeof r.completed === "string" ? JSON.parse(r.completed) : r.completed ?? [],
      deliverables:
        typeof r.deliverables === "string" ? JSON.parse(r.deliverables) : r.deliverables ?? {},
    };
  }
  await p.execute(
    `INSERT INTO mt_progress (user_id, tool, current_lesson, completed, deliverables)
     VALUES (?, ?, 1, JSON_ARRAY(), JSON_OBJECT())`,
    [userId, tool]
  );
  return {
    user_id: userId,
    tool,
    current_lesson: 1,
    completed: [],
    deliverables: {},
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  };
}

// GET /api/mentoria/progress?tool=NAPOLEON  →  current progress + agent metadata
export async function GET(req: NextRequest) {
  await ensureTables();
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tool = req.nextUrl.searchParams.get("tool");
  if (!tool || !isValidAgentId(tool)) {
    return NextResponse.json({ error: "invalid_tool" }, { status: 400 });
  }
  const agent = await getAgent(tool);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  const progress = await getOrCreateProgress(userId, tool);
  const currentLesson = agent.lessons.find((l) => l.id === progress.current_lesson) || null;
  return NextResponse.json({
    ok: true,
    progress: {
      tool,
      currentLessonId: progress.current_lesson,
      completed: progress.completed,
      deliverables: progress.deliverables,
      totalLessons: agent.totalLessons,
      isComplete: progress.completed.length >= agent.totalLessons,
      startedAt: progress.started_at,
      updatedAt: progress.updated_at,
      completedAt: progress.completed_at,
    },
    currentLesson: currentLesson
      ? { id: currentLesson.id, title: currentLesson.title, slug: currentLesson.slug }
      : null,
    lessons: agent.lessons.map((l) => ({ id: l.id, title: l.title, slug: l.slug })),
  });
}

// POST /api/mentoria/progress   action: "advance" | "reset" | "set_deliverable"
export async function POST(req: NextRequest) {
  await ensureTables();
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const tool = String(body.tool || "");
  const action = String(body.action || "");
  if (!isValidAgentId(tool)) {
    return NextResponse.json({ error: "invalid_tool" }, { status: 400 });
  }
  const agent = await getAgent(tool);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  const p = getPool();
  const current = await getOrCreateProgress(userId, tool);

  if (action === "advance") {
    const lessonId = Number(body.lessonId || current.current_lesson);
    const completed = new Set<number>(current.completed);
    completed.add(lessonId);
    const nextLesson = Math.min(lessonId + 1, agent.totalLessons);
    const isComplete = completed.size >= agent.totalLessons;
    await p.execute(
      `UPDATE mt_progress
          SET current_lesson = ?,
              completed = CAST(? AS JSON),
              completed_at = ${isComplete ? "NOW()" : "NULL"}
        WHERE user_id = ? AND tool = ?`,
      [nextLesson, JSON.stringify(Array.from(completed)), userId, tool]
    );
    return NextResponse.json({
      ok: true,
      currentLessonId: nextLesson,
      completed: Array.from(completed),
      isComplete,
    });
  }

  if (action === "reset") {
    await p.execute(
      `UPDATE mt_progress
          SET current_lesson = 1,
              completed = JSON_ARRAY(),
              deliverables = JSON_OBJECT(),
              completed_at = NULL,
              started_at = NOW()
        WHERE user_id = ? AND tool = ?`,
      [userId, tool]
    );
    return NextResponse.json({ ok: true, currentLessonId: 1, completed: [] });
  }

  if (action === "set_deliverable") {
    const lessonId = Number(body.lessonId);
    const text = String(body.text || "").slice(0, 20000);
    if (!Number.isFinite(lessonId) || lessonId < 1) {
      return NextResponse.json({ error: "bad_lesson" }, { status: 400 });
    }
    const deliverables = { ...current.deliverables, [String(lessonId)]: text };
    await p.execute(
      `UPDATE mt_progress
          SET deliverables = CAST(? AS JSON)
        WHERE user_id = ? AND tool = ?`,
      [JSON.stringify(deliverables), userId, tool]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
