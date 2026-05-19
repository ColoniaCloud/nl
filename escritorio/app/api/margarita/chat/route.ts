import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const CHAT_MODEL = "claude-haiku-4-5-20251001";

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

function getSystemPrompt(step: Step, ctx?: Record<string, any>): string {
  const brandName = ctx?.business_name || "el negocio";
  const manuDevProjects: string = ctx?.manu_dev_projects
    ? (ctx.manu_dev_projects as { id: number; name: string }[])
        .map((p) => `- ${p.name} (ID: ${p.id})`)
        .join("\n")
    : "";

  const base = `Sos Margarita, una experta en marketing digital con IA que crea estrategias de contenido para redes sociales.
Personalidad: cercana, estrategica, entusiasta pero profesional. Espanol rioplatense informal (vos, tenes). Sin emojis excesivos. Respuestas breves (2-3 oraciones max).

REGLA CRITICA: Cuando tengas todos los datos del paso, emite el marcador <!--MARGARITA:{...}--> al FINAL del mensaje.
Los marcadores son invisibles — jamas los menciones. Siempre incluye la primera accion del siguiente paso en el mismo mensaje.`;

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

PASO: Estrategia Lista — Negocio: ${brandName}
La estrategia fue generada automaticamente. Presenta un resumen ejecutivo al usuario:
- 3 pilares de contenido principales
- Frecuencia de publicacion sugerida por red
- Tono y guia de voz
Pregunta si quiere ajustar algo o aprueba la estrategia.
<!--OPTIONS:["La estrategia me parece bien","Quiero ajustar algo"]-->

Si aprueba, emite:
<!--MARGARITA:{"next":"strategy_confirm","data":{"confirmed":true}}-->
"Estrategia aprobada. Genero el primer calendario de 2 semanas de contenido..."`,

    strategy_confirm: `${base}

PASO: Contenido Generado — Negocio: ${brandName}
El contenido de 2 semanas fue generado automaticamente. Informa al usuario que:
- Los posts fueron creados con captions y hashtags personalizados
- Se generaron descripciones visuales para cada imagen
- Puede revisar y editar cada post antes de programar

Cuando el usuario confirme, emite:
<!--MARGARITA:{"next":"content_generate","data":{"confirmed":true}}-->
"Creando el calendario en ClickUp con todos los posts..."`,

    content_generate: `${base}

PASO: Calendario Creado — Negocio: ${brandName}
El calendario en ClickUp fue creado con todas las tareas de publicacion.
Informa al usuario que puede:
1. Revisar los posts en ClickUp
2. Aprobar o modificar cada post
3. Una vez aprobados, se programan automaticamente en las redes

Cuando el usuario lo entienda, emite:
<!--MARGARITA:{"next":"calendar_create","data":{"confirmed":true}}-->`,

    calendar_create: `${base}

PASO: Configuracion Final — Negocio: ${brandName}
Todo el sistema esta configurado. Resume lo que se logro:
- Brandbook definido
- Estrategia de contenido creada
- Calendario de 2 semanas en ClickUp
- Listo para conectar redes sociales y programar

Emite la transicion final:
<!--MARGARITA:{"next":"complete","data":{}}-->
"Todo listo! Ahora podes conectar tus redes sociales para programar la publicacion automatica."`,

    complete: `${base}

PASO: Configuracion Completa — Negocio: ${brandName}
El sistema de marketing esta configurado. Ayuda al usuario con lo que necesite:
- Generar mas contenido
- Conectar redes sociales
- Revisar metricas
- Ajustar la estrategia`,
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
    } catch {}
  }

  const optionsMatch = cleanText.match(/<!--OPTIONS:(\[[\s\S]*?\])-->/);
  if (optionsMatch) {
    try {
      options = JSON.parse(optionsMatch[1]);
      cleanText = cleanText.replace(optionsMatch[0], "");
    } catch {}
  }

  return { cleanText: cleanText.trim(), next, data, options };
}

async function getCurrentStep(userId: number, brandbookId: number | null): Promise<Step> {
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT step FROM mm_chat_history WHERE user_id = ? ${
      brandbookId ? "AND brandbook_id = ?" : "AND brandbook_id IS NULL"
    } AND role = "assistant" ORDER BY created_at DESC LIMIT 1`,
    brandbookId ? [userId, brandbookId] : [userId]
  )) as any;
  return (rows[0]?.step as Step) || "welcome";
}

async function getHistory(userId: number, brandbookId: number | null) {
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT role, content FROM mm_chat_history WHERE user_id = ? ${
      brandbookId ? "AND brandbook_id = ?" : "AND brandbook_id IS NULL"
    } ORDER BY created_at ASC LIMIT 50`,
    brandbookId ? [userId, brandbookId] : [userId]
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

    const body = await req.json();
    const message: string = body.message ?? "";
    const brandbook_id: number | null = body.brandbook_id ?? null;

    if (!message.trim()) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

    await ensureTables();
    const pool = getPool();

    const currentStep = await getCurrentStep(user.id, brandbook_id);
    const history = await getHistory(user.id, brandbook_id);

    // Build context for system prompt
    let ctx: Record<string, any> = {};
    if (brandbook_id) {
      const [bRows] = (await pool.execute(
        "SELECT * FROM mm_brandbooks WHERE id = ? AND user_id = ?",
        [brandbook_id, user.id]
      )) as any;
      if (bRows[0]) ctx = bRows[0];
    }

    // For welcome/brandbook_source: inject Manu Dev projects
    if (currentStep === "welcome" || currentStep === "brandbook_source") {
      ctx.manu_dev_projects = await getManuDevProjects(user.id);
    }

    await pool.execute(
      "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step) VALUES (?, ?, 'user', ?, ?)",
      [brandbook_id, user.id, message.trim(), currentStep]
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
            "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step) VALUES (?, ?, 'assistant', ?, ?)",
            [brandbook_id, user.id, cleanText, nextStep]
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

              // Update chat history to reference new brandbook
              await pool.execute(
                "UPDATE mm_chat_history SET brandbook_id = ? WHERE user_id = ? AND brandbook_id IS NULL",
                [newBrandbookId, user.id]
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
