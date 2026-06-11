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
const EMAIL_MODEL = getAgent("margarita")!.model;
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

// POST /api/margarita/crm/email-template
// body: { contact_id, template_type, context, sender_name, sender_company }
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

    const {
      contact_id,
      template_type = "bienvenida",
      context = "",
      sender_name = "El equipo",
      sender_company = "NL360",
    } = await req.json();

    let contactInfo = "";
    if (contact_id) {
      const [[c]] = await pool.execute(
        "SELECT * FROM mm_contacts WHERE id = ? AND user_id = ?",
        [contact_id, user.id]
      ) as any;
      if (c) {
        const tags = (() => { try { return JSON.parse(c.etiquetas || "[]"); } catch { return []; } })();
        contactInfo = `
Lead: ${c.nombre}${c.empresa ? ` (${c.empresa})` : ""}
Rubro: ${c.rubro || tags.join(", ") || "N/A"}
Ciudad: ${c.ciudad || ""} ${c.pais || ""}
AI análisis: ${c.ai_analysis ? JSON.stringify(JSON.parse(c.ai_analysis)) : "No disponible"}`;
      }
    }

    const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
      bienvenida: "primer contacto, presentación cálida, sin vender agresivamente",
      seguimiento: "follow-up para lead que ya fue contactado pero no respondió",
      propuesta: "email con propuesta de valor clara y CTA a agendar llamada",
      reactivacion: "recuperar un lead frío o perdido hace tiempo",
      confirmacion: "confirmar reunión o llamada agendada",
      nurturing: "email educativo que aporta valor sin vender directamente",
    };

    const desc = TEMPLATE_DESCRIPTIONS[template_type] || template_type;

    const prompt = `Sos un experto en email marketing B2B. Creá un template HTML profesional para email de tipo "${template_type}" (${desc}).
${contactInfo ? `\nDATOS DEL LEAD:\n${contactInfo}` : ""}
${context ? `\nCONTEXTO ADICIONAL:\n${context}` : ""}

REMITENTE: ${sender_name} de ${sender_company}

REQUISITOS DEL HTML:
- Diseño limpio y profesional con tabla central de max 600px
- Colores: fondo #f4f4f5, tarjeta blanca, acento #10b981 (esmeralda)
- Typography: sistema sans-serif, títulos en #111827, texto en #374151
- Personalización: usa {{nombre}} para el nombre del lead, {{empresa}} para su empresa
- Footer con datos del remitente y enlace de cancelación ficticio
- Compatible con clientes de email (Gmail, Outlook) — solo inline styles, sin media queries complejas
- CTA button con background #10b981 y texto blanco

Devuelve SOLO el HTML completo, sin explicaciones adicionales.`;

    const msg = await anthropic.messages.create({
      model: EMAIL_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const html = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const subject = `Email de ${template_type}${contact_id ? " para lead" : ""}`;

    return NextResponse.json({ html, subject, template_type });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
