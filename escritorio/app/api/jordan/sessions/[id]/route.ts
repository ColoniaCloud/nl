import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-jordan";
import { createLogger } from "@/lib/logger";

// DEPRECATED: use /api/jordan/conversations/[id] instead
export const runtime = "nodejs";

const logger = createLogger("Jordan");

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// GET /api/jordan/sessions/[id]  [DEPRECATED — use GET /api/jordan/conversations/[id]]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.warn("DEPRECATED endpoint /api/jordan/sessions/[id] GET — migrar a /api/jordan/conversations/[id]");
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, tool, title, messages, updated_at
     FROM jd_sessions WHERE id = ? AND user_id = ?`,
    [id, session.userId]
  ) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    id: row.id,
    tool: row.tool,
    title: row.title,
    messages: typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages,
    updated_at: row.updated_at,
  });
}

// PUT /api/jordan/sessions/[id]  [DEPRECATED]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.warn("DEPRECATED endpoint /api/jordan/sessions/[id] PUT");
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { title: string; messages: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { title, messages } = body;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE jd_sessions
     SET title = ?, messages = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [String(title || "").slice(0, 200), JSON.stringify(messages), id, session.userId]
  ) as any[];

  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/jordan/sessions/[id]  [DEPRECATED — use DELETE /api/jordan/conversations/[id]]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.warn("DEPRECATED endpoint /api/jordan/sessions/[id] DELETE — migrar a /api/jordan/conversations/[id]");
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  await ensureTables();
  const pool = getPool();
  await pool.execute(
    `DELETE FROM jd_sessions WHERE id = ? AND user_id = ?`,
    [id, session.userId]
  );

  return NextResponse.json({ ok: true });
}
