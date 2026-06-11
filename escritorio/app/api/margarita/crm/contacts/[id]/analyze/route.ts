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
const ANALYZE_MODEL = getAgent("margarita")!.model;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NL360Bot/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip tags for cleaner analysis
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch { return ""; }
}

// POST /api/margarita/crm/contacts/[id]/analyze
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = (obj: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
  };

  (async () => {
    try {
      const jar = await cookies();
      const token = jar.get(COOKIE_NAME)?.value;
      if (!token) { send({ error: "No autenticado" }); writer.close(); return; }
      const user = await getUser(token);
      if (!user?.id) { send({ error: "Token invalido" }); writer.close(); return; }

      // F3: Verificar acceso al agente por plan
      const agentCheck = checkAgentAccess(user.roles, "margarita");
      if (!agentCheck.allowed) { send({ error: agentCheck.reason }); writer.close(); return; }

      await ensureTables();
      const pool = getPool();
      const { id } = await params;

      const [[contact]] = await pool.execute(
        "SELECT * FROM mm_contacts WHERE id = ? AND user_id = ?",
        [id, user.id]
      ) as any;
      if (!contact) { send({ error: "Contacto no encontrado" }); writer.close(); return; }

      send({ step: "reading", text: "Leyendo datos del contacto..." });

      let websiteContent = "";
      if (contact.website) {
        send({ step: "fetching", text: `Analizando sitio web ${contact.website}...` });
        websiteContent = await fetchWebsiteContent(contact.website);
      }

      send({ step: "analyzing", text: "Analizando con IA..." });

      const tags = (() => { try { return JSON.parse(contact.etiquetas || "[]"); } catch { return []; } })();

      const prompt = `Sos un analista de ventas experto. Analiza este lead en profundidad y devuelve SOLO JSON válido.

DATOS DEL LEAD:
- Nombre: ${contact.nombre}
- Empresa: ${contact.empresa || "N/A"}
- Email: ${contact.email || "N/A"}
- Teléfono: ${contact.telefono || "N/A"}
- Rubro: ${contact.rubro || tags.join(", ") || "N/A"}
- Ciudad: ${contact.ciudad || "N/A"}, ${contact.pais || "N/A"}
- Dirección: ${contact.direccion || "N/A"}
- Notas: ${contact.notas || "N/A"}
${websiteContent ? `\nCONTENIDO DEL SITIO WEB:\n${websiteContent}` : ""}

Devuelve este JSON (sin markdown):
{
  "resumen": "1-2 oraciones describiendo al lead",
  "score": 0-100,
  "score_razon": "por qué ese score",
  "fortalezas": ["punto 1", "punto 2", "punto 3"],
  "debilidades": ["punto 1", "punto 2"],
  "oportunidades": ["oportunidad de venta 1", "oportunidad 2"],
  "perfil_comprador": "descripción del perfil de comprador ideal",
  "approach_recomendado": "cómo abordar a este lead específicamente",
  "primer_mensaje": "mensaje de apertura sugerido para este lead",
  "objeciones_esperadas": ["objeción 1", "objeción 2"],
  "mejor_canal": "email | whatsapp | llamada | linkedin",
  "urgencia": "alta | media | baja",
  "etiquetas_sugeridas": ["tag1", "tag2"]
}`;

      const msg = await anthropic.messages.create({
        model: ANALYZE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      const analysis = JSON.parse(cleaned);

      // Save analysis + score to DB
      await pool.execute(
        "UPDATE mm_contacts SET ai_analysis = ?, score = ? WHERE id = ? AND user_id = ?",
        [JSON.stringify(analysis), analysis.score || null, id, user.id]
      );

      send({ step: "done", analysis });
    } catch (err: any) {
      send({ error: err?.message || "Error en análisis" });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
