import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureTables } from "@/lib/db-mentoria";
import { getAgent } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

async function resolveToolLabel(tool: string): Promise<string> {
  const a = await getAgent(tool);
  if (!a) return tool;
  return a.subtitle ? `${a.title} — ${a.subtitle}` : a.title;
}

// Public read-only endpoint. No auth — only the token gates access.
// GET /api/mentoria/shared/[token]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 10 || token.length > 64) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();

  const [rows] = (await pool.execute(
    `SELECT sh.token, sh.session_id, sh.expires_at, sh.revoked_at,
            s.tool, s.title, s.messages, s.updated_at, s.deleted_at
       FROM mt_shares sh
       JOIN mt_sessions s ON s.id = sh.session_id
      WHERE sh.token = ?`,
    [token]
  )) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const row = rows[0];

  if (row.revoked_at) {
    return NextResponse.json({ error: "revoked" }, { status: 410 });
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  // If the underlying session was moved to trash, hide the share too.
  if (row.deleted_at) {
    return NextResponse.json({ error: "unavailable" }, { status: 410 });
  }

  // Prefer relational source
  const [msgRows] = (await pool.execute(
    `SELECT role, content, ts FROM mt_messages
      WHERE session_id = ? ORDER BY seq ASC`,
    [row.session_id]
  )) as any[];

  let messages: Array<{ role: string; content: string; ts?: string }>;
  if (msgRows && msgRows.length > 0) {
    messages = msgRows.map((r: any) => ({
      role: r.role,
      content: r.content,
      ts: r.ts instanceof Date ? r.ts.toISOString() : String(r.ts),
    }));
  } else {
    const raw = typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages;
    messages = (Array.isArray(raw) ? raw : []).map((m: any) => ({
      role: String(m.role || "user"),
      content: String(m.content || ""),
      ts: m.timestamp ? String(m.timestamp) : undefined,
    }));
  }

  // Increment view count (best-effort)
  pool
    .execute(`UPDATE mt_shares SET view_count = view_count + 1 WHERE token = ?`, [token])
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    title: row.title,
    tool: row.tool,
    toolLabel: await resolveToolLabel(row.tool),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    expiresAt:
      row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    messages,
  });
}
