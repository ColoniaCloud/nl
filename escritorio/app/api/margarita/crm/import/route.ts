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

// POST /api/margarita/crm/import
// Body: { contacts: Contact[] }
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
    const { contacts } = body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "No hay contactos para importar" }, { status: 422 });
    }

    const toImport = contacts.slice(0, 500); // max 500 por batch
    let imported = 0;
    let skipped = 0;

    // Mapea un contacto a su fila de valores; null si no tiene nombre.
    const toRow = (c: any, userId: number): any[] | null => {
      if (!c.nombre?.trim()) return null;
      return [
        userId,
        c.nombre.trim(),
        c.empresa?.trim() || null,
        c.email?.trim() || null,
        c.telefono?.trim() || null,
        c.optin ? 1 : 0,
        c.fecha_contactado || null,
        c.pais?.trim() || null,
        c.ciudad?.trim() || null,
        c.direccion?.trim() || null,
        JSON.stringify(c.etiquetas || []),
        c.notas?.trim() || null,
        // NUEVOS CAMPOS
        c._website || c.website || null,                    // website
        c.score != null ? Math.min(100, Math.max(0, Math.round(c.score))) : null, // score
        c.source || "scrape",                               // source
        c.rubro?.trim() || null,                            // rubro
        c.priority || null,                                 // priority
        c.website_quality || null,                          // website_quality
        c.reason ? JSON.stringify({ reason: c.reason, rating: c._rating, reviews: c._totalReviews }) : null, // ai_analysis
      ];
    };

    const COLS = `(user_id, nombre, empresa, email, telefono, optin,
      fecha_contactado, pais, ciudad, direccion, etiquetas, notas,
      website, score, source, rubro, priority, website_quality, ai_analysis)`;
    const PLACEHOLDERS = Array(19).fill("?").join(", ");

    const validRows = toImport.map((c) => toRow(c, user.id)).filter((r): r is any[] => r !== null);
    skipped += toImport.length - validRows.length;

    if (validRows.length > 0) {
      const placeholders = validRows.map(() => `(${PLACEHOLDERS})`).join(", ");
      try {
        // Bulk insert: un solo statement para todo el lote
        const [res]: any = await pool.query(
          `INSERT INTO mm_contacts ${COLS} VALUES ${placeholders}`,
          validRows.flat()
        );
        imported += res?.affectedRows ?? validRows.length;
      } catch {
        // Fallback fila-por-fila para no perder el lote completo por un registro
        for (const row of validRows) {
          try {
            await pool.execute(
              `INSERT INTO mm_contacts ${COLS} VALUES (${PLACEHOLDERS})`,
              row
            );
            imported++;
          } catch {
            skipped++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, imported, skipped });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
