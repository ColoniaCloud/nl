import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { upsertBrandbook, getSharedProject } from "@/lib/shared-project";
import { generateLogo } from "@/lib/logo-generator";

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

// GET /api/margarita/brandbook?brandbook_id=X  OR  ?project_id=X (import from Manu Dev)
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

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

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

    // Sync to shared brandbook (non-blocking helper)
    const syncShared = async (finalLogoUrl?: string) => {
      const brandData: Record<string, string | undefined> = {};
      if (business_name) brandData.name = business_name;
      if (industry) brandData.industry = industry;
      if (description) brandData.description = description;
      if (primary_color) brandData.primary_color = primary_color;
      if (secondary_color) brandData.secondary_color = secondary_color;
      if (accent_color) brandData.accent_color = accent_color;
      if (font_heading) brandData.font_heading = font_heading;
      if (font_body) brandData.font_body = font_body;
      if (tagline) brandData.tagline = tagline;
      if (finalLogoUrl) brandData.logo_url = finalLogoUrl;
      if (Object.keys(brandData).length > 0) await upsertBrandbook(user.id, brandData);
    };

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
      await syncShared(logo_url);
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

    // Generate logo if we have enough brand data and no logo yet
    let finalLogoUrl = logo_url;
    if (!finalLogoUrl && business_name) {
      const existing = await getSharedProject(user.id);
      if (!existing?.logo_url) {
        const logoResult = await generateLogo({
          businessName: business_name,
          industry: industry || undefined,
          primaryColor: primary_color || undefined,
          secondaryColor: secondary_color || undefined,
          accentColor: accent_color || undefined,
        });
        if (logoResult) {
          finalLogoUrl = logoResult.url;
          await pool.execute(
            "UPDATE mm_brandbooks SET logo_url = ? WHERE id = ?",
            [finalLogoUrl, result.insertId]
          );
        }
      }
    }

    await syncShared(finalLogoUrl ?? undefined);
    return NextResponse.json({ brandbook_id: result.insertId, logo_url: finalLogoUrl ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// PATCH /api/margarita/brandbook — partial update, returns updated brandbook
export async function PATCH(req: NextRequest) {
  return POST(req);
}
