import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getUser(token: string): Promise<{ id: number } | null> {
  try {
    const r = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (r.ok) { const d = await r.json(); return d.user?.id ? { id: d.user.id } : null; }
    const r2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!r2.ok) return null;
    const d2 = await r2.json(); return d2.id ? { id: d2.id } : null;
  } catch { return null; }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const CRM_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_leads",
    description: "Busca leads/contactos en el CRM por texto libre. Devuelve lista de contactos que coincidan.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Texto a buscar (nombre, empresa, email, rubro, ciudad)" },
        status: { type: "string", enum: ["nuevo", "contactado", "calificado", "cerrado", "perdido"], description: "Filtrar por estado (opcional)" },
        limit: { type: "number", description: "Máximo de resultados (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_lead",
    description: "Obtiene el perfil completo de un lead por su ID, incluyendo análisis IA si existe.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "ID del contacto" },
      },
      required: ["id"],
    },
  },
  {
    name: "analyze_lead",
    description: "Realiza un análisis profundo de un lead usando IA. Analiza su web, datos, y genera score, fortalezas, approach recomendado y primer mensaje.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "ID del contacto a analizar" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_email_template",
    description: "Genera un template HTML de email personalizado para un lead. Tipos: bienvenida, seguimiento, propuesta, reactivacion, confirmacion, nurturing.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "number", description: "ID del contacto (opcional)" },
        template_type: { type: "string", enum: ["bienvenida", "seguimiento", "propuesta", "reactivacion", "confirmacion", "nurturing"] },
        context: { type: "string", description: "Contexto adicional para personalizar el email" },
        sender_name: { type: "string", description: "Nombre del remitente" },
        sender_company: { type: "string", description: "Empresa del remitente" },
      },
      required: ["template_type"],
    },
  },
  {
    name: "create_sales_funnel",
    description: "Crea un funnel de ventas detallado para uno o más leads usando expertise de Jordan (experto en funnels).",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_ids: { type: "array", items: { type: "number" }, description: "IDs de los contactos para el funnel" },
        product: { type: "string", description: "Producto o servicio que se va a vender" },
        funnel_type: { type: "string", enum: ["lead_magnet", "webinar", "high_ticket", "tripwire", "launch", "membership"], description: "Tipo de funnel" },
      },
      required: ["product", "funnel_type"],
    },
  },
  {
    name: "update_lead",
    description: "Actualiza campos de un lead en el CRM (status, notas, rubro, score, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "ID del contacto" },
        fields: {
          type: "object",
          description: "Campos a actualizar: status, notas, rubro, score, email, telefono, ciudad, pais",
          properties: {
            status: { type: "string", enum: ["nuevo", "contactado", "calificado", "cerrado", "perdido"] },
            notas: { type: "string" },
            rubro: { type: "string" },
            score: { type: "number" },
            email: { type: "string" },
            telefono: { type: "string" },
          },
        },
      },
      required: ["id", "fields"],
    },
  },
  {
    name: "create_tag",
    description: "Crea una nueva etiqueta en el catálogo del CRM con nombre y color.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nombre de la etiqueta" },
        color: { type: "string", description: "Color en hex, ej: #10b981" },
      },
      required: ["name"],
    },
  },
  {
    name: "assign_tag",
    description: "Asigna una etiqueta a uno o varios contactos.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_ids: { type: "array", items: { type: "number" }, description: "IDs de los contactos" },
        tag: { type: "string", description: "Nombre de la etiqueta" },
      },
      required: ["contact_ids", "tag"],
    },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────

