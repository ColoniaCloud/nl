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

async function assertOwner(pool: any, projectId: number, userId: number) {
  const [r] = await pool.execute("SELECT id FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1", [projectId, userId]) as any;
  return r.length > 0;
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "").slice(0, 100);
}

// GET /api/manu-dev/categories?project_id=X&type=product|blog
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const project_id = Number(req.nextUrl.searchParams.get("project_id"));
  const type = req.nextUrl.searchParams.get("type") === "blog" ? "blog" : "product";
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const table = type === "blog" ? "md_blog_categories" : "md_product_categories";
  const [cats] = await pool.execute(`SELECT * FROM ${table} WHERE project_id = ? ORDER BY name`, [project_id]) as any;
  return NextResponse.json({ categories: cats, type });
}

// POST /api/manu-dev/categories
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const project_id = Number(body?.project_id);
  const type = body?.type === "blog" ? "blog" : "product";
  if (!project_id || !body?.name) return NextResponse.json({ error: "project_id y name requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const table = type === "blog" ? "md_blog_categories" : "md_product_categories";
  const name = String(body.name).slice(0, 255);
  const slug = body.slug ? String(body.slug).slice(0, 100) : slugify(name);

  const [result] = await pool.execute(
    `INSERT INTO ${table} (project_id, name, slug) VALUES (?, ?, ?)`,
    [project_id, name, slug]
  ) as any;

  return NextResponse.json({ success: true, id: result.insertId });
}

// DELETE /api/manu-dev/categories?id=X&project_id=Y&type=product|blog
export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cat_id = Number(searchParams.get("id"));
  const project_id = Number(searchParams.get("project_id"));
  const type = searchParams.get("type") === "blog" ? "blog" : "product";
  if (!cat_id || !project_id) return NextResponse.json({ error: "id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const table = type === "blog" ? "md_blog_categories" : "md_product_categories";
  await pool.execute(`DELETE FROM ${table} WHERE id = ? AND project_id = ?`, [cat_id, project_id]);
  return NextResponse.json({ success: true });
}
