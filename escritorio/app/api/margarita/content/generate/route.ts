import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { getAgent } from "@/lib/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const CONTENT_MODEL = getAgent("margarita")!.models!.content;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: [] } : null;
}

// POST /api/margarita/content/generate
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
    const { strategy_id, weeks = 2 } = body;

    if (!strategy_id) return NextResponse.json({ error: "strategy_id requerido" }, { status: 400 });

    // Load strategy + brandbook
    const [sRows] = (await pool.execute(
      `SELECT s.*, b.business_name, b.industry, b.tone_of_voice, b.brand_values,
              b.tagline, b.unique_value_proposition, b.audience, b.user_id AS owner_id
       FROM mm_strategies s
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE s.id = ?`,
      [strategy_id]
    )) as any;

    if (!sRows[0]) return NextResponse.json({ error: "Estrategia no encontrada" }, { status: 404 });

    const s = sRows[0];
    if (s.owner_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const platforms: string[] = s.selected_platforms ? JSON.parse(s.selected_platforms) : ["instagram", "facebook"];
    const pillars = s.content_pillars ? JSON.parse(s.content_pillars) : [];
    const frequency = s.posting_frequency ? JSON.parse(s.posting_frequency) : {};

    // Calculate total posts per platform for `weeks`
    const totalPosts: Record<string, number> = {};
    for (const p of platforms) {
      totalPosts[p] = Math.round((frequency[p] || 3) * weeks);
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const today = new Date();
    const startDate = today.toISOString().split("T")[0];

    const prompt = `Sos un experto en content marketing. Genera un calendario de posts para redes sociales.

MARCA:
- Negocio: ${s.business_name}
- Industria: ${s.industry}
- Audiencia: ${s.audience}
- Tono de voz: ${s.tone_of_voice || "profesional"}
- Tagline: ${s.tagline || ""}
- Propuesta de valor: ${s.unique_value_proposition || ""}

ESTRATEGIA:
- Pilares de contenido: ${JSON.stringify(pillars)}
- Guia de voz: ${s.brand_voice_guidelines || ""}
- Estrategia de hashtags: ${s.hashtag_strategy || ""}

POSTS A GENERAR:
${platforms.map((p) => `- ${p}: ${totalPosts[p]} posts`).join("\n")}
Fecha de inicio: ${startDate}
Distribuir los posts uniformemente en ${weeks} semanas a partir de la fecha de inicio.

Devolvé SOLO un JSON valido (sin markdown) con esta estructura:
{
  "posts": [
    {
      "platform": "instagram",
      "post_type": "image",
      "pillar": "nombre del pilar",
      "title": "Titulo corto del post",
      "caption": "Caption completo listo para publicar con emojis si aplica al tono",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "visual_description": "Descripcion detallada de la imagen para generar con IA: composicion, colores, elementos, estilo fotografico",
      "scheduled_at": "2026-03-18T10:00:00"
    }
  ]
}

IMPORTANTE:
- Captions en el tono exacto de la marca
- Visual descriptions especificas y detalladas para generacion de imagen con IA
- scheduled_at bien distribuido entre ${startDate} y ${weeks} semanas despues
- Variedad de tipos de contenido (educativo, entretenimiento, ventas, comunidad)
- Maximo 30 hashtags por post de Instagram, 5 para LinkedIn, 3 para X`;

    const response = await client.messages.create({
      model: CONTENT_MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let contentData: { posts: any[] };
    try {
      contentData = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return NextResponse.json({ error: "Error generando contenido" }, { status: 500 });
      contentData = JSON.parse(jsonMatch[0]);
    }

    if (!Array.isArray(contentData.posts) || contentData.posts.length === 0) {
      return NextResponse.json({ error: "No se generaron posts" }, { status: 500 });
    }

    // Delete existing draft content for this strategy
    await pool.execute(
      "DELETE FROM mm_content WHERE strategy_id = ? AND status = 'draft'",
      [strategy_id]
    );

    // Insert all posts
    const insertedIds: number[] = [];
    for (const post of contentData.posts) {
      const [result] = (await pool.execute(
        `INSERT INTO mm_content (strategy_id, platform, post_type, pillar, title, caption, hashtags, visual_description, scheduled_at, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          strategy_id,
          post.platform || "instagram",
          post.post_type || "image",
          post.pillar || "",
          post.title || "",
          post.caption || "",
          post.hashtags || "",
          post.visual_description || "",
          post.scheduled_at || new Date().toISOString(),
          "draft",
        ]
      )) as any;
      insertedIds.push(result.insertId);
    }

    return NextResponse.json({
      generated: contentData.posts.length,
      content_ids: insertedIds,
      posts: contentData.posts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/margarita/content/generate?strategy_id=X
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
    const strategyId = searchParams.get("strategy_id");

    if (!strategyId) return NextResponse.json({ error: "strategy_id requerido" }, { status: 400 });

    // Verify ownership
    const [sRows] = (await pool.execute(
      `SELECT s.id FROM mm_strategies s
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE s.id = ? AND b.user_id = ?`,
      [strategyId, user.id]
    )) as any;
    if (!sRows[0]) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const [posts] = (await pool.execute(
      "SELECT * FROM mm_content WHERE strategy_id = ? ORDER BY scheduled_at ASC",
      [strategyId]
    )) as any;

    return NextResponse.json({ posts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