async function execTool(name: string, input: any, userId: number): Promise<any> {
  const pool = getPool();

  if (name === "search_leads") {
    const q = `%${input.query}%`;
    let where = "WHERE user_id = ? AND (nombre LIKE ? OR empresa LIKE ? OR email LIKE ? OR rubro LIKE ? OR ciudad LIKE ?)";
    const params: any[] = [userId, q, q, q, q, q];
    if (input.status) { where += " AND status = ?"; params.push(input.status); }
    const limit = Math.min(input.limit || 10, 50);
    const [rows] = await pool.execute(
      `SELECT id, nombre, empresa, email, telefono, rubro, ciudad, pais, status, score, etiquetas FROM mm_contacts ${where} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    ) as any;
    return { contacts: rows, total: rows.length };
  }

  if (name === "get_lead") {
    const [[c]] = await pool.execute(
      "SELECT * FROM mm_contacts WHERE id = ? AND user_id = ?",
      [input.id, userId]
    ) as any;
    if (!c) return { error: "Contacto no encontrado" };
    return { contact: { ...c, etiquetas: (() => { try { return JSON.parse(c.etiquetas || "[]"); } catch { return []; } })(), ai_analysis: (() => { try { return c.ai_analysis ? JSON.parse(c.ai_analysis) : null; } catch { return null; } })() } };
  }

  if (name === "analyze_lead") {
    const [[c]] = await pool.execute(
      "SELECT * FROM mm_contacts WHERE id = ? AND user_id = ?",
      [input.id, userId]
    ) as any;
    if (!c) return { error: "Contacto no encontrado" };

    let websiteContent = "";
    if (c.website) {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(c.website, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
          const html = await res.text();
          websiteContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12000);
        }
      } catch {}
    }

    const tags = (() => { try { return JSON.parse(c.etiquetas || "[]"); } catch { return []; } })();
    const prompt = `Analiza este lead y devuelve SOLO JSON válido:
LEAD: ${c.nombre} (${c.empresa || "N/A"}) | ${c.rubro || tags.join(", ") || "N/A"} | ${c.ciudad || ""} ${c.pais || ""}
${websiteContent ? `WEB:\n${websiteContent}` : ""}

JSON:
{"resumen":"...","score":0-100,"score_razon":"...","fortalezas":[],"oportunidades":[],"approach_recomendado":"...","primer_mensaje":"...","objeciones_esperadas":[],"mejor_canal":"email|whatsapp|llamada","urgencia":"alta|media|baja","etiquetas_sugeridas":[]}`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const analysis = JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());

    await pool.execute(
      "UPDATE mm_contacts SET ai_analysis = ?, score = ? WHERE id = ? AND user_id = ?",
      [JSON.stringify(analysis), analysis.score || null, input.id, userId]
    );
    return { analysis, saved: true };
  }

  if (name === "create_email_template") {
    let contactInfo = "";
    if (input.contact_id) {
      const [[c]] = await pool.execute(
        "SELECT nombre, empresa, rubro, ciudad, pais, ai_analysis FROM mm_contacts WHERE id = ? AND user_id = ?",
        [input.contact_id, userId]
      ) as any;
      if (c) contactInfo = `Lead: ${c.nombre} (${c.empresa || "N/A"}) | ${c.rubro || "N/A"} | ${c.ciudad || ""} ${c.pais || ""}`;
    }

    const TEMPLATE_DESC: Record<string, string> = {
      bienvenida: "primer contacto cálido, sin vender agresivamente",
      seguimiento: "follow-up para lead que no respondió",
      propuesta: "propuesta de valor con CTA a agendar llamada",
      reactivacion: "recuperar lead frío",
      confirmacion: "confirmar reunión agendada",
      nurturing: "email educativo que aporta valor",
    };

    const prompt = `Crea template HTML profesional de email tipo "${input.template_type}" (${TEMPLATE_DESC[input.template_type] || ""}).
${contactInfo ? `Lead: ${contactInfo}` : ""}${input.context ? `\nContexto: ${input.context}` : ""}
Remitente: ${input.sender_name || "El equipo"} de ${input.sender_company || "NL360"}

HTML requirements: tabla 600px, fondo #f4f4f5, tarjeta blanca, acento #10b981, inline styles, {{nombre}} y {{empresa}} como variables, CTA button verde esmeralda.
Devuelve SOLO el HTML completo.`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const html = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return { html, template_type: input.template_type };
  }

  if (name === "create_sales_funnel") {
    let leadsInfo = "";
    if (input.contact_ids?.length) {
      const ids = input.contact_ids.slice(0, 5).map(() => "?").join(",");
      const [rows] = await pool.execute(
        `SELECT nombre, empresa, rubro, ciudad, pais FROM mm_contacts WHERE id IN (${ids}) AND user_id = ?`,
        [...input.contact_ids.slice(0, 5), userId]
      ) as any;
      leadsInfo = rows.map((c: any) => `- ${c.nombre} (${c.empresa || "N/A"}) | ${c.rubro || "N/A"} | ${c.ciudad || ""}`).join("\n");
    }

    const JORDAN_FUNNEL = `Sos Jordan, experto en Funnels de Venta. Ayudas a diseñar embudos de conversión (TOFU, MOFU, BOFU). Conoces los 6 tipos: Lead Magnet, Webinar, High Ticket, Tripwire, Launch y Membership. Usas lenguaje profesional en español rioplatense.`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2048,
      system: JORDAN_FUNNEL,
      messages: [{
        role: "user",
        content: `Crea un funnel de ventas tipo "${input.funnel_type}" para vender: "${input.product}".
${leadsInfo ? `\nLEADS OBJETIVO:\n${leadsInfo}` : ""}

Incluye: etapas del funnel, contenido para cada etapa, emails clave, métricas a trackear, timeline estimado.`
      }],
    });
    return { funnel: msg.content[0]?.type === "text" ? msg.content[0].text : "" };
  }

  if (name === "update_lead") {
    const allowed = ["status", "notas", "rubro", "score", "email", "telefono", "ciudad", "pais", "website"];
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(input.fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return { error: "Sin campos válidos" };
    vals.push(input.id, userId);
    await pool.execute(`UPDATE mm_contacts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, vals);
    return { ok: true, updated: Object.keys(input.fields) };
  }

  if (name === "create_tag") {
    await pool.execute(
      "INSERT INTO mm_tags (user_id, name, color) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)",
      [userId, input.name, input.color || "#10b981"]
    );
    return { ok: true, tag: { name: input.name, color: input.color || "#10b981" } };
  }

  if (name === "assign_tag") {
    const ids = (input.contact_ids || []).slice(0, 100);
    for (const cid of ids) {
      const [[c]] = await pool.execute(
        "SELECT etiquetas FROM mm_contacts WHERE id = ? AND user_id = ?",
        [cid, userId]
      ) as any;
      if (!c) continue;
      const tags: string[] = (() => { try { return JSON.parse(c.etiquetas || "[]"); } catch { return []; } })();
      if (!tags.includes(input.tag)) tags.push(input.tag);
      await pool.execute("UPDATE mm_contacts SET etiquetas = ? WHERE id = ?", [JSON.stringify(tags), cid]);
    }
    return { ok: true, assigned_to: ids.length };
  }

  return { error: `Tool desconocida: ${name}` };
}

