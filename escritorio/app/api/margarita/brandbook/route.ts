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

// GET /api/margarita/brandbook?brandbook_id=X  OR  ?project_id=X (import from Manu Dev)
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const brandbookId = searchParams.get("brandbook_id");
    const projectId = searchParams.get("project_id");

    if (projectId) {
      // Import from Manu Dev project
      const [pRows] = (await pool.execute(
        `SELECT p.*, d.primary_color, d.secondary_color, d.accent_color, d.font_heading, d.font_body
         FROM md_projects p
         LEFT JOIN md_design d ON d.project_id = p.id
         WHERE p.id = ? AND p.user_id = ?`,
        [projectId, user.id]
      )) as any;

      if (!pRows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

      const p = pRows[0];
      return NextResponse.json({
        brandbook: {
          source: "manu_dev",
          project_id: p.id,
          business_name: p.name,
          industry: p.industry,
          description: p.description,
          location: p.location,
          audience: p.audience,
          primary_color: p.primary_color,
          secondary_color: p.secondary_color,
          accent_color: p.accent_color,
          font_heading: p.font_heading,
          font_body: p.font_body,
          logo_url: p.logo_url,
        },
      });
    }

    if (brandbookId) {
      const [rows] = (await pool.execute(
        "SELECT * FROM mm_brandbooks WHERE id = ? AND user_id = ?",
        [brandbookId, user.id]
      )) as any;

      if (!rows[0]) return NextResponse.json({ error: "Brandbook no encontrado" }, { status: 404 });
      return NextResponse.json({ brandbook: rows[0] });
    }

    return NextResponse.json({ error: "Se requiere brandbook_id o project_id" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// POST /api/margarita/brandbook — create or update brandbook
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const body = await req.json();
    const {
      id, // if updating existing
      project_id,
      business_name,
      industry,
      description,
      location,
      audience,
      tone_of_voice,
      brand_values,
      tagline,
      unique_value_proposition,
      primary_color,
      secondary_color,
      accent_color,
      font_heading,
      font_body,
      logo_url,
    } = body;

    if (id) {
      // Update existing
      await pool.execute(
        `UPDATE mm_brandbooks SET
          business_name = COALESCE(?, business_name),
          industry = COALESCE(?, industry),
          description = COALESCE(?, description),
          location = COALESCE(?, location),
          audience = COALESCE(?, audience),
          tone_of_voice = COALESCE(?, tone_of_voice),
          brand_values = COALESCE(?, brand_values),
          tagline = COALESCE(?, tagline),
          unique_value_proposition = COALESCE(?, unique_value_proposition),
          primary_color = COALESCE(?, primary_color),
          secondary_color = COALESCE(?, secondary_color),
          accent_color = COALESCE(?, accent_color),
          font_heading = COALESCE(?, font_heading),
          font_body = COALESCE(?, font_body),
          logo_url = COALESCE(?, logo_url)
        WHERE id = ? AND user_id = ?`,
        [
          business_name, industry, description, location, audience,
          tone_of_voice, brand_values ? JSON.stringify(brand_values) : null,
          tagline, unique_value_proposition,
          primary_color, secondary_color, accent_color,
          font_heading, font_body, logo_url,
          id, user.id,
        ]
      );
      return NextResponse.json({ brandbook_id: id });
    }

    // Create new
    const [result] = (await pool.execute(
      `INSERT INTO mm_brandbooks (
        user_id, project_id, business_name, industry, description, location, audience,
        tone_of_voice, brand_values, tagline, unique_value_proposition,
        primary_color, secondary_color, accent_color, font_heading, font_body, logo_url
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        user.id, project_id || null, business_name || null, industry || null,
        description || null, location || null, audience || null,
        tone_of_voice || null, brand_values ? JSON.stringify(brand_values) : null,
        tagline || null, unique_value_proposition || null,
        primary_color || null, secondary_color || null, accent_color || null,
        font_heading || null, font_body || null, logo_url || null,
      ]
    )) as any;

    return NextResponse.json({ brandbook_id: result.insertId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// PATCH /api/margarita/brandbook — partial update, returns updated brandbook
export async function PATCH(req: NextRequest) {
  return POST(req);
}
