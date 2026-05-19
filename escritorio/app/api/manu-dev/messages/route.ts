import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUserId(token: string): Promise<number | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (res.ok) { const d = await res.json(); return d.user?.id ?? null; }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!res2.ok) return null;
  const d2 = await res2.json();
  return d2.id ?? null;
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = Number(searchParams.get("project_id"));
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = 20;
  const offset = (page - 1) * limit;

  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  const [proj] = await pool.execute(
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const whereUnread = unreadOnly ? " AND read_at IS NULL" : "";
  const [messages] = await pool.execute(
    `SELECT id, name, email, phone, subject, message, read_at, created_at
     FROM md_messages WHERE project_id = ?${whereUnread}
     ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [project_id]
  ) as any;

  const [countRow] = await pool.execute(
    "SELECT COUNT(*) as total, SUM(read_at IS NULL) as unread FROM md_messages WHERE project_id = ?",
    [project_id]
  ) as any;

  return NextResponse.json({
    messages, page,
    total: Number(countRow[0]?.total || 0),
    unread: Number(countRow[0]?.unread || 0),
  });
}

export async function PATCH(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const message_id = Number(body?.message_id);
  const project_id = Number(body?.project_id);
  if (!message_id || !project_id) return NextResponse.json({ error: "message_id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  const [proj] = await pool.execute(
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  await pool.execute(
    "UPDATE md_messages SET read_at = NOW() WHERE id = ? AND project_id = ? AND read_at IS NULL",
    [message_id, project_id]
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const message_id = Number(searchParams.get("message_id"));
  const project_id = Number(searchParams.get("project_id"));
  if (!message_id || !project_id) return NextResponse.json({ error: "message_id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  const [proj] = await pool.execute(
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  await pool.execute("DELETE FROM md_messages WHERE id = ? AND project_id = ?", [message_id, project_id]);
  return NextResponse.json({ success: true });
}
