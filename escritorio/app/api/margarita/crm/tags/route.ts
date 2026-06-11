import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  try {
    const r = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (r.ok) {
      const d = await r.json();
      if (d.user?.id) {
        const roles: string[] = Array.isArray(d.roles) ? d.roles : (Array.isArray(d.user?.roles) ? d.user.roles : []);
        return { id: d.user.id, roles };
      }
    }
    const r2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!r2.ok) return null;
    const d2 = await r2.json(); return d2.id ? { id: d2.id, roles: Array.isArray(d2.roles) ? d2.roles : [] } : null;
  } catch { return null; }
}

// GET /api/margarita/crm/tags
export async function GET(_req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT * FROM mm_tags WHERE user_id = ? ORDER BY name ASC",
      [user.id]
    ) as any;
    return NextResponse.json({ tags: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// POST /api/margarita/crm/tags  — create tag
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();
    const { name, color } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "name requerido" }, { status: 422 });

    const [result] = await pool.execute(
      "INSERT INTO mm_tags (user_id, name, color) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)",
      [user.id, name.trim(), color || "#10b981"]
    ) as any;

    const [[tag]] = await pool.execute(
      "SELECT * FROM mm_tags WHERE user_id = ? AND name = ?",
      [user.id, name.trim()]
    ) as any;
    return NextResponse.json({ tag }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// DELETE /api/margarita/crm/tags?name=xxx  — remove tag from catalog
export async function DELETE(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();
    const name = new URL(req.url).searchParams.get("name");
    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 422 });

    await pool.execute("DELETE FROM mm_tags WHERE user_id = ? AND name = ?", [user.id, name]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
