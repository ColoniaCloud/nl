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

// GET /api/manu-dev/design?project_id=X
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
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const [rows] = await pool.execute(
    "SELECT * FROM md_design WHERE project_id = ? LIMIT 1", [project_id]
  ) as any;

  return NextResponse.json({ design: rows[0] || null });
}

// PATCH /api/manu-dev/design — update colors and/or fonts
export async function PATCH(req: NextRequest) {
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
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [project_id, userId]
  ) as any;
  if (!proj.length) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const allowed = ["primary_color", "secondary_color", "accent_color", "font_heading", "font_body"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(String(body[key]).slice(0, 100));
    }
  }
  if (!updates.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  values.push(project_id);
  await pool.execute(
    `UPDATE md_design SET ${updates.join(", ")} WHERE project_id = ?`, values
  );

  const [rows] = await pool.execute("SELECT * FROM md_design WHERE project_id = ? LIMIT 1", [project_id]) as any;
  return NextResponse.json({ design: rows[0] || null });
}
