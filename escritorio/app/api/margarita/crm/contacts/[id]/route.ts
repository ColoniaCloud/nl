import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    return data.user?.id ? { id: data.user.id } : null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id } : null;
}

// GET /api/margarita/crm/contacts/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();
    const { id } = await params;

    const [[contact]] = (await pool.execute(
      "SELECT * FROM mm_contacts WHERE id = ? AND user_id = ?",
      [id, user.id]
    )) as any;

    if (!contact) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ contact });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// PUT /api/margarita/crm/contacts/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();
    const { id } = await params;
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
      `UPDATE mm_contacts SET
        nombre = ?, empresa = ?, email = ?, telefono = ?, optin = ?,
        fecha_contactado = ?, pais = ?, ciudad = ?, direccion = ?,
        etiquetas = ?, notas = ?, website = ?, rubro = ?, status = ?, source = ?
       WHERE id = ? AND user_id = ?`,
      [
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
        id,
        user.id,
      ]
    )) as any;

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// DELETE /api/margarita/crm/contacts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();
    const { id } = await params;

    const [result] = (await pool.execute(
      "DELETE FROM mm_contacts WHERE id = ? AND user_id = ?",
      [id, user.id]
    )) as any;

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
