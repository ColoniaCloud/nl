import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
// Default lifetime: 30 days. Configurable per request within 1..365 days.
const DEFAULT_TTL_DAYS = 30;
const MIN_TTL_DAYS = 1;
const MAX_TTL_DAYS = 365;

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

function generateToken(): string {
  // 24 random bytes → 32 base64url chars. ~192 bits of entropy.
  return crypto.randomBytes(24).toString("base64url");
}

// GET: list active shares for this session (owner only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await ensureTables();
  const pool = getPool();

  // Verify session ownership before exposing shares.
  const [sRows] = (await pool.execute(
    `SELECT id FROM mt_sessions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];
  if (!sRows || sRows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [rows] = (await pool.execute(
    `SELECT token, created_at, expires_at, revoked_at, view_count
       FROM mt_shares
      WHERE session_id = ? AND user_id = ?
      ORDER BY created_at DESC`,
    [id, session.userId]
  )) as any[];

  const shares = (rows || []).map((r: any) => ({
    token: r.token,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
    revokedAt: r.revoked_at
      ? r.revoked_at instanceof Date
        ? r.revoked_at.toISOString()
        : String(r.revoked_at)
      : null,
    viewCount: Number(r.view_count || 0),
    active: !r.revoked_at && new Date(r.expires_at).getTime() > Date.now(),
  }));

  return NextResponse.json({ ok: true, shares });
}

// POST: create a new share link
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { ttlDays?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — use defaults
  }

  let ttlDays = Number(body.ttlDays ?? DEFAULT_TTL_DAYS);
  if (!Number.isFinite(ttlDays)) ttlDays = DEFAULT_TTL_DAYS;
  ttlDays = Math.max(MIN_TTL_DAYS, Math.min(MAX_TTL_DAYS, Math.floor(ttlDays)));

  await ensureTables();
  const pool = getPool();

  // Ownership check
  const [sRows] = (await pool.execute(
    `SELECT id FROM mt_sessions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];
  if (!sRows || sRows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const token = generateToken();
  await pool.execute(
    `INSERT INTO mt_shares (token, session_id, user_id, expires_at)
     VALUES (?, ?, ?, (NOW() + INTERVAL ? DAY))`,
    [token, id, session.userId, ttlDays]
  );

  return NextResponse.json({
    ok: true,
    token,
    url: `/share/${token}`,
    ttlDays,
  });
}

// DELETE: revoke every active share for this session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await ensureTables();
  const pool = getPool();

  const [result] = (await pool.execute(
    `UPDATE mt_shares
        SET revoked_at = NOW()
      WHERE session_id = ? AND user_id = ? AND revoked_at IS NULL`,
    [id, session.userId]
  )) as any[];

  return NextResponse.json({
    ok: true,
    revoked: result?.affectedRows ?? 0,
  });
}
