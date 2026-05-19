import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-jordan";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

type ToolType = "CLOSER" | "LEADS";
const VALID_TOOLS: ToolType[] = ["CLOSER", "LEADS"];

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// GET /api/jordan/sessions?tool=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tool = req.nextUrl.searchParams.get("tool") as ToolType | null;
  if (!tool || !VALID_TOOLS.includes(tool)) {
    return NextResponse.json({ error: "invalid_tool" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, title, updated_at,
            JSON_LENGTH(messages) AS message_count
     FROM jd_sessions
     WHERE user_id = ? AND tool = ?
     ORDER BY updated_at DESC
     LIMIT 20`,
    [session.userId, tool]
  ) as any[];

  return NextResponse.json({ sessions: rows });
}

// POST /api/jordan/sessions — upsert
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id: string; tool: ToolType; title: string; messages: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { id, tool, title, messages } = body;
  if (!id || !tool || !VALID_TOOLS.includes(tool) || !Array.isArray(messages)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();
  await pool.execute(
    `INSERT INTO jd_sessions (id, user_id, tool, title, messages)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title      = VALUES(title),
       messages   = VALUES(messages),
       updated_at = CURRENT_TIMESTAMP`,
    [id, session.userId, tool, String(title).slice(0, 200), JSON.stringify(messages)]
  );

  return NextResponse.json({ ok: true });
}
