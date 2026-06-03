import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { getAgent } from "@/lib/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const STRATEGY_MODEL = getAgent("margarita")!.models!.strategy;

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

// POST /api/margarita/strategy
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
    const { brandbook_id } = body;

    if (!brandbook_id) return NextResponse.json({ error: "brandbook_id requerido" }, { status: 400 });

    // Load brandbook
    const [bRows] = (await pool.execute(
      "SELECT * FROM mm_brandbooks WHERE id = ? AND user_id = ?",
      [brandbook_id, user.id]
    )) as any;

    if (!bRows[0]) return NextResponse.json({ error: "Brandbook no encontrado" }, { status: 404 });

    const bb = bRows[0];

    // Load selected platforms from strategy record if exists
    const [sRows] = (await pool.execute(
      "SELECT * FROM mm_strategies WHERE brandbook_id = ? ORDER BY created_at DESC LIMIT 1",
      [brandbook_id]
    )) as any;

    const existingStrategy = sRows[0];
    const platforms: string[] = existingStrategy?.selected_platforms
      ? JSON.parse(existingStrategy.selected_platforms)
      : ["facebook", "instagram"];

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Sos un experto en marketing digital. Creá una estrategia de contenido completa para redes sociales.

BRANDBOOK:
- Negocio: ${bb.business_name || "Sin nombre"}
- Industria: ${bb.industry || "General"}
- Descripcion: ${bb.description || "No especificada"}
- Audiencia: ${bb.audience || "No especificada"}
- Tono de voz: ${bb.tone_of_voice || "profesional"}
- Valores de marca: ${bb.brand_values ? (typeof bb.brand_values === "string" ? bb.brand_values : JSON.stringify(bb.brand_values)) : "No especificados"}
- Tagline: ${bb.tagline || "No especificado"}
- Propuesta de valor: ${bb.unique_value_proposition || "No especificada"}
- Colores: primario ${bb.primary_color || "#000"}, secundario ${bb.secondary_color || "#fff"}

REDES SELECCIONADAS: ${platforms.join(", ")}

Devolvé SOLO un JSON valido con esta estructura exacta (sin markdown, sin texto extra):
{
  "title": "Estrategia de Marketing Digital para [Negocio]",
  "objectives": ["objetivo1", "objetivo2", "objetivo3"],
  "target_audience": "Descripcion detallada de la audiencia objetivo",
  "content_pillars": [
    {"name": "Pilar 1", "description": "...", "percentage": 40},
    {"name": "Pilar 2", "description": "...", "percentage": 35},
    {"name": "Pilar 3", "description": "...", "percentage": 25}
  ],
  "posting_frequency": {
    "facebook": 3,
    "instagram": 5,
    "linkedin": 2,
    "x": 3,
    "gmb": 1
  },
  "brand_voice_guidelines": "Guia detallada del tono y voz de la marca...",
  "hashtag_strategy": "Estrategia de hashtags: primarios, secundarios y de nicho..."
}`;

    const response = await client.messages.create({
      model: STRATEGY_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    let strategyData: Record<string, any>;
    try {
      // Try direct parse
      strategyData = JSON.parse(rawText);
    } catch {
      // Try extracting JSON block
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: "No se pudo generar la estrategia" }, { status: 500 });
      }
      strategyData = JSON.parse(jsonMatch[0]);
    }

    // Filter posting_frequency to only selected platforms
    const filteredFrequency: Record<string, number> = {};
    for (const p of platforms) {
      filteredFrequency[p] = strategyData.posting_frequency?.[p] || 3;
    }

    // Save or update strategy
    let strategyId: number;
    if (existingStrategy) {
      await pool.execute(
        `UPDATE mm_strategies SET
          title = ?, objectives = ?, target_audience = ?,
          content_pillars = ?, posting_frequency = ?,
          brand_voice_guidelines = ?, hashtag_strategy = ?
         WHERE id = ?`,
        [
          strategyData.title,
          JSON.stringify(strategyData.objectives),
          strategyData.target_audience,
          JSON.stringify(strategyData.content_pillars),
          JSON.stringify(filteredFrequency),
          strategyData.brand_voice_guidelines,
          strategyData.hashtag_strategy,
          existingStrategy.id,
        ]
      );
      strategyId = existingStrategy.id;
    } else {
      const [result] = (await pool.execute(
        `INSERT INTO mm_strategies (brandbook_id, title, objectives, target_audience,
          content_pillars, posting_frequency, brand_voice_guidelines, hashtag_strategy, selected_platforms)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          brandbook_id,
          strategyData.title,
          JSON.stringify(strategyData.objectives),
          strategyData.target_audience,
          JSON.stringify(strategyData.content_pillars),
          JSON.stringify(filteredFrequency),
          strategyData.brand_voice_guidelines,
          strategyData.hashtag_strategy,
          JSON.stringify(platforms),
        ]
      )) as any;
      strategyId = result.insertId;
    }

    return NextResponse.json({
      strategy_id: strategyId,
      strategy: {
        ...strategyData,
        posting_frequency: filteredFrequency,
        platforms,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/margarita/strategy?brandbook_id=X
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

    if (!brandbookId) return NextResponse.json({ error: "brandbook_id requerido" }, { status: 400 });

    // Verify ownership
    const [bRows] = (await pool.execute(
      "SELECT id FROM mm_brandbooks WHERE id = ? AND user_id = ?",
      [brandbookId, user.id]
    )) as any;
    if (!bRows[0]) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const [sRows] = (await pool.execute(
      "SELECT * FROM mm_strategies WHERE brandbook_id = ? ORDER BY created_at DESC LIMIT 1",
      [brandbookId]
    )) as any;

    if (!sRows[0]) return NextResponse.json({ strategy: null });

    const s = sRows[0];
    return NextResponse.json({
      strategy: {
        id: s.id,
        title: s.title,
        objectives: s.objectives ? JSON.parse(s.objectives) : [],
        target_audience: s.target_audience,
        content_pillars: s.content_pillars ? JSON.parse(s.content_pillars) : [],
        posting_frequency: s.posting_frequency ? JSON.parse(s.posting_frequency) : {},
        brand_voice_guidelines: s.brand_voice_guidelines,
        hashtag_strategy: s.hashtag_strategy,
        selected_platforms: s.selected_platforms ? JSON.parse(s.selected_platforms) : [],
        clickup_list_id: s.clickup_list_id,
        calendar_url: s.calendar_url,
        created_at: s.created_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
