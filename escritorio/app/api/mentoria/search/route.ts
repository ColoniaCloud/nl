import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";
import { isValidAgentId } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const MAX_QUERY_LEN = 100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SNIPPET_RADIUS = 60;

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

/** Build a small contextual snippet around the first match of q in text. */
function makeSnippet(text: string, q: string): string {
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + needle.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

// GET /api/mentoria/search?q=...&tool=NAPOLEON&limit=20
// Searches mt_messages (FULLTEXT) scoped to the authenticated user's
// non-trashed sessions. Returns one hit per session (the best match).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") || "").trim().slice(0, MAX_QUERY_LEN);
  const toolParam = searchParams.get("tool");
  const tool = toolParam && isValidAgentId(toolParam) ? toolParam : null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));

  if (q.length < 2) {
    return NextResponse.json({ results: [], reason: "query_too_short" });
  }

  await ensureTables();
  const pool = getPool();

  // MATCH ... AGAINST requires a 4-char minimum for the default ft_min_word_len;
  // we also fall back to LIKE for short queries. Here we always union both
  // strategies to be resilient (LIKE handles substrings, MATCH handles relevance).
  const likePattern = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;

  const toolClause = tool ? "AND s.tool = ?" : "";
  const sqlParams: (string | number)[] = [session.userId];
  if (tool) sqlParams.push(tool);

  // Strategy: pick the best (most recent) matching message per session.
  // We do a subquery to rank rows, then aggregate to one row per session.
  const sql = `
    SELECT s.id            AS session_id,
           s.tool          AS tool,
           s.title         AS title,
           s.updated_at    AS updated_at,
           m.role          AS role,
           m.content       AS content,
           m.seq           AS seq
      FROM mt_messages m
      JOIN mt_sessions s ON s.id = m.session_id
     WHERE s.user_id = ?
       ${toolClause}
       AND s.deleted_at IS NULL
       AND (m.content LIKE ? OR MATCH(m.content) AGAINST (? IN NATURAL LANGUAGE MODE))
     ORDER BY s.updated_at DESC, m.seq DESC
     LIMIT ?
  `;
  sqlParams.push(likePattern, q, limit * 4); // fetch extra to dedupe by session

  const [rows] = (await pool.execute(sql, sqlParams)) as any[];

  // Dedupe: keep the first (newest) hit per session, cap to limit.
  const seen = new Set<string>();
  const results: Array<{
    sessionId: string;
    tool: string;
    title: string;
    updatedAt: string;
    role: string;
    snippet: string;
    seq: number;
  }> = [];
  for (const r of rows || []) {
    if (seen.has(r.session_id)) continue;
    seen.add(r.session_id);
    results.push({
      sessionId: r.session_id,
      tool: r.tool,
      title: r.title,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      role: r.role,
      snippet: makeSnippet(String(r.content || ""), q),
      seq: Number(r.seq),
    });
    if (results.length >= limit) break;
  }

  return NextResponse.json({ results, query: q });
}
