import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

// Keep in sync with sessions/route.ts
const MAX_APPEND_BYTES = 512 * 1024; // 512 KB per append call

type IncomingMsg = {
  id?: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp?: string;
};

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// POST /api/mentoria/sessions/[id]/messages
// Body: { baseSeq: number, messages: IncomingMsg[] }
// Appends messages starting at seq = baseSeq (the count the client thinks the
// server has). If baseSeq doesn't match the server count we return 409 and the
// client must fall back to a full upsert.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const cl = Number(req.headers.get("content-length") || 0);
  if (cl > MAX_APPEND_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", maxBytes: MAX_APPEND_BYTES },
      { status: 413 }
    );
  }

  let body: { baseSeq?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const baseSeq = Number(body.baseSeq);
  if (!Number.isInteger(baseSeq) || baseSeq < 0) {
    return NextResponse.json({ error: "invalid_baseSeq" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "invalid_messages" }, { status: 400 });
  }
  const incoming = body.messages as IncomingMsg[];
  for (const m of incoming) {
    if (!m || typeof m !== "object") {
      return NextResponse.json({ error: "invalid_messages" }, { status: 400 });
    }
    if (m.role !== "user" && m.role !== "agent" && m.role !== "system") {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }
    if (typeof m.content !== "string") {
      return NextResponse.json({ error: "invalid_content" }, { status: 400 });
    }
  }

  await ensureTables();
  const pool = getPool();

  // Verify ownership and not trashed
  const [sessRows] = (await pool.execute(
    `SELECT id FROM mt_sessions
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];
  if (!sessRows || sessRows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cntRows] = (await conn.execute(
      `SELECT COUNT(*) AS c FROM mt_messages WHERE session_id = ?`,
      [id]
    )) as any[];
    const serverSeq = Number(cntRows[0]?.c ?? 0);

    if (baseSeq !== serverSeq) {
      await conn.rollback();
      return NextResponse.json(
        { error: "seq_mismatch", serverSeq },
        { status: 409 }
      );
    }

    // Insert new rows starting at seq = baseSeq
    for (let i = 0; i < incoming.length; i++) {
      const m = incoming[i];
      const msgId = (m.id && String(m.id).slice(0, 64)) || `${id}-${baseSeq + i}`;
      await conn.execute(
        `INSERT INTO mt_messages (session_id, seq, msg_id, role, content, ts)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          baseSeq + i,
          msgId,
          m.role,
          m.content,
          m.timestamp ? new Date(m.timestamp) : new Date(),
        ]
      );
    }

    // Bump updated_at on the session for history ordering
    await conn.execute(
      `UPDATE mt_sessions
          SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [id]
    );

    await conn.commit();
    return NextResponse.json({
      ok: true,
      appended: incoming.length,
      newSeq: baseSeq + incoming.length,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("[mt_messages append] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } finally {
    conn.release();
  }
}
