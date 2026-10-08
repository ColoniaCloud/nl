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
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "").slice(0, 200);
}

// GET /api/manu-dev/blog-posts?project_id=X
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const project_id = Number(req.nextUrl.searchParams.get("project_id"));
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [posts] = await pool.execute(
    "SELECT id, category_id, title, slug, summary, featured_image, tags, published, created_at, updated_at FROM md_blog_posts WHERE project_id = ? ORDER BY created_at DESC",
    [project_id]
  ) as any;
  const [cats] = await pool.execute("SELECT * FROM md_blog_categories WHERE project_id = ? ORDER BY name", [project_id]) as any;

  return NextResponse.json({ posts, categories: cats });
}

// GET single post: /api/manu-dev/blog-posts?project_id=X&id=Y
// Actually combined in GET above — for full content use ?id=Y
// POST - create
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const project_id = Number(body?.project_id);
  if (!project_id || !body?.title) return NextResponse.json({ error: "project_id y title requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const title = String(body.title).slice(0, 255);
  const slug = body.slug ? String(body.slug).slice(0, 200) : slugify(title);
  const tags = Array.isArray(body.tags) ? body.tags : [];

  let category_id = body.category_id ? Number(body.category_id) : null;
  if (category_id) {
    const [cat] = await pool.execute(
      "SELECT id FROM md_blog_categories WHERE id = ? AND project_id = ? LIMIT 1",
      [category_id, project_id]
    ) as any;
    if (!cat.length) category_id = null;
  }

  const [result] = await pool.execute(
    `INSERT INTO md_blog_posts (project_id, category_id, title, slug, summary, content, featured_image, tags, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [project_id, category_id, title, slug,
     String(body.summary || ""), String(body.content || ""),
     String(body.featured_image || "").slice(0, 500),
     JSON.stringify(tags), body.published ? 1 : 0]
  ) as any;

  return NextResponse.json({ success: true, id: result.insertId });
}

// PATCH - update
export async function PATCH(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const post_id = Number(body?.id);
  const project_id = Number(body?.project_id);
  if (!post_id || !project_id) return NextResponse.json({ error: "id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.category_id) {
    const [cat] = await pool.execute(
      "SELECT id FROM md_blog_categories WHERE id = ? AND project_id = ? LIMIT 1",
      [Number(body.category_id), project_id]
    ) as any;
    if (!cat.length) return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
  }

  const allowed = ["title", "slug", "summary", "content", "featured_image", "category_id", "published"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const f of allowed) {
    if (body[f] !== undefined) { updates.push(`${f} = ?`); values.push(body[f]); }
  }
  if (body.tags !== undefined) { updates.push("tags = ?"); values.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : [])); }

  if (!updates.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  values.push(post_id, project_id);

  await pool.execute(`UPDATE md_blog_posts SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`, values);
  return NextResponse.json({ success: true });
}

// DELETE
export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const post_id = Number(searchParams.get("id"));
  const project_id = Number(searchParams.get("project_id"));
  if (!post_id || !project_id) return NextResponse.json({ error: "id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await pool.execute("DELETE FROM md_blog_posts WHERE id = ? AND project_id = ?", [post_id, project_id]);
  return NextResponse.json({ success: true });
}
