import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

// GET /api/margarita/crm/contacts
// Query params: search, etiqueta, page, limit
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const etiqueta = searchParams.get("etiqueta") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    let where = "WHERE user_id = ?";
    const params: (string | number)[] = [user.id];

    if (search) {
      where += " AND (nombre LIKE ? OR empresa LIKE ? OR email LIKE ? OR telefono LIKE ? OR rubro LIKE ? OR ciudad LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    const status = searchParams.get("status") || "";
    if (status) { where += " AND status = ?"; params.push(status); }
    if (etiqueta) {
      where += " AND JSON_CONTAINS(etiquetas, ?)";
      params.push(JSON.stringify(etiqueta));
    }

    const [rows] = (await pool.execute(
      `SELECT * FROM mm_contacts ${where} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [...params]
    )) as any;

    const [[{ total }]] = (await pool.execute(
      `SELECT COUNT(*) as total FROM mm_contacts ${where}`,
      params
    )) as any;

    return NextResponse.json({ contacts: rows, total, page, limit });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// POST /api/margarita/crm/contacts
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

    const body = await req.json();
    const {
      nombre, empresa, email, telefono, optin,
      fecha_contactado, pais, ciudad, direccion, etiquetas, notas,
      website, rubro, status: contactStatus, source,
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 422 });
    }

    const [result] = (await pool.execute(
      `INSERT INTO mm_contacts
        (user_id, nombre, empresa, email, telefono, optin, fecha_contactado, pais, ciudad, direccion, etiquetas, notas, website, rubro, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        nombre.trim(),
        empresa || null,
        email || null,
        telefono || null,
        optin ? 1 : 0,
        fecha_contactado || null,
        pais || null,
        ciudad || null,
        direccion || null,
        etiquetas ? JSON.stringify(etiquetas) : null,
        notas || null,
        website || null,
        rubro || null,
        contactStatus || "nuevo",
        source || null,
      ]
    )) as any;

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
