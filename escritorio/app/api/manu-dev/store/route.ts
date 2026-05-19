import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUserId(token: string): Promise<number | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.ok) { const d = await res.json(); return d.user?.id ?? null; }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res2.ok) return null;
  return (await res2.json()).id ?? null;
}

// GET /api/manu-dev/store?project_id=X — returns store status and info
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const project_id = Number(req.nextUrl.searchParams.get("project_id"));
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  const [proj] = await pool.execute(
    "SELECT id, has_store, store_info FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1",
    [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const p = proj[0];
  let storeInfo = null;
  try { storeInfo = p.store_info ? JSON.parse(p.store_info) : null; } catch {}

  return NextResponse.json({ has_store: !!p.has_store, store_info: storeInfo });
}

// POST /api/manu-dev/store — activate store or update store_info
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const project_id = Number(body?.project_id);
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  const [proj] = await pool.execute(
    "SELECT id, has_store FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1",
    [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Update has_store flag and optionally store_info
  if (body.store_info !== undefined) {
    await pool.execute(
      "UPDATE md_projects SET has_store = 1, store_info = ? WHERE id = ? AND user_id = ?",
      [JSON.stringify(body.store_info), project_id, userId]
    );
  } else {
    await pool.execute(
      "UPDATE md_projects SET has_store = 1 WHERE id = ? AND user_id = ?",
      [project_id, userId]
    );
  }

  return NextResponse.json({ success: true, has_store: true });
}
