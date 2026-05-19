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

// GET /api/manu-dev/products?project_id=X
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

  const [products] = await pool.execute(
    "SELECT * FROM md_products WHERE project_id = ? ORDER BY id DESC", [project_id]
  ) as any;
  const [cats] = await pool.execute(
    "SELECT * FROM md_product_categories WHERE project_id = ? ORDER BY name", [project_id]
  ) as any;

  return NextResponse.json({ products, categories: cats });
}

// POST /api/manu-dev/products
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
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
  const tags = Array.isArray(body.tags) ? body.tags : [];

  const [result] = await pool.execute(
    `INSERT INTO md_products (project_id, category_id, name, description, price, sale_price, images, tags, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [project_id, body.category_id || null, String(body.name || "").slice(0, 255),
     String(body.description || ""), body.price || null, body.sale_price || null,
     JSON.stringify(images), JSON.stringify(tags)]
  ) as any;

  return NextResponse.json({ success: true, id: result.insertId });
}

// PATCH /api/manu-dev/products
export async function PATCH(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const product_id = Number(body?.id);
  const project_id = Number(body?.project_id);
  if (!product_id || !project_id) return NextResponse.json({ error: "id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const fields = ["name", "description", "price", "sale_price", "category_id", "active"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const f of fields) {
    if (body[f] !== undefined) { updates.push(`${f} = ?`); values.push(body[f]); }
  }
  if (body.images !== undefined) { updates.push("images = ?"); values.push(JSON.stringify(Array.isArray(body.images) ? body.images.slice(0, 3) : [])); }
  if (body.tags !== undefined) { updates.push("tags = ?"); values.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : [])); }

  if (!updates.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  values.push(product_id, project_id);

  await pool.execute(`UPDATE md_products SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`, values);
  return NextResponse.json({ success: true });
}

// DELETE /api/manu-dev/products?id=X&project_id=Y
export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const product_id = Number(searchParams.get("id"));
  const project_id = Number(searchParams.get("project_id"));
  if (!product_id || !project_id) return NextResponse.json({ error: "id y project_id requeridos" }, { status: 400 });

  const pool = getPool();
  if (!await assertOwner(pool, project_id, userId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await pool.execute("DELETE FROM md_products WHERE id = ? AND project_id = ?", [product_id, project_id]);
  return NextResponse.json({ success: true });
}
