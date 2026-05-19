import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPool,
  ensureTables,
  getUserId,
  maybePurgeTrash,
  TRASH_RETENTION_DAYS,
} from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

// tool is now any registered subagent id (validated via the registry).
import { isValidAgentId } from "@/lib/mentoria/agents";
type ToolType = string;

// Max payload for a full session POST/PUT (JSON string of messages + metadata).
// MySQL JSON columns allow up to ~1GB but the real bottleneck is the network
// and memory. 2MB keeps lengthy chats working while blocking runaway growth.
const MAX_SESSION_BYTES = 2 * 1024 * 1024;

async function auth(): Promise<{ token: string; userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { token, userId };
}

// GET /api/mentoria/sessions?tool=X&before=<iso>&limit=20&q=<text>&trashed=1
// Returns list of sessions (no full messages — just metadata + message_count).
// Cursor-based pagination: pass `before` = `updated_at` of the last row
// received to fetch the next page. Optional `q` filters by title. When
// `trashed=1` is set, only soft-deleted rows are returned (trash view).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tool = req.nextUrl.searchParams.get("tool") as ToolType | null;
  if (!tool || !isValidAgentId(tool)) {
    return NextResponse.json({ error: "invalid_tool" }, { status: 400 });
  }

  // limit: 1..100, default 20
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
      ? Math.floor(limitRaw)
      : 20;

  // before: ISO timestamp cursor
  const beforeRaw = req.nextUrl.searchParams.get("before");
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? beforeRaw : null;

  // q: simple LIKE on title (case-insensitive)
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);

  // trashed: "1" / "true" → only deleted rows; default → only active rows
  const trashedParam = req.nextUrl.searchParams.get("trashed");
  const trashed = trashedParam === "1" || trashedParam === "true";

  await ensureTables();
  // Opportunistic purge of old trash (rate-limited internally).
  void maybePurgeTrash();
  const pool = getPool();

  const where: string[] = ["user_id = ?", "tool = ?"];
  const params: any[] = [session.userId, tool];
  if (trashed) {
    where.push("deleted_at IS NOT NULL");
  } else {
    where.push("deleted_at IS NULL");
  }
  if (before) {
    // For trash, cursor uses deleted_at; for active, updated_at.
    where.push(trashed ? "deleted_at < ?" : "updated_at < ?");
    params.push(before);
  }
  if (q) {
    where.push("title LIKE ?");
    params.push(`%${q}%`);
  }
  // LIMIT cannot be a bound param in some mysql2 setups — inline safe integer.
  const orderCol = trashed ? "deleted_at" : "updated_at";
  const sql = `SELECT id, title, updated_at, deleted_at,
                      JSON_LENGTH(messages) AS message_count
               FROM mt_sessions
               WHERE ${where.join(" AND ")}
               ORDER BY ${orderCol} DESC
               LIMIT ${limit + 1}`;
  const [rows] = (await pool.execute(sql, params)) as any[];

  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && sessions.length > 0
      ? new Date(sessions[sessions.length - 1][orderCol]).toISOString()
      : null;

  return NextResponse.json({
    sessions,
    hasMore,
    nextCursor,
    trashRetentionDays: TRASH_RETENTION_DAYS,
  });
}

// POST /api/mentoria/sessions
// Body: { id, tool, title, messages[] }
// Upsert — creates if not exists, updates if exists (client generates UUID).
// If the session was soft-deleted, writing to it restores it automatically.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Reject oversized payloads before parsing (defence in depth).
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_SESSION_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", maxBytes: MAX_SESSION_BYTES },
      { status: 413 }
    );
  }

  let body: { id: string; tool: ToolType; title: string; messages: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { id, tool, title, messages } = body;
  if (!id || !tool || !isValidAgentId(tool) || !Array.isArray(messages)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const messagesJson = JSON.stringify(messages);
  if (Buffer.byteLength(messagesJson, "utf8") > MAX_SESSION_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", maxBytes: MAX_SESSION_BYTES },
      { status: 413 }
    );
  }

  await ensureTables();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO mt_sessions (id, user_id, tool, title, messages)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title      = VALUES(title),
         messages   = VALUES(messages),
         updated_at = CURRENT_TIMESTAMP,
         deleted_at = NULL`,
      [id, session.userId, tool, title.slice(0, 200), messagesJson]
    );

    // Sync mt_messages: wholesale replace so legacy clients still work.
    await conn.execute(`DELETE FROM mt_messages WHERE session_id = ?`, [id]);
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i] as {
        id?: string;
        role?: string;
        content?: string;
        timestamp?: string;
      };
      if (!m || typeof m !== "object") continue;
      if (m.role !== "user" && m.role !== "agent" && m.role !== "system") continue;
      const content = typeof m.content === "string" ? m.content : "";
      const msgId = (m.id && String(m.id).slice(0, 64)) || `${id}-${i}`;
      await conn.execute(
        `INSERT INTO mt_messages (session_id, seq, msg_id, role, content, ts)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          i,
          msgId,
          m.role,
          content,
          m.timestamp ? new Date(m.timestamp) : new Date(),
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("[mt_sessions upsert] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true, seq: messages.length });
}
