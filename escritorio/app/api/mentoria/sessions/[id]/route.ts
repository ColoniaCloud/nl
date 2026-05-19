import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

// Keep in sync with MAX_SESSION_BYTES in ../route.ts
const MAX_SESSION_BYTES = 2 * 1024 * 1024;

async function auth(): Promise<{ token: string; userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { token, userId };
}

// GET /api/mentoria/sessions/[id]
// Returns full session including messages array
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  await ensureTables();
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT id, tool, title, messages, updated_at, deleted_at
       FROM mt_sessions
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = rows[0];

  // Prefer relational log (mt_messages) if populated — that's the canonical
  // source of truth since Sprint 4. Fall back to the JSON blob for legacy
  // sessions that pre-date the migration.
  const [msgRows] = (await pool.execute(
    `SELECT msg_id, role, content, ts
       FROM mt_messages
      WHERE session_id = ?
      ORDER BY seq ASC`,
    [id]
  )) as any[];

  let messages: unknown;
  if (msgRows && msgRows.length > 0) {
    messages = msgRows.map((r: any) => ({
      id: r.msg_id,
      role: r.role,
      content: r.content,
      timestamp: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
    }));
  } else {
    messages = typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages;
  }

  return NextResponse.json({
    id: row.id,
    tool: row.tool,
    title: row.title,
    messages,
    seq: msgRows?.length ?? 0,
    updated_at: row.updated_at,
  });
}

// PUT /api/mentoria/sessions/[id]
// Body: { title?: string, messages?: unknown[] }
// Supports partial updates: title-only (rename) or messages-only.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { title?: string; messages?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasTitle = typeof body.title === "string";
  const hasMessages = Array.isArray(body.messages);
  if (!hasTitle && !hasMessages) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: any[] = [];
  if (hasTitle) {
    sets.push("title = ?");
    values.push(String(body.title).slice(0, 200));
  }
  if (hasMessages) {
    const messagesJson = JSON.stringify(body.messages);
    if (Buffer.byteLength(messagesJson, "utf8") > MAX_SESSION_BYTES) {
      return NextResponse.json(
        { error: "payload_too_large", maxBytes: MAX_SESSION_BYTES },
        { status: 413 }
      );
    }
    sets.push("messages = ?");
    values.push(messagesJson);
  }
  // Always refresh updated_at so renaming bumps it in the history ordering.
  sets.push("updated_at = CURRENT_TIMESTAMP");

  await ensureTables();
  const pool = getPool();
  const [result] = (await pool.execute(
    `UPDATE mt_sessions SET ${sets.join(", ")}
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [...values, id, session.userId]
  )) as any[];

  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/mentoria/sessions/[id]?permanent=1
// Default: soft-delete (sets deleted_at = NOW()). Trash is auto-purged after
// 30 days (see lib/db-mentoria.ts TRASH_RETENTION_DAYS).
// With ?permanent=1: hard-delete, only allowed if the session is already in
// the trash — a safeguard against accidental destruction.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get("permanent");
  const isPermanent = permanent === "1" || permanent === "true";

  await ensureTables();
  const pool = getPool();

  if (isPermanent) {
    // Require the row to be already trashed before we nuke it.
    const [result] = (await pool.execute(
      `DELETE FROM mt_sessions
        WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [id, session.userId]
    )) as any[];
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "not_in_trash" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, permanent: true });
  }

  // Soft-delete (idempotent — re-deleting an already-trashed row is fine).
  const [result] = (await pool.execute(
    `UPDATE mt_sessions
        SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];
  if (result.affectedRows === 0) {
    // Check whether the row even exists for a cleaner error
    const [rows] = (await pool.execute(
      `SELECT id FROM mt_sessions WHERE id = ? AND user_id = ?`,
      [id, session.userId]
    )) as any[];
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Already trashed — still a success for idempotency.
  }
  return NextResponse.json({ ok: true, permanent: false });
}

// POST /api/mentoria/sessions/[id]/restore is mapped through a PATCH here to
// avoid a second route file. Body: { action: "restore" }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "restore") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();
  const [result] = (await pool.execute(
    `UPDATE mt_sessions
        SET deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
    [id, session.userId]
  )) as any[];
  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "not_found_or_not_trashed" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
