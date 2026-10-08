import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("Margarita");
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { getAgent, loadSystemPrompt } from "@/lib/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const CHAT_MODEL = getAgent("margarita")!.model;

type Step =
  | "welcome"
  | "brandbook_source"
  | "brandbook_collect"
  | "brandbook_confirm"
  | "social_select"
  | "strategy"
  | "strategy_confirm"
  | "content_generate"
  | "calendar_create"
  | "complete";

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

async function getManuDevProjects(userId: number): Promise<{ id: number; name: string; industry: string }[]> {
  const pool = getPool();
  try {
    const [rows] = (await pool.execute(
      "SELECT id, name, industry FROM md_projects WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 5",
      [userId]
    )) as any;
    return rows;
  } catch {
    return [];
  }
}

function safeParseJSON(val: any): any {
  if (val == null) return val;
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function getSystemPrompt(step: Step, ctx?: Record<string, any>): string {
  const brandName = ctx?.business_name || "el negocio";
  const manuDevProjects: string = ctx?.manu_dev_projects
    ? (ctx.manu_dev_projects as { id: number; name: string }[])
        .map((p) => `- ${p.name} (ID: ${p.id})`)
        .join("\n")
    : "";

  const brandValues = safeParseJSON(ctx?.brand_values) || [];
  const strategyPillars = ctx?.strategy ? safeParseJSON(ctx.strategy.content_pillars) || [] : [];
  const strategyFrequency = ctx?.strategy ? safeParseJSON(ctx.strategy.posting_frequency) || {} : {};
  const strategyPlatforms = ctx?.strategy ? safeParseJSON(ctx.strategy.selected_platforms) || [] : [];

  const base = loadSystemPrompt("margarita").trim();

  const steps: Record<Step, string> = {
    welcome: `${base}

PASO: Bienvenida
Saludate como Margarita, especialista en marketing de redes sociales. Explica en 2 oraciones que vas a crear una estrategia de contenido personalizada.
Pregunta si ya tienen un sitio construido con Manu Dev (para importar el brandbook) o si arrancan desde cero.
<!--OPTIONS:["Tengo un sitio en Manu Dev","Arranco desde cero"]-->

Cuando el usuario elija, emite:
<!--MARGARITA:{"next":"brandbook_source","data":{"has_manu_dev":"[si/no segun respuesta]"}}-->
Y pregunta directamente sobre el origen del brandbook.`,

    brandbook_source: `${base}

PASO: Origen del Brandbook
${manuDevProjects
  ? `El usuario tiene estos proyectos en Manu Dev:\n${manuDevProjects}\n\nMuestra las opciones para importar su brandbook.`
  : "El usuario no tiene proyectos en Manu Dev o arranca desde cero."}

Si tiene proyectos Manu Dev y quiere importar uno: muestra las opciones y cuando elija, emite:
<!--MARGARITA:{"next":"brandbook_collect","data":{"source":"manu_dev","project_id":X}}-->
"Perfecto, importo el brandbook de [nombre]. Ahora necesito algunos datos extra para tu estrategia de marketing."

Si arranca desde cero o no tiene proyectos: emite:
<!--MARGARITA:{"next":"brandbook_collect","data":{"source":"standalone"}}-->
"Perfecto, creamos el brandbook desde cero. Para empezar, cual es el nombre de tu negocio o marca?"`,

    brandbook_collect: `${base}

PASO: Completar el Brandbook — Negocio: ${brandName}
Necesitas recopilar estos datos de marketing (pide de a uno, no todos juntos):
1. Tono de voz: formal, casual, inspiracional, educativo, divertido
2. Valores de marca (2-3 valores clave)
3. Tagline o slogan
4. Propuesta de valor unica (que te diferencia de la competencia)

Si ya tienes algunos datos del brandbook importado de Manu Dev, pide SOLO los que faltan.
NO pidas datos que ya tenes (nombre, industria, colores, descripcion).

Cuando tengas los 4 datos, emite el marcador con TODOS los datos recopilados:
<!--MARGARITA:{"next":"brandbook_confirm","data":{
  "business_name":"...",
  "industry":"...",
  "tone_of_voice":"...",
  "brand_values":["valor1","valor2"],
  "tagline":"...",
  "unique_value_proposition":"..."
}}-->
Y presenta el resumen del brandbook al usuario.`,

    brandbook_confirm: `${base}

PASO: Confirmar Brandbook — Negocio: ${brandName}
Muestra el brandbook completo al usuario de forma clara y estructurada.
Pregunta si quiere ajustar algo o si todo esta correcto.
<!--OPTIONS:["El brandbook esta perfecto","Quiero ajustar algo"]-->

Si el usuario aprueba, emite:
<!--MARGARITA:{"next":"social_select","data":{"confirmed":true}}-->
"Brandbook confirmado. Ahora elegis en que redes sociales queres tener presencia:"
<!--OPTIONS:["Facebook","Instagram","LinkedIn","Google Business","X/Twitter","Todas las anteriores"]-->

Si quiere ajustar, ayudalo a modificar el campo que quiere cambiar y luego vuelve a confirmar.`,

    social_select: `${base}

PASO: Seleccion de Redes Sociales — Negocio: ${brandName}
El usuario esta eligiendo las redes sociales donde quiere publicar contenido.

Cuando el usuario elija las redes (puede ser "todas" o una combinacion), emite:
<!--MARGARITA:{"next":"strategy","data":{"platforms":["facebook","instagram","linkedin"]}}-->
Adapta el array de platforms segun lo que eligio (valores validos: facebook, instagram, linkedin, x, gmb).

Luego informa que vas a generar la estrategia:
"Generando tu estrategia de contenido para [redes]. Esto toma unos segundos..."`,

    strategy: `${base}

PASO: Revision de Estrategia — Negocio: ${brandName}
${
  ctx?.strategy
    ? `La estrategia YA fue generada. Estos son los datos REALES (usalos tal cual, no inventes otros pilares, frecuencias ni tono):
- Titulo: ${ctx.strategy.title || "-"}
- Pilares de contenido: ${JSON.stringify(strategyPillars)}
- Frecuencia de publicacion: ${JSON.stringify(strategyFrequency)}
- Guia de voz: ${ctx.strategy.brand_voice_guidelines || "-"}

El usuario ya vio esta estrategia completa en el panel lateral, asi que NO la repitas entera. Reacciona breve a lo que te diga.`
    : "La estrategia todavia se esta generando. No inventes pilares, frecuencias ni tono — decile al usuario que esta lista en un momento."
}
<!--OPTIONS:["La estrategia me parece bien","Quiero ajustar algo"]-->

Si el usuario aprueba, emite:
<!--MARGARITA:{"next":"strategy_confirm","data":{"confirmed":true}}-->
"Genial, genero el contenido de las proximas 2 semanas..."

Si quiere ajustar algo, pregunta que quiere cambiar (todavia no emitas el marcador).`,

    strategy_confirm: `${base}

PASO: Generacion de Contenido — Negocio: ${brandName}
${
  ctx?.contentCount
    ? `Ya se generaron ${ctx.contentCount} posts para las proximas 2 semanas y el usuario los esta viendo en el panel de contenido. No repitas la lista completa ni inventes detalles de posts que no te dieron — confirma brevemente y pregunta si quiere crear el calendario en ClickUp.`
    : "El contenido todavia se esta generando en este momento. NO afirmes que ya esta listo ni inventes captions, hashtags o descripciones visuales — decile al usuario que en instantes va a poder revisarlo."
}

Cuando el usuario confirme que quiere avanzar, emite:
<!--MARGARITA:{"next":"content_generate","data":{"confirmed":true}}-->`,

    content_generate: `${base}

PASO: Revision de Contenido — Negocio: ${brandName}
${
  ctx?.contentCount
    ? `Los ${ctx.contentCount} posts ya estan generados y el usuario los esta revisando en el panel. El calendario en ClickUp TODAVIA NO fue creado.`
    : "El contenido se esta generando."
}
Informa que al confirmar, se va a crear el calendario en ClickUp con todas las tareas de publicacion.

Cuando el usuario confirme, emite:
<!--MARGARITA:{"next":"calendar_create","data":{"confirmed":true}}-->`,

    calendar_create: `${base}

PASO: Configuracion Final — Negocio: ${brandName}
${
  ctx?.strategy?.calendar_url
    ? `El calendario ya fue creado en ClickUp (${ctx.strategy.calendar_url}).`
    : "El calendario se esta creando en ClickUp en este momento."
}
Resume brevemente lo logrado (brandbook, estrategia, contenido, calendario) usando solo los datos reales del contexto, y ofrece conectar redes sociales para programar la publicacion automatica.

Emite la transicion final:
<!--MARGARITA:{"next":"complete","data":{}}-->
"Todo listo! Ahora podes conectar tus redes sociales para programar la publicacion automatica."`,

    complete: `${base}

PASO: Chat Continuo (post-configuracion) — Negocio: ${brandName}
El sistema de marketing ya esta configurado. Esta es la conversacion principal en curso: NO hay mas marcadores de flujo que emitir, es chat libre. Estos son los datos REALES del negocio y su estrategia — usalos como base de cualquier respuesta, no inventes otros:
- Industria: ${ctx?.industry || "-"}
- Tono de voz: ${ctx?.tone_of_voice || "-"}
- Valores de marca: ${JSON.stringify(brandValues)}
- Tagline: ${ctx?.tagline || "-"}
- Propuesta de valor: ${ctx?.unique_value_proposition || "-"}
${
  ctx?.strategy
    ? `- Pilares de contenido: ${JSON.stringify(strategyPillars)}
- Frecuencia de publicacion: ${JSON.stringify(strategyFrequency)}
- Guia de voz: ${ctx.strategy.brand_voice_guidelines || "-"}
- Estrategia de hashtags: ${ctx.strategy.hashtag_strategy || "-"}
- Redes conectadas: ${JSON.stringify(strategyPlatforms)}
- Posts generados: ${ctx?.contentCount ?? 0}
- Calendario ClickUp: ${ctx.strategy.calendar_url || "todavia no creado"}`
    : "- Todavia no hay estrategia registrada para este negocio."
}

Ayuda al usuario con lo que necesite, siempre en base a los datos reales de arriba:
- Generar mas contenido (pedile que confirme y avisa que se va a generar, no digas que ya esta listo)
- Conectar redes sociales
- Ajustar la estrategia
- Si pregunta por metricas de rendimiento, recorda que todavia no estan disponibles — no inventes numeros`,
  };

  return steps[step] || steps.welcome;
}

function parseMessage(text: string): {
  cleanText: string;
  next?: string;
  data?: Record<string, any>;
  options?: string[];
} {
  let cleanText = text;
  let next: string | undefined;
  let data: Record<string, any> | undefined;
  let options: string[] | undefined;

  const margaritaMatch = cleanText.match(/<!--MARGARITA:(\{[\s\S]*?\})-->/);
  if (margaritaMatch) {
    try {
      const parsed = JSON.parse(margaritaMatch[1]);
      cleanText = cleanText.replace(margaritaMatch[0], "");
      next = parsed.next;
      data = parsed.data;
    } catch (error) {
      logger.warn("Error al parsear marker MARGARITA — se omite el bloque de control de flujo");
    }
  }

  const optionsMatch = cleanText.match(/<!--OPTIONS:(\[[\s\S]*?\])-->/);
  if (optionsMatch) {
    try {
      options = JSON.parse(optionsMatch[1]);
      cleanText = cleanText.replace(optionsMatch[0], "");
    } catch (error) {
      logger.warn("Error al parsear marker OPTIONS — se omiten las opciones sugeridas");
    }
  }

  return { cleanText: cleanText.trim(), next, data, options };
}

// Cuando todavia no hay brandbook_id (onboarding en curso), el bucket brandbook_id IS NULL
// se scopea ademas por session_id para no mezclar intentos de onboarding abandonados del mismo usuario.
function nullBucketClause(sessionId: string | null): { clause: string; extraParams: any[] } {
  return sessionId
    ? { clause: "AND brandbook_id IS NULL AND session_id = ?", extraParams: [sessionId] }
    : { clause: "AND brandbook_id IS NULL", extraParams: [] };
}

async function getCurrentStep(userId: number, brandbookId: number | null, sessionId: string | null): Promise<Step> {
  const pool = getPool();
  const { clause, extraParams } = brandbookId ? { clause: "AND brandbook_id = ?", extraParams: [brandbookId] } : nullBucketClause(sessionId);
  const [rows] = (await pool.execute(
    `SELECT step FROM mm_chat_history WHERE user_id = ? ${clause} AND role = "assistant" ORDER BY created_at DESC LIMIT 1`,
    [userId, ...extraParams]
  )) as any;
  return (rows[0]?.step as Step) || "welcome";
}

async function getHistory(userId: number, brandbookId: number | null, sessionId: string | null) {
  const pool = getPool();
  const { clause, extraParams } = brandbookId ? { clause: "AND brandbook_id = ?", extraParams: [brandbookId] } : nullBucketClause(sessionId);
  const [rows] = (await pool.execute(
    `SELECT role, content FROM mm_chat_history WHERE user_id = ? ${clause} ORDER BY created_at ASC LIMIT 50`,
    [userId, ...extraParams]
  )) as any;
  return rows as { role: "user" | "assistant"; content: string }[];
}

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

    const body = await req.json();
    const message: string = body.message ?? "";
    const brandbook_id: number | null = body.brandbook_id ?? null;
    const session_id: string | null = typeof body.session_id === "string" && body.session_id ? body.session_id : null;

    if (!message.trim()) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

    await ensureTables();
    const pool = getPool();

    const currentStep = await getCurrentStep(user.id, brandbook_id, session_id);
    const history = await getHistory(user.id, brandbook_id, session_id);

    // Build context for system prompt
    let ctx: Record<string, any> = {};
    if (brandbook_id) {
      const [bRows] = (await pool.execute(
        "SELECT * FROM mm_brandbooks WHERE id = ? AND user_id = ?",
        [brandbook_id, user.id]
      )) as any;
      if (bRows[0]) ctx = bRows[0];

      const [sRows] = (await pool.execute(
        "SELECT * FROM mm_strategies WHERE brandbook_id = ? ORDER BY created_at DESC LIMIT 1",
        [brandbook_id]
      )) as any;
      if (sRows[0]) {
        ctx.strategy = sRows[0];
        const [cRows] = (await pool.execute(
          "SELECT COUNT(*) as cnt FROM mm_content WHERE strategy_id = ?",
          [sRows[0].id]
        )) as any;
        ctx.contentCount = cRows[0]?.cnt || 0;
      }
    }

    // For welcome/brandbook_source: inject Manu Dev projects
    if (currentStep === "welcome" || currentStep === "brandbook_source") {
      ctx.manu_dev_projects = await getManuDevProjects(user.id);
    }

    await pool.execute(
      "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step, session_id) VALUES (?, ?, 'user', ?, ?, ?)",
      [brandbook_id, user.id, message.trim(), currentStep, session_id]
    );

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = getSystemPrompt(currentStep, ctx);

    const rawHistory = [
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message.trim() },
    ];

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of rawHistory) {
      if (messages.length === 0 && msg.role !== "user") continue;
      if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
        messages[messages.length - 1].content += "\n" + msg.content;
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const encoder = new TextEncoder();
    let fullText = "";
    let buffer = "";
    const MARKER_PREFIX = "<!--";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages,
          });

          for await (const event of anthropicStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              if (!text) continue;

              fullText += text;
              buffer += text;

              const markerIdx = buffer.indexOf(MARKER_PREFIX);
              if (markerIdx >= 0) {
                if (markerIdx > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: buffer.slice(0, markerIdx) })}\n\n`)
                  );
                }
                buffer = buffer.slice(markerIdx);
              } else {
                const safeLen = buffer.length - (MARKER_PREFIX.length - 1);
                if (safeLen > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: buffer.slice(0, safeLen) })}\n\n`)
                  );
                  buffer = buffer.slice(safeLen);
                }
              }
            }
          }

          if (buffer) {
            const markerIdx = buffer.indexOf(MARKER_PREFIX);
            if (markerIdx > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: buffer.slice(0, markerIdx) })}\n\n`)
              );
            } else if (markerIdx < 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`)
              );
            }
          }

          const { cleanText, next, data, options } = parseMessage(fullText);
          const nextStep = (next as Step) || currentStep;
          let newBrandbookId = brandbook_id;

          await pool.execute(
            "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step, session_id) VALUES (?, ?, 'assistant', ?, ?, ?)",
            [brandbook_id, user.id, cleanText, nextStep, session_id]
          );

          // DB side effects on step transitions
          if (next && data) {
            if (next === "brandbook_collect" && !brandbook_id) {
              // Create brandbook record
              const [result] = (await pool.execute(
                "INSERT INTO mm_brandbooks (user_id, project_id) VALUES (?, ?)",
                [user.id, data.project_id || null]
              )) as any;
              newBrandbookId = result.insertId;

              // If importing from Manu Dev, copy data
              if (data.source === "manu_dev" && data.project_id) {
                const [pRows] = (await pool.execute(
                  `SELECT p.*, d.primary_color, d.secondary_color, d.accent_color, d.font_heading, d.font_body
                   FROM md_projects p
                   LEFT JOIN md_design d ON d.project_id = p.id
                   WHERE p.id = ? AND p.user_id = ?`,
                  [data.project_id, user.id]
                )) as any;
                if (pRows[0]) {
                  const p = pRows[0];
                  await pool.execute(
                    `UPDATE mm_brandbooks SET
                      business_name = ?, industry = ?, description = ?,
                      location = ?, audience = ?,
                      primary_color = ?, secondary_color = ?, accent_color = ?,
                      font_heading = ?, font_body = ?, logo_url = ?
                     WHERE id = ?`,
                    [
                      p.name, p.industry, p.description,
                      p.location, p.audience,
                      p.primary_color, p.secondary_color, p.accent_color,
                      p.font_heading, p.font_body, p.logo_url,
                      newBrandbookId,
                    ]
                  );
                }
              }

              // Update chat history to reference new brandbook — solo los mensajes de ESTA sesion de onboarding,
              // para no arrastrar intentos abandonados anteriores del mismo usuario.
              await pool.execute(
                session_id
                  ? "UPDATE mm_chat_history SET brandbook_id = ? WHERE user_id = ? AND brandbook_id IS NULL AND session_id = ?"
                  : "UPDATE mm_chat_history SET brandbook_id = ? WHERE user_id = ? AND brandbook_id IS NULL",
                session_id ? [newBrandbookId, user.id, session_id] : [newBrandbookId, user.id]
              );
            } else if (next === "brandbook_confirm" && newBrandbookId) {
              // Save collected brandbook fields
              await pool.execute(
                `UPDATE mm_brandbooks SET
                  business_name = COALESCE(?, business_name),
                  industry = COALESCE(?, industry),
                  tone_of_voice = ?,
                  brand_values = ?,
                  tagline = ?,
                  unique_value_proposition = ?
                 WHERE id = ? AND user_id = ?`,
                [
                  data.business_name || null,
                  data.industry || null,
                  data.tone_of_voice || null,
                  data.brand_values ? JSON.stringify(data.brand_values) : null,
                  data.tagline || null,
                  data.unique_value_proposition || null,
                  newBrandbookId,
                  user.id,
                ]
              );
            } else if (next === "strategy" && data.platforms && newBrandbookId) {
              // Save selected platforms to brandbook (will be used by strategy route)
              await pool.execute(
                `INSERT INTO mm_strategies (brandbook_id, selected_platforms)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE selected_platforms = VALUES(selected_platforms)`,
                [newBrandbookId, JSON.stringify(data.platforms)]
              );
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                step: nextStep,
                brandbook_id: newBrandbookId,
                options,
                cleanText,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err?.message || "Error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/margarita/chat?brandbook_id=X | ?session_id=Y — rehidrata la conversacion (p.ej. tras un refresh de pagina)
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const brandbookIdParam = searchParams.get("brandbook_id");
    const sessionId = searchParams.get("session_id");
    const brandbook_id = brandbookIdParam ? Number(brandbookIdParam) : null;

    if (!brandbook_id && !sessionId) {
      return NextResponse.json({ error: "brandbook_id o session_id requerido" }, { status: 400 });
    }

    if (brandbook_id) {
      const [bRows] = (await pool.execute(
        "SELECT id FROM mm_brandbooks WHERE id = ? AND user_id = ?",
        [brandbook_id, user.id]
      )) as any;
      if (!bRows[0]) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const step = await getCurrentStep(user.id, brandbook_id, sessionId);
    const history = await getHistory(user.id, brandbook_id, sessionId);

    let strategy: any = null;
    let posts: any[] = [];
    let calendarUrl: string | null = null;

    if (brandbook_id) {
      const [sRows] = (await pool.execute(
        "SELECT * FROM mm_strategies WHERE brandbook_id = ? ORDER BY created_at DESC LIMIT 1",
        [brandbook_id]
      )) as any;
      if (sRows[0]) {
        const s = sRows[0];
        strategy = {
          id: s.id,
          title: s.title,
          objectives: safeParseJSON(s.objectives) || [],
          target_audience: s.target_audience,
          content_pillars: safeParseJSON(s.content_pillars) || [],
          posting_frequency: safeParseJSON(s.posting_frequency) || {},
          brand_voice_guidelines: s.brand_voice_guidelines,
          hashtag_strategy: s.hashtag_strategy,
          selected_platforms: safeParseJSON(s.selected_platforms) || [],
          calendar_url: s.calendar_url,
        };
        calendarUrl = s.calendar_url || null;

        const [pRows] = (await pool.execute(
          "SELECT * FROM mm_content WHERE strategy_id = ? ORDER BY scheduled_at ASC",
          [s.id]
        )) as any;
        posts = pRows;
      }
    }

    return NextResponse.json({
      step,
      messages: history,
      brandbook_id,
      strategy,
      posts,
      calendar_url: calendarUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
