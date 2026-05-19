import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";
import { isValidAgentId } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

type ToolType = string;

// MEDIUMTEXT holds up to 16MB; reject anything larger to protect the DB.
const MAX_NOTE_LENGTH = 64 * 1024; // 64 KB of text is generous for notes

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

function parseTool(raw: string | null): ToolType | null {
  if (!raw) return null;
  return isValidAgentId(raw) ? raw : null;
}

// GET /api/mentoria/notes?tool=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tool = parseTool(req.nextUrl.searchParams.get("tool"));
  if (!tool) return NextResponse.json({ error: "invalid_tool" }, { status: 400 });

  await ensureTables();
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT content, updated_at FROM mt_notes WHERE user_id = ? AND tool = ?`,
    [session.userId, tool]
  )) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ content: "", updated_at: null });
  }
  return NextResponse.json({
    content: rows[0].content,
    updated_at: rows[0].updated_at,
  });
}

// PUT /api/mentoria/notes  Body: { tool, content }
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { tool?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const tool = parseTool(body.tool ?? null);
  if (!tool) return NextResponse.json({ error: "invalid_tool" }, { status: 400 });

  const content = typeof body.content === "string" ? body.content : "";
  if (content.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: "note_too_large" }, { status: 413 });
  }

  await ensureTables();
  const pool = getPool();
  await pool.execute(
    `INSERT INTO mt_notes (user_id, tool, content)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       updated_at = CURRENT_TIMESTAMP`,
    [session.userId, tool, content]
  );

  return NextResponse.json({ ok: true });
}
