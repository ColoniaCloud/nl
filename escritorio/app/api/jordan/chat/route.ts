import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

const MODEL = "claude-haiku-4-5-20251001";

export type ToolType = "FUNNELS" | "ESTRATEGIA" | "SETTERS" | "CLOSERS" | "DATOS" | "CRM";
const VALID_TOOLS: ToolType[] = ["FUNNELS", "ESTRATEGIA", "SETTERS", "CLOSERS", "DATOS", "CRM"];

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthenticated(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) return true;
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res2.ok;
  } catch {
    return false;
  }
}

// ─── System prompts ───────────────────────────────────────────────────────────

const COMMON_RULES = `
REGLAS:
- Responde de forma concisa pero profesional.
- Usa un tono motivador y experto.
- Espanol rioplatense informal (vos, tenes, dale).
- Ofrece ejemplos practicos y accionables siempre que sea posible.

FORMATO DE RESPUESTA OBLIGATORIO:
Responde UNICAMENTE con un objeto JSON valido, sin texto antes ni despues:
{"reply":"tu respuesta en markdown","options":["Opcion 1","Opcion 2","Opcion 3"]}

- "reply": markdown, maximo 4 parrafos. Usa **negrita** para conceptos clave, scripts y plantillas.
- "options": 2-3 strings breves (max 40 caracteres) como proximos pasos sugeridos.
- NO uses bloques de codigo (triple backtick) alrededor del JSON.
- NO escribas nada fuera del objeto JSON.`;

const TOOL_SYSTEMS: Record<ToolType, string> = {
  FUNNELS: `Sos Jordan, experto en Funnels de Venta. Tu objetivo es ayudar al usuario a disenar, optimizar y analizar embudos de conversion (TOFU, MOFU, BOFU). Habla sobre tasas de conversion, landing pages, imanes de leads y secuencias de email. Conoces en profundidad los 6 tipos de funnel principales: Lead Magnet, Webinar, High Ticket, Tripwire, Launch y Membership.${COMMON_RULES}`,

  ESTRATEGIA: `Sos Jordan, estratega de negocios. Tu objetivo es realizar analisis de mercado, definir propuestas de valor unicas y crear hojas de ruta estrategicas para escalar negocios. Manejas frameworks como SWOT, Value Proposition Canvas, OKRs y estrategias de posicionamiento competitivo.${COMMON_RULES}`,

  SETTERS: `Sos Jordan, entrenador de Setters de ventas. Tu objetivo es ensenar a prospectar, calificar leads y agendar llamadas de venta a traves de chats o redes sociales. Proporcionas guiones de apertura, tecnicas de calificacion y estrategias para aumentar la tasa de agendamiento. Conoces en detalle los frameworks BANT, SPIN y MEDDIC.${COMMON_RULES}`,

  CLOSERS: `Sos Jordan, experto Closer de ventas. Tu objetivo es entrenar en manejo de objeciones, tecnicas de cierre de alta presion y persuasion etica para cerrar tratos en llamadas o chats. Dominas objeciones como "esta caro", "lo tengo que pensar", "no es el momento". Podes hacer roleplay simulando ser el prospecto para que el usuario practique.${COMMON_RULES}`,

  DATOS: `Sos Jordan, analista de datos de crecimiento. Tu objetivo es interpretar metricas de negocio, identificar cuellos de botella y encontrar oportunidades ocultas de escalado basados en numeros. Trabajas con KPIs de ventas (CPL, CAC, LTV, churn, conversion rate, ticket promedio) y ayudas a traducir los datos en decisiones concretas.${COMMON_RULES}`,

  CRM: `Sos Jordan, experto en CRM y gestion de clientes. Tu objetivo es ayudar al usuario a disenar sistemas de seguimiento de leads, automatizacion de ventas y gestion de relaciones con clientes para maximizar el LTV (Life Time Value). Conoces herramientas como HubSpot, Pipedrive, ActiveCampaign y podes ayudar a disenarlo desde cero.${COMMON_RULES}`,
};

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(raw: string): { reply: string; options: string[] } {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    const parsed = JSON.parse(cleaned);
    return {
      reply: String(parsed.reply ?? parsed.message ?? cleaned),
      options: Array.isArray(parsed.options)
        ? parsed.options.map(String).filter(Boolean)
        : [],
    };
  } catch {
    return { reply: raw.trim(), options: [] };
  }
}

// ─── Anthropic call ───────────────────────────────────────────────────────────

async function callAnthropic(
  tool: ToolType,
  history: { role: "user" | "model"; parts: string }[],
  message: string
): Promise<{ reply: string; options: string[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.parts,
    })),
    { role: "user" as const, content: message },
  ];

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: TOOL_SYSTEMS[tool],
    messages,
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  return parseResponse(raw);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await isAuthenticated(token))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, provider: "anthropic" });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await isAuthenticated(token))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    tool: ToolType;
    history: { role: "user" | "model"; parts: string }[];
    message: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { tool, history = [], message } = body;

  if (!tool || !VALID_TOOLS.includes(tool)) {
    return NextResponse.json({ ok: false, error: "invalid_tool" }, { status: 400 });
  }

  try {
    const { reply, options } = await callAnthropic(tool, history, message);
    if (!reply) {
      return NextResponse.json({ ok: false, error: "empty_response" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, reply, options, provider: "anthropic" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[Jordan] error:", msg);
    return NextResponse.json(
      { ok: false, error: "Jordan esta experimentando dificultades. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