// ─── POST /api/margarita/crm/agent ────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

      await ensureTables();

      const body = await req.json();
      const { message, history = [], active_lead_id } = body;

      const systemPrompt = `Sos el agente IA del CRM de Margarita. Ayudas al usuario a gestionar sus leads, analizar prospectos, crear emails y diseñar estrategias de ventas.

Tenés acceso a herramientas para: buscar leads, analizar contactos en profundidad, crear templates de email HTML, diseñar funnels de ventas con metodología Jordan, actualizar datos de leads y gestionar etiquetas.

Cuando el usuario pida algo, usá las herramientas necesarias de forma proactiva. Podés encadenar múltiples herramientas en una sola respuesta.
${active_lead_id ? `\nLEAD ACTIVO: ID ${active_lead_id} (el usuario está viendo este lead actualmente).` : ""}

Respondé en español rioplatense, de forma concisa y profesional.`;

      const messages: Anthropic.MessageParam[] = [
        ...history.map((h: any) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: message },
      ];

      // Agentic loop
      let iteration = 0;
      const MAX_ITER = 8;

      while (iteration < MAX_ITER) {
        iteration++;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          tools: CRM_TOOLS,
          messages,
        });

        // Collect text from this response
        let textAccumulated = "";
        const toolCalls: { id: string; name: string; input: any }[] = [];

        for (const block of response.content) {
          if (block.type === "text") {
            textAccumulated += block.text;
          } else if (block.type === "tool_use") {
            toolCalls.push({ id: block.id, name: block.name, input: block.input });
          }
        }

        if (textAccumulated) {
          send({ type: "text", text: textAccumulated });
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
          send({ type: "done" });
          break;
        }

        // Execute all tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const tc of toolCalls) {
          send({ type: "tool_start", tool: tc.name, input: tc.input });

          try {
            const result = await execTool(tc.name, tc.input, user.id);
            send({ type: "tool_done", tool: tc.name, result });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            const errResult = { error: err?.message || "Error ejecutando herramienta" };
            send({ type: "tool_error", tool: tc.name, error: errResult.error });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: JSON.stringify(errResult),
              is_error: true,
            });
          }
        }

        // Add assistant response + tool results to message history for next iteration
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
      }

      if (iteration >= MAX_ITER) {
        send({ type: "done" });
      }
    } catch (err: any) {
      send({ error: err?.message || "Error del agente" });
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
