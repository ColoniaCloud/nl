import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("Manu Dev");
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import getPool from "@/lib/db-manu";
import { upsertBrandbook, linkAgentProject, getBrandContext } from "@/lib/shared-project";
import { generateLogo, downloadLogoLocally } from "@/lib/logo-generator";
import { getAgent, loadSystemPrompt } from "@/lib/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const CHAT_MODEL = getAgent("manu-dev")!.model;

type Step =
  | "pick_type"
  | "welcome"
  | "subdomain"
  | "identity"
  | "address"
  | "logo"
  | "colors"
  | "fonts"
  | "social"
  | "site_type"
  | "content"
  | "building"
  | "complete"
  | "cms";

// ─── DB helpers ──────────────────────────────────────────────────────────────

const REQUIRED_MD_COLUMNS: Record<string, string> = {
  location:        "ALTER TABLE md_projects ADD COLUMN location VARCHAR(255) DEFAULT NULL",
  audience:        "ALTER TABLE md_projects ADD COLUMN audience VARCHAR(255) DEFAULT NULL",
  extra_content:   "ALTER TABLE md_projects ADD COLUMN extra_content TEXT DEFAULT NULL",
  generation_mode: "ALTER TABLE md_projects ADD COLUMN generation_mode VARCHAR(16) DEFAULT 'auto'",
  site_type:       "ALTER TABLE md_projects ADD COLUMN site_type VARCHAR(32) DEFAULT NULL",
  address_type:    "ALTER TABLE md_projects ADD COLUMN address_type VARCHAR(16) DEFAULT NULL",
  social_links:    "ALTER TABLE md_projects ADD COLUMN social_links JSON DEFAULT NULL",
};

let columnsEnsured = false;
async function ensureProjectColumns() {
  if (columnsEnsured) return;
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'md_projects'"
  ) as any;
  const existing = new Set((rows as any[]).map((r: any) => r.COLUMN_NAME));
  for (const [col, sql] of Object.entries(REQUIRED_MD_COLUMNS)) {
    if (!existing.has(col)) {
      try { await pool.execute(sql); } catch {}
    }
  }
  columnsEnsured = true;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getUser(token: string): Promise<{ id: number; name: string } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      return { id: data.user.id, name: data.user.display_name || data.user.name || "" };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, name: data2.name || "" } : null;
}

// ─── Font helpers ────────────────────────────────────────────────────────────

const FONT_BODY_DEFAULTS: Record<string, string> = {
  "Playfair Display": "Inter",
  "Merriweather": "Open Sans",
  "Oswald": "Roboto",
  "Raleway": "Lato",
  "Space Grotesk": "DM Sans",
  "Outfit": "Inter",
  "Sora": "Inter",
  "Manrope": "Inter",
};

function resolveBodyFont(heading: string, body?: string): string {
  if (body && body !== heading) return body;
  return FONT_BODY_DEFAULTS[heading] ?? "Inter";
}

// ─── Subdomain helpers ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

async function generateSubdomainOptions(pool: any, name: string): Promise<string[]> {
  const base = slugify(name);
  if (!base) return ["mi-sitio", "mi-web", "mi-pagina"];
  const candidates = [
    base,
    base.length > 15 ? base.slice(0, 12) : `${base}-web`,
    `${base}-site`,
  ];
  const available: string[] = [];
  for (const c of candidates) {
    // A1: Check both tables so Manu Dev and Nubia never share the same subdomain
    const [mdRows] = (await pool.execute(
      "SELECT id FROM md_projects WHERE subdomain = ? LIMIT 1",
      [c]
    )) as any;
    const [nbRows] = (await pool.execute(
      "SELECT id FROM nb_projects WHERE subdomain = ? LIMIT 1",
      [c]
    )) as any;
    if (mdRows.length === 0 && nbRows.length === 0) {
      available.push(c);
    } else {
      const alt = `${c}-${Math.floor(Math.random() * 90) + 10}`;
      available.push(alt);
    }
  }
  return available;
}

// ─── System prompts ──────────────────────────────────────────────────────────

function getSystemPrompt(step: Step, projectData?: Record<string, any>, username?: string): string {
  const name = projectData?.name || "el proyecto";
  const industry = projectData?.industry || "general";
  const displayUser = username || "amigo";

  const base = loadSystemPrompt("manu-dev").trim();

  const steps: Record<Step, string> = {
    pick_type: `${base}

PASO: Tipo de sitio (bienvenida inicial)
El usuario acaba de escribir su primer mensaje. Saludalo brevemente (una frase) y presentale las 3 opciones:

"Hola! Antes de empezar, dime que tipo de sitio necesitas:"
<!--OPTIONS:["E-commerce (tienda online)","Web simple","Web profesional"]-->

Explica cada opcion en pocas palabras:
- **E-commerce**: Tienda con productos, carrito y pagos — te conectamos con Nubia, nuestro agente especializado.
- **Web simple**: Sitio informativo, blog o landing — generacion rapida con IA.
- **Web profesional**: Sitio Next.js completo, mas potente y personalizable (requiere plan Pro).

Si el mensaje del usuario ya indica claramente e-commerce o tienda (palabras como "tienda", "vender", "ecommerce", "productos", "shop"), puedes seleccionar "E-commerce" automaticamente y emitir el marcador directamente sin esperar.

Cuando el usuario elija "E-commerce (tienda online)":
"Perfecto! Para tiendas con carrito y pagos usamos Nubia. Te redirijo ahora."
<!--MANU:{"next":"redirect_nubia","data":{"site_type":"store_full"}}-->

Cuando el usuario elija "Web simple":
"Genial, vamos con el modo rapido. Como se llama tu negocio o proyecto?"
<!--MANU:{"next":"welcome","data":{"mode":"lite_plus"}}-->

Cuando el usuario elija "Web profesional":
"Excelente, vamos con Next.js. Como se llama tu negocio o proyecto?"
<!--MANU:{"next":"welcome","data":{"mode":"next"}}-->

IMPORTANTE: Solo emite el marcador MANU cuando el usuario haya elegido una opcion. En el primer mensaje, muestra las opciones y espera.`,

    welcome: `${base}

PASO: Bienvenida — Usuario: ${displayUser}
El usuario acaba de escribir el nombre de su proyecto o negocio. El mensaje del usuario ES el nombre del proyecto.
Tomalo tal cual como nombre del proyecto.

Genera un subdominio sugerido a partir del nombre del proyecto: pasalo a minusculas, reemplaza los espacios por guiones y elimina acentos y caracteres especiales (deja solo letras, numeros y guiones).

Respondé EXACTAMENTE con este formato (reemplazando lo que esta entre corchetes, sin los corchetes):
"Hola ${displayUser}! Vamos a crear el sitio web de [nombre del proyecto] en pocos minutos. Solo necesito que respondas algunas preguntas.

Primero, que subdominio queres usar? Te sugiero [subdominio-sugerido].nl360.site — lo usamos o preferis otro nombre?"
<!--MANU:{"next":"subdomain","data":{"name":"[nombre del proyecto]","suggested_subdomain":"[subdominio-sugerido]"}}-->

OBLIGATORIO: Siempre emiti el marcador MANU en este paso. El nombre del proyecto es lo que el usuario escribio.`,

    subdomain: `${base}

PASO: Subdominio — Proyecto: ${name}
El sistema genero automaticamente opciones de subdominio que aparecen como botones. El usuario esta eligiendo o puede escribir uno propio.

Cuando el usuario elija una opcion o escriba un subdominio:
Confirmalo y pedi el rubro:
"Listo, tu sitio va a estar en [subdominio].nl360.site. A que se dedica ${name}?"
<!--MANU:{"next":"identity","data":{"subdomain":"[el-elegido-sin-.nl360.site]"}}-->

IMPORTANTE: En "data.subdomain" guarda SOLO el slug (por ejemplo "mi-negocio"), no la URL completa.`,

    identity: `${base}

PASO: Identidad — Proyecto: ${name}
Necesitas 2 datos: rubro/industria y publico objetivo.
Pide de a uno en orden segun lo que ya tienes en el historial. NO pidas los dos juntos.

Primero pide el rubro/industria (si no lo tienes aun).
Luego pide a quien le venden, quien es su publico objetivo (si no lo tienes aun).

IMPORTANTE: Acepta la primera respuesta que de el usuario para cada dato. NO pidas que sea mas especifico ni hagas preguntas de seguimiento sobre el mismo dato.

Cuando tengas los 2 datos, emite el marcador y pregunta la direccion:
"Perfecto. Como es la direccion de tu negocio?"
<!--MANU:{"next":"address","data":{"industry":"...","audience":"..."}}-->`,

    address: `${base}

PASO: Direccion — Proyecto: ${name}
El usuario debe indicar donde opera su negocio.

Si el usuario ya escribio una direccion o ubicacion, aceptala tal cual sin pedir mas detalles y avanza:
"Direccion anotada. Tenes logo para ${name}, queres que genere uno con IA, o preferis continuar sin logo?"
<!--MANU:{"next":"logo","data":{"location":"[lo que dijo el usuario]","address_type":"specific"}}-->

Si el usuario eligio "Direccion especifica" (boton): pedi calle, ciudad y pais. Cuando responda, acepta y avanza con el marcador de arriba. NO pidas apartamento ni detalles extra.

Si el usuario eligio "Zona regional de operacion" (boton): pedi barrio, ciudad o pais. Cuando responda, acepta y avanza:
"Zona anotada. Tenes logo para ${name}, queres que genere uno con IA, o preferis continuar sin logo?"
<!--MANU:{"next":"logo","data":{"location":"[zona descripta]","address_type":"regional"}}-->

REGLA: Acepta la primera respuesta del usuario. NO pidas detalles adicionales.`,

    logo: `${base}

PASO: Logo — Proyecto: ${name}

GUIA DE PALETAS POR RUBRO (rubro actual: ${industry}):
En cualquier momento de este paso en que propongas una paleta, genera UNA paleta de 3 colores (primario, secundario, acento) ESPECIFICA para el rubro "${industry}". NO uses siempre los mismos colores. Basate en la psicologia del color para ese sector:
- Moda / boutique / calzado / indumentaria: neutros elegantes (negro, blanco, dorado, beige).
- Restaurante / gastronomia / cafe / comida: calidos (rojos, naranjas, marrones, crema).
- Salud / clinica / consultorio / medico: frescos (azules, verdes, blancos).
- Tecnologia / startup / software / app: modernos (azul electrico, gris oscuro, acento vibrante).
- Construccion / arquitectura / inmobiliaria: solidos (gris, negro, naranja, blanco).
- Fitness / gym / deporte: energeticos (negro, rojo, amarillo, naranja).
- Legal / abogados / contable: sobrios (azul marino, gris, blanco, dorado).
- Belleza / spa / estetica / peluqueria: suaves (rosa, lavanda, beige, dorado).
- Otro rubro: una paleta profesional acorde al nombre y la industria, basada en la psicologia del color de ese sector.

Si el usuario eligio "Generar logo con IA":
Decile que vas a generar el logo:
"Dale, genero el logo para ${name} ahora mismo."
<!--LOGO_GENERATE-->
El sistema mostrara el resultado. No hagas nada mas — espera la respuesta del usuario.

Si el usuario aprobo el logo ("me gusta", "usarlo", etc.):
Emite el marcador y propone una paleta segun la GUIA DE PALETAS POR RUBRO de arriba (rubro ${industry}) y el logo generado.
"Logo guardado. Para ${name} propongo esta paleta:
- [Nombre1]: #XXXXXX
- [Nombre2]: #XXXXXX
- [Nombre3]: #XXXXXX
[Breve justificacion]."
<!--COLORS:[{"name":"[Nombre1]","hex":"#XXXXXX"},{"name":"[Nombre2]","hex":"#XXXXXX"},{"name":"[Nombre3]","hex":"#XXXXXX"}]-->
<!--OPTIONS:["Me gusta esta paleta","Prefiero elegir mis colores"]-->
<!--MANU:{"next":"colors","data":{"logo_type":"generated","primary_color":"#XXXXXX","secondary_color":"#XXXXXX","accent_color":"#XXXXXX"}}-->

Si el usuario quiere otro logo: emiti <!--LOGO_GENERATE--> de nuevo.

Si el usuario eligio "Tengo logo, lo subo":
"Subi tu logo aca."
<!--UPLOAD:logo-->
<!--OPTIONS:["Ya subi mi logo","Continuar sin logo"]-->

Si el usuario confirmo upload:
Propone una paleta segun la GUIA DE PALETAS POR RUBRO de arriba (rubro ${industry}):
"Logo recibido. Para ${name} propongo esta paleta:
- [Nombre1]: #XXXXXX
- [Nombre2]: #XXXXXX
- [Nombre3]: #XXXXXX"
<!--COLORS:[{"name":"...","hex":"..."},{"name":"...","hex":"..."},{"name":"...","hex":"..."}]-->
<!--OPTIONS:["Me gusta esta paleta","Prefiero elegir mis colores"]-->
<!--MANU:{"next":"colors","data":{"logo_type":"uploaded","primary_color":"#XXXXXX","secondary_color":"#XXXXXX","accent_color":"#XXXXXX"}}-->

Si el usuario eligio "Continuar sin logo":
Propone una paleta segun la GUIA DE PALETAS POR RUBRO de arriba (rubro ${industry}):
"Sin problema, usamos el nombre como texto estilizado. Para ${name} propongo esta paleta:
- [Nombre1]: #XXXXXX
- [Nombre2]: #XXXXXX
- [Nombre3]: #XXXXXX"
<!--COLORS:[{"name":"...","hex":"..."},{"name":"...","hex":"..."},{"name":"...","hex":"..."}]-->
<!--OPTIONS:["Me gusta esta paleta","Prefiero elegir mis colores"]-->
<!--MANU:{"next":"colors","data":{"logo_type":"text","primary_color":"#XXXXXX","secondary_color":"#XXXXXX","accent_color":"#XXXXXX"}}-->`,

    colors: `${base}

PASO: Colores — Proyecto: ${name}
Una paleta de colores fue propuesta en el mensaje anterior.

Si el usuario la aprobo ("me gusta", etc.):
Sugeri 6 fuentes de Google Fonts que encajen con ${industry} y deci:
"Paleta guardada. Ahora elegi la tipografia para ${name}. Te sugiero estas fuentes:"
<!--FONTS:[{"name":"[Fuente1]"},{"name":"[Fuente2]"},{"name":"[Fuente3]"},{"name":"[Fuente4]"},{"name":"[Fuente5]"},{"name":"[Fuente6]"}]-->
<!--OPTIONS:["[Fuente1]","[Fuente2]","[Fuente3]","[Fuente4]","[Fuente5]","[Fuente6]"]-->
<!--MANU:{"next":"fonts","data":{"primary_color":"#XXXXXX","secondary_color":"#XXXXXX","accent_color":"#XXXXXX"}}-->

IMPORTANTE: Usa EXACTAMENTE nombres reales de Google Fonts. Ejemplos validos: "Poppins", "Montserrat", "Playfair Display", "Inter", "Roboto", "Lato", "Open Sans", "Raleway", "Oswald", "Merriweather", "Nunito", "DM Sans", "Space Grotesk", "Outfit", "Sora", "Manrope". NO inventes nombres de fuentes.

Si el usuario quiere otros colores: propone nueva paleta con <!--COLORS:[]-->, espera aprobacion, y luego transiciona a fuentes.`,

    fonts: `${base}

PASO: Tipografia — Proyecto: ${name}
Las fuentes fueron propuestas y el usuario esta eligiendo.

Cuando el usuario elija una fuente (clic en opcion o escribe nombre):
Usa esa fuente para titulos. Asigna automaticamente una fuente complementaria para el cuerpo.
Pares recomendados: Montserrat+Open Sans, Playfair Display+Lato, Poppins+Inter, Oswald+Roboto, Space Grotesk+DM Sans, Raleway+Nunito.
Si el usuario eligio una fuente sans-serif moderna, usa otra sans-serif complementaria para body.
Si eligio una serif, usa una sans-serif para body.

"[Fuente] para titulos y [complementaria] para textos. Ahora necesito tus redes. Tenes numero de WhatsApp para poner en el sitio?"
<!--MANU:{"next":"social","data":{"font_heading":"[Fuente elegida]","font_body":"[fuente complementaria]"}}-->`,

    social: `${base}

PASO: Redes sociales y contacto — Proyecto: ${name}
Recolecta redes sociales y datos de contacto del negocio. Pregunta de a una.

Primero pregunta por WhatsApp (si no lo tienes): "Tenes numero de WhatsApp para el sitio?"
Si da WhatsApp, pregunta por otras redes: "Que otras redes tiene ${name}? Instagram, Facebook, TikTok, o alguna otra?"
Si dice que no tiene WhatsApp, pregunta igualmente por las otras redes.
Despues de las redes, pregunta SIEMPRE: "Tenes un email de contacto para el sitio? (lo vamos a mostrar en el pie de pagina y los formularios)"
Si no tiene email, acepta y continua.

Cuando tengas toda la info (redes + email o confirmacion de que no tiene):
"Perfecto! Que estilo de contenido va a tener ${name}?"
<!--OPTIONS:["Tienda con catalogo (WhatsApp)","Blog","Web informativa"]-->
<!--MANU:{"next":"site_type","data":{"social_links":[...]}}}-->

En social_links, incluye TODAS las redes Y el email confirmados:
[{"platform":"whatsapp","value":"+5491234..."},{"platform":"instagram","value":"@usuario"},{"platform":"email","value":"info@negocio.com"}]
Plataformas validas: whatsapp, instagram, facebook, tiktok, youtube, twitter, linkedin, pinterest, telegram, email.
Si no tiene redes ni email, usa array vacio [].`,

    site_type: `${base}

PASO: Estilo de contenido — Proyecto: ${name}
El usuario esta eligiendo el tipo de contenido de su sitio (ya eligio el modo tecnico antes).

Muestra las opciones si no estan visibles:
<!--OPTIONS:["Tienda con catalogo (WhatsApp)","Blog","Web informativa"]-->

Si elige "Tienda con catalogo (WhatsApp)":
"Perfecto, ${name} va a ser una tienda con catalogo y boton de compra por WhatsApp. Una ultima cosa antes de construir."
<!--MANU:{"next":"content","data":{"site_type":"store"}}-->

Si elige "Blog":
"Perfecto, ${name} va a ser un blog. Una ultima cosa antes de construir."
<!--MANU:{"next":"content","data":{"site_type":"blog"}}-->

Si elige "Web informativa":
"Perfecto, ${name} va a ser una web informativa. Una ultima cosa antes de construir."
<!--MANU:{"next":"content","data":{"site_type":"informational"}}-->

REGLA: Siempre emiti el marcador MANU en este paso. No pidas mas informacion.`,

    content: `${base}

PASO: Contenido — Proyecto: ${name}
Necesitas entender el negocio antes de construir. Hace EXACTAMENTE estas 3 preguntas en UN solo mensaje:

"Antes de construir tu sitio, necesito entender mejor tu negocio. Respondé estas 3 preguntas (podés ser breve):

1. Que hace ${name} y que lo diferencia de la competencia?
2. Quien es tu cliente ideal?
3. Que querés que haga el visitante cuando entre al sitio? (ej: que te llame, que compre, que reserve un turno)"

No emitas ningun marcador en este primer mensaje — espera a que el usuario responda.

Cuando el usuario responda (en uno o varios mensajes), agradece en una frase y arranca la construccion:
"Listo, con esto ya puedo construir ${name}. Arranco con la construccion ahora."
<!--MANU:{"next":"building","data":{}}-->

REGLA: Acepta las respuestas del usuario tal cual, no pidas mas detalles. Emiti el marcador MANU solo una vez que el usuario ya respondio las preguntas.`,

    building: `${base}

PASO: Construccion
El sitio esta siendo generado automaticamente. Informa al usuario que el proceso comenzo y tomara unos minutos.
No pidas mas informacion.`,

    complete: `${base}

PASO: Sitio listo
El sitio fue creado exitosamente.
Solo informa el enlace del sitio y ofrece ayuda para editarlo desde NL360.
No menciones credenciales, emails de acceso ni rutas tecnicas.`,

    cms: `${base}

PASO: Administracion del sitio
Ayuda al usuario a actualizar su sitio. Puede pedir cambios en textos, imagenes, colores o secciones.
Confirma los cambios antes de ejecutarlos.
No des credenciales ni rutas de admin; guia siempre dentro del panel de NL360.`,
  };

  return steps[step] || steps.welcome;
}

// ─── Message parsing ─────────────────────────────────────────────────────────

function parseMessage(text: string): {
  cleanText: string;
  next?: string;
  data?: Record<string, any>;
  options?: string[];
  colors?: { name: string; hex: string }[];
  fonts?: { name: string }[];
  upload?: string;
  logoGenerate?: boolean;
} {
  let cleanText = text;
  let next: string | undefined;
  let data: Record<string, any> | undefined;
  let options: string[] | undefined;
  let colors: { name: string; hex: string }[] | undefined;
  let fonts: { name: string }[] | undefined;
  let upload: string | undefined;
  let logoGenerate = false;

  const manuMatch = cleanText.match(/<!--MANU:(\{[\s\S]*?\})-->/);
  if (manuMatch) {
    try {
      const parsed = JSON.parse(manuMatch[1]);
      cleanText = cleanText.replace(manuMatch[0], "");
      next = parsed.next;
      data = parsed.data;
    } catch (e) {
      console.error("[chat] Failed to parse MANU marker:", manuMatch[1].slice(0, 200), e);
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

  const colorsMatch = cleanText.match(/<!--COLORS:(\[[\s\S]*?\])-->/);
  if (colorsMatch) {
    try {
      colors = JSON.parse(colorsMatch[1]);
      cleanText = cleanText.replace(colorsMatch[0], "");
    } catch (error) {
      logger.warn("Error al parsear marker COLORS — se omite la paleta de colores");
    }
  }

  const fontsMatch = cleanText.match(/<!--FONTS:(\[[\s\S]*?\])-->/);
  if (fontsMatch) {
    try {
      fonts = JSON.parse(fontsMatch[1]);
      cleanText = cleanText.replace(fontsMatch[0], "");
    } catch (error) {
      logger.warn("Error al parsear marker FONTS — se omiten las tipografías");
    }
  }

  const uploadMatch = cleanText.match(/<!--UPLOAD:([a-z]+)-->/);
  if (uploadMatch) {
    upload = uploadMatch[1];
    cleanText = cleanText.replace(uploadMatch[0], "");
  }

  if (cleanText.includes("<!--LOGO_GENERATE-->")) {
    logoGenerate = true;
    cleanText = cleanText.replace("<!--LOGO_GENERATE-->", "").trim();
  }

  return { cleanText: cleanText.trim(), next, data, options, colors, fonts, upload, logoGenerate };
}

// ─── Chat history ────────────────────────────────────────────────────────────

async function getCurrentStep(userId: number, projectId: number | null): Promise<Step> {
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT step FROM md_chat_history WHERE user_id = ? ${
      projectId ? "AND project_id = ?" : "AND project_id IS NULL"
    } AND role = "assistant" ORDER BY created_at DESC LIMIT 1`,
    projectId ? [userId, projectId] : [userId]
  )) as any;
  return (rows[0]?.step as Step) || "pick_type";
}

async function getHistory(userId: number, projectId: number | null) {
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT role, content FROM md_chat_history WHERE user_id = ? ${
      projectId ? "AND project_id = ?" : "AND project_id IS NULL"
    } ORDER BY created_at ASC LIMIT 50`,
    projectId ? [userId, projectId] : [userId]
  )) as any;
  return rows as { role: "user" | "assistant"; content: string }[];
}

// ─── Error helpers ───────────────────────────────────────────────────────────

function toUserFacingAiError(err: any): string {
  const msg = String(err?.message || "error").toLowerCase();
  if (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) {
    return "El servicio de IA esta saturado ahora. Intenta de nuevo en unos segundos.";
  }
  if (msg.includes("timeout") || msg.includes("timed out") || err?.name === "AbortError") {
    return "La respuesta de IA tardo demasiado (timeout). Intenta de nuevo.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econn") || msg.includes("enotfound")) {
    return "Error de red al conectar con IA. Verifica tu conexion e intenta de nuevo.";
  }
  if (msg.includes("503") || msg.includes("502") || msg.includes("overloaded")) {
    return "El proveedor de IA esta temporalmente no disponible. Intenta de nuevo.";
  }
  return "No pude generar respuesta en este momento. Intenta de nuevo.";
}

function sanitizeAssistantText(text: string, step: Step, siteUrl?: string): { text: string; sanitized: boolean } {
  const guardedSteps = new Set<Step>(["complete", "cms", "building"]);
  if (!guardedSteps.has(step)) return { text, sanitized: false };

  const riskyPatterns: RegExp[] = [
    /usuario\s*:\s*/i,
    /contrasen?a\s*:\s*/i,
    /password\s*:\s*/i,
    /credenciales?/i,
    /te\s+(enviamos|mandamos|llega|llegara|llegaran)[^.\n]*(mail|email|correo)/i,
    /[a-z0-9._%+-]+@nl360\.site/i,
    /\/(admin|wp-admin)\b/i,
  ];

  const hasRisk = riskyPatterns.some((rx) => rx.test(text));
  if (!hasRisk) return { text, sanitized: false };

  const safeUrl = siteUrl || "tu subdominio en nl360.site";
  const safeMessage =
    `Tu sitio ya esta listo en ${safeUrl}. ` +
    "Si queres, te guio para editar textos, imagenes y secciones desde el panel de NL360.";

  return { text: safeMessage, sanitized: true };
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id)
      return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const body = await req.json();
    const message: string = body.message ?? "";
    const project_id: number | null = body.project_id ?? null;
    const requestedMode: string = body.generation_mode ?? "next";
    const newConversation: boolean = body.new_conversation === true;
    const initialSiteType: string | null = body.initial_site_type ?? null;

    if (!message.trim())
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

    const pool = getPool();

    // Only clear orphaned chat history when explicitly starting a new conversation.
    // Previously this ran on every request with project_id=null, which deleted
    // in-progress welcome-step history and caused an infinite loop.
    if (!project_id && newConversation) {
      await pool.execute(
        "DELETE FROM md_chat_history WHERE user_id = ? AND project_id IS NULL",
        [user.id]
      );
    }

    // Declared in the outer scope so the /pro override below can set it and the
    // stream callback can read it via closure (assigned/read inside start()).
    let modeToReturn: string | undefined;

    let currentStep = await getCurrentStep(user.id, project_id);
    const history = await getHistory(user.id, project_id);

    // Skip pick_type when arriving from /pro with a pre-selected site type
    if (
      currentStep === "pick_type" &&
      !project_id &&
      initialSiteType === "professional"
    ) {
      currentStep = "welcome";
      modeToReturn = "lite_plus";
    }

    let projectData: Record<string, any> | null = null;
    if (project_id) {
      const [prows] = (await pool.execute(
        "SELECT * FROM md_projects WHERE id = ? AND user_id = ?",
        [project_id, user.id]
      )) as any;
      projectData = prows[0] || null;
    }

    await pool.execute(
      "INSERT INTO md_chat_history (project_id, user_id, role, content, step) VALUES (?, ?, 'user', ?, ?)",
      [project_id, user.id, message.trim(), currentStep]
    );

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const brandContext = project_id ? await getBrandContext(user.id) : null;
    const baseSystemPrompt = getSystemPrompt(currentStep, projectData ?? undefined, user.name);
    const systemPrompt = brandContext
      ? `${baseSystemPrompt}\n\nContexto de marca ya registrado:\n${brandContext}`
      : baseSystemPrompt;

    // Build messages — Anthropic requires alternating user/assistant starting with user
    const rawHistory = [
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message.trim() },
    ];

    // Ensure strictly alternating, starting with user
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
          let streamOk = false;
          let lastStreamError: any = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(`[chat] attempt=${attempt} step=${currentStep} msgLen=${messages.length} model=${CHAT_MODEL}`);
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
                        encoder.encode(
                          `data: ${JSON.stringify({ text: buffer.slice(0, markerIdx) })}\n\n`
                        )
                      );
                    }
                    buffer = buffer.slice(markerIdx);
                  } else {
                    const safeLen = buffer.length - (MARKER_PREFIX.length - 1);
                    if (safeLen > 0) {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ text: buffer.slice(0, safeLen) })}\n\n`
                        )
                      );
                      buffer = buffer.slice(safeLen);
                    }
                  }
                }
              }
              streamOk = true;
              break;
            } catch (err: any) {
              lastStreamError = err;
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 900));
              }
            }
          }

          if (!streamOk) {
            throw lastStreamError || new Error("ai_stream_failed");
          }

          // Flush remaining buffer (text before any marker)
          if (buffer) {
            const markerIdx = buffer.indexOf(MARKER_PREFIX);
            if (markerIdx > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: buffer.slice(0, markerIdx) })}\n\n`
                )
              );
            } else if (markerIdx < 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`)
              );
            }
          }

          const { cleanText, next: rawNext, data, options: parsedOptions, colors, fonts, upload, logoGenerate } = parseMessage(fullText);
          // Validate that the AI-emitted next step is a known step; reject invented steps
          const VALID_STEPS: Set<string> = new Set(["pick_type","welcome","subdomain","identity","address","logo","colors","fonts","social","site_type","content","building","complete","cms","redirect_nubia"]);
          const next = (rawNext && VALID_STEPS.has(rawNext)) ? rawNext : undefined;
          if (rawNext && !VALID_STEPS.has(rawNext)) {
            console.warn(`[chat] AI emitted unknown step "${rawNext}", ignoring marker`);
          }
          let options = parsedOptions;
          let nextStep: Step = (next as Step) || currentStep;
          let newProjectId = project_id;
          let logoPreview: string | undefined;

          const { text: safeCleanText, sanitized } = sanitizeAssistantText(
            cleanText,
            nextStep,
            projectData?.site_url
          );

          if (sanitized) {
            console.warn("[chat] Sanitized risky assistant text", {
              userId: user.id, projectId: project_id, step: nextStep,
            });
          }

          await pool.execute(
            "INSERT INTO md_chat_history (project_id, user_id, role, content, step) VALUES (?, ?, 'assistant', ?, ?)",
            [project_id, user.id, safeCleanText, nextStep]
          );

          // ── Logo generation ──
          if (logoGenerate && project_id && projectData) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ logoGenerating: true })}\n\n`)
            );
            const [dRows] = (await pool.execute(
              "SELECT primary_color, secondary_color, accent_color FROM md_design WHERE project_id = ?",
              [project_id]
            )) as any;
            const design = dRows[0] || {};
            const logoResult = await generateLogo({
              businessName: projectData.name || "Negocio",
              industry: projectData.industry || "empresa",
              primaryColor: design.primary_color,
              secondaryColor: design.secondary_color,
              accentColor: design.accent_color,
              style: "modern",
            });
            if (logoResult) {
              // Download SVG locally so generated site can use it without external dependency
              const localPath = await downloadLogoLocally(project_id, logoResult.url);
              const logoUrl = localPath ?? logoResult.url;
              logoPreview = logoUrl;
              await pool.execute(
                "UPDATE md_projects SET logo_url = ? WHERE id = ? AND user_id = ?",
                [logoUrl, project_id, user.id]
              );
              // Persist logo to shared brandbook
              await upsertBrandbook(user.id, { logo_url: logoUrl });
              if (!options) options = ["Me gusta, usarlo", "Generar otro logo", "Prefiero subir el mio"];
            } else {
              if (!options) options = ["Continuar sin logo", "Subir mi propio logo", "Intentar generar de nuevo"];
            }
          }

          // ── Data persistence per step transition ──
          if (next && data) {
            if (next === "welcome" && currentStep === "pick_type" && !project_id) {
              // pick_type -> welcome: User chose site type, store mode to return to frontend
              modeToReturn = data.mode || "lite_plus";
              if (!options || options.length === 0) {
                // No options needed here — AI already asked for name
              }

            } else if (next === "redirect_nubia" && currentStep === "pick_type" && !project_id) {
              // pick_type -> redirect_nubia: User chose e-commerce before any project was created
              nextStep = "redirect_nubia" as Step;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ done: true, step: "redirect_nubia", project_id: null, cleanText: safeCleanText, handoffId: null })}\n\n`
                )
              );
              controller.close();
              return;

            } else if (next === "subdomain" && !project_id) {
              // welcome -> subdomain: Create project
              await ensureProjectColumns();
              const tempSubdomain = `draft-${user.id}-${Date.now()}`;
              const [result] = (await pool.execute(
                "INSERT INTO md_projects (user_id, subdomain, name, generation_mode, status) VALUES (?, ?, ?, ?, 'draft')",
                [user.id, tempSubdomain, data.name || "Mi Proyecto", requestedMode]
              )) as any;
              newProjectId = result.insertId;
              await pool.execute(
                "UPDATE md_chat_history SET project_id = ? WHERE user_id = ? AND project_id IS NULL",
                [newProjectId, user.id]
              );
              // Upsert shared brandbook and link this md_project
              const sharedId = await upsertBrandbook(user.id, { name: data.name || "Mi Proyecto" });
              await linkAgentProject(sharedId, "manu_dev", newProjectId as number);
              await pool.execute(
                "UPDATE md_projects SET shared_project_id = ? WHERE id = ?",
                [sharedId, newProjectId]
              );
              // Generate subdomain suggestions
              const subOptions = await generateSubdomainOptions(pool, data.name || "mi-sitio");
              options = subOptions;

            } else if (next === "identity" && project_id && data.subdomain) {
              // subdomain -> identity: Save subdomain
              const sub = String(data.subdomain).replace(/\.nl360\.site$/i, "").trim();
              await pool.execute(
                "UPDATE md_projects SET subdomain = ?, site_url = ? WHERE id = ? AND user_id = ?",
                [sub, `https://${sub}.nl360.site`, project_id, user.id]
              );

            } else if (next === "address" && project_id) {
              // identity -> address: Save industry + audience
              await pool.execute(
                "UPDATE md_projects SET industry = ?, audience = ? WHERE id = ? AND user_id = ?",
                [data.industry || "", data.audience || "", project_id, user.id]
              );
              if (!options || options.length === 0) {
                options = ["Direccion especifica", "Zona regional de operacion"];
              }

            } else if (next === "logo" && project_id) {
              // address -> logo: Save location + address_type
              await pool.execute(
                "UPDATE md_projects SET location = ?, address_type = ? WHERE id = ? AND user_id = ?",
                [data.location || "", data.address_type || "regional", project_id, user.id]
              );
              if (!options || options.length === 0) {
                options = ["Tengo logo, lo subo", "Generar logo con IA", "Continuar sin logo"];
              }

            } else if (next === "fonts" && project_id) {
              // colors -> fonts: Save confirmed colors
              if (data.primary_color) {
                await pool.execute(
                  `INSERT INTO md_design (project_id, primary_color, secondary_color, accent_color, font_heading, font_body)
                   VALUES (?, ?, ?, ?, 'Inter', 'Inter')
                   ON DUPLICATE KEY UPDATE
                     primary_color = VALUES(primary_color),
                     secondary_color = VALUES(secondary_color),
                     accent_color = VALUES(accent_color)`,
                  [project_id, data.primary_color, data.secondary_color || "#ffffff", data.accent_color || "#666666"]
                );
                await upsertBrandbook(user.id, {
                  primary_color: data.primary_color,
                  secondary_color: data.secondary_color || "#ffffff",
                  accent_color: data.accent_color || "#666666",
                });
              }

            } else if (next === "social" && project_id) {
              // fonts -> social: Save fonts
              if (data.font_heading) {
                const fontBody = resolveBodyFont(data.font_heading, data.font_body);
                await pool.execute(
                  "UPDATE md_design SET font_heading = ?, font_body = ? WHERE project_id = ?",
                  [data.font_heading, fontBody, project_id]
                );
                await upsertBrandbook(user.id, {
                  font_heading: data.font_heading,
                  font_body: fontBody,
                });
              }

            } else if (next === "site_type" && project_id) {
              // social -> site_type: Save social links
              if (data.social_links) {
                await pool.execute(
                  "UPDATE md_projects SET social_links = ? WHERE id = ? AND user_id = ?",
                  [JSON.stringify(data.social_links), project_id, user.id]
                );
              }
              if (!options || options.length === 0) {
                options = ["Tienda con catalogo (WhatsApp)", "Blog", "Web informativa"];
              }

            } else if (next === "content" && project_id) {
              // site_type -> content: Save site_type, then the AI asks the 3 business questions
              if (data.site_type) {
                await pool.execute(
                  "UPDATE md_projects SET site_type = ? WHERE id = ? AND user_id = ?",
                  [data.site_type, project_id, user.id]
                );
              }

            } else if (next === "building" && project_id) {
              // content -> building: Start the build and persist the user's answers to the
              // 3 business questions into extra_content (replacing any previous value).
              await pool.execute(
                "UPDATE md_projects SET status = 'building' WHERE id = ? AND user_id = ?",
                [project_id, user.id]
              );
              try {
                const projName = projectData?.name || "tu negocio";
                const [answerRows] = await pool.execute(
                  "SELECT content FROM md_chat_history WHERE project_id = ? AND role = 'user' AND step = 'content' ORDER BY id ASC",
                  [project_id]
                ) as any;
                const answers = (answerRows as any[]).map((r) => r.content).join("\n").trim();
                const header =
                  `1. Que hace ${projName} y que lo diferencia de la competencia?\n` +
                  `2. Quien es el cliente ideal?\n` +
                  `3. Que se espera que haga el visitante cuando entra al sitio?`;
                const extraContent = `${header}\n\nRespuestas del cliente:\n${answers}`.slice(0, 3000);
                await pool.execute(
                  "UPDATE md_projects SET extra_content = ? WHERE id = ? AND user_id = ?",
                  [extraContent, project_id, user.id]
                );
              } catch (ecErr) {
                console.error("[chat] Failed to populate extra_content from content step:", ecErr);
              }

            } else if (next === "redirect_nubia" && project_id) {
              // site_type -> redirect_nubia: User chose full e-commerce
              // Collect project data to pass to Nubia
              const [projRows] = await pool.execute(
                "SELECT name, industry, subdomain, social_links FROM md_projects WHERE id = ? AND user_id = ?",
                [project_id, user.id]
              ) as any;
              const projData = projRows[0] || {};
              const [designRows] = await pool.execute(
                "SELECT primary_color, secondary_color, accent_color, font_heading, font_body FROM md_design WHERE project_id = ?",
                [project_id]
              ) as any;
              const designData = designRows[0] || {};
              let socialLinks: any[] = [];
              try { socialLinks = JSON.parse(projData.social_links || "[]"); } catch {}
              const nubiaHandoff = {
                name: projData.name || "",
                industry: projData.industry || "",
                subdomain: projData.subdomain || "",
                colors: {
                  primary: designData.primary_color || "",
                  secondary: designData.secondary_color || "",
                  accent: designData.accent_color || "",
                },
                fonts: {
                  heading: designData.font_heading || "",
                  body: designData.font_body || "",
                },
                email: socialLinks.find((s: any) => s.platform === "email")?.value || "",
                phone: socialLinks.find((s: any) => s.platform === "whatsapp")?.value || "",
                whatsapp: socialLinks.find((s: any) => s.platform === "whatsapp")?.value || "",
              };
              // M2: Store handoff in DB and pass only the id — avoids URL length limits
              let handoffId: number | null = null;
              try {
                const sp = await upsertBrandbook(user.id, {
                  name: nubiaHandoff.name,
                  industry: nubiaHandoff.industry,
                  primary_color: nubiaHandoff.colors.primary || undefined,
                  secondary_color: nubiaHandoff.colors.secondary || undefined,
                  accent_color: nubiaHandoff.colors.accent || undefined,
                  font_heading: nubiaHandoff.fonts.heading || undefined,
                  font_body: nubiaHandoff.fonts.body || undefined,
                  email: nubiaHandoff.email || undefined,
                  whatsapp: nubiaHandoff.whatsapp || undefined,
                });
                const { recordHandoff } = await import("@/lib/shared-project");
                handoffId = await recordHandoff(user.id, sp, "manu_dev", "nubia", nubiaHandoff as Record<string, unknown>);
              } catch (hErr) {
                logger.warn("No se pudo registrar handoff Manu Dev → Nubia");
              }
              // Pass redirect info in the response
              nextStep = "redirect_nubia" as Step;
              (options as any) = undefined;
              (colors as any) = undefined;
              (fonts as any) = undefined;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    step: "redirect_nubia",
                    project_id: newProjectId,
                    cleanText: safeCleanText,
                    handoffId,
                  })}\n\n`
                )
              );
              controller.close();
              return;
            }
          }

          // ── Programmatic fallback: pick_type → welcome or redirect_nubia ──
          if (currentStep === "pick_type" && nextStep === "pick_type" && !project_id) {
            const userLower = message.trim().toLowerCase();
            const combined = userLower;
            if (
              combined.includes("ecommerce") || combined.includes("e-commerce") ||
              combined.includes("tienda") || combined.includes("store") ||
              combined.includes("nubia")
            ) {
              console.log("[chat] Fallback pick_type: detected e-commerce, redirecting to Nubia");
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, step: "redirect_nubia", project_id: null, cleanText: safeCleanText, handoffId: null })}\n\n`)
              );
              controller.close();
              return;
            } else if (
              combined.includes("simple") || combined.includes("rapido") ||
              combined.includes("basico") || combined.includes("lite")
            ) {
              console.log("[chat] Fallback pick_type: detected simple mode");
              nextStep = "welcome" as Step;
              modeToReturn = "lite_plus";
            } else if (
              combined.includes("profesional") || combined.includes("next") ||
              combined.includes("avanzad") || combined.includes("premium")
            ) {
              console.log("[chat] Fallback pick_type: detected pro mode");
              nextStep = "welcome" as Step;
              modeToReturn = "next";
            }
          }

          // ── Programmatic fallback: site_type → building ──
          // If Claude didn't emit the MANU marker when in site_type step, detect the
          // user's choice and force the transition to building so it never gets stuck.
          if (currentStep === "site_type" && nextStep === "site_type" && project_id) {
            const userLower = message.trim().toLowerCase();
            const combined = (userLower + " " + (safeCleanText || "").toLowerCase());
            let detectedType: string | null = null;
            let redirectNubia = false;

            // Check for full e-commerce / Nubia redirect first
            if (combined.includes("completo") || combined.includes("nubia") || combined.includes("carrito") || combined.includes("mercadopago") || combined.includes("pagos")) {
              redirectNubia = true;
            } else if (combined.includes("simple") || combined.includes("whatsapp") || combined.includes("catalogo")) {
              detectedType = "store";
            } else if (combined.includes("tienda") || combined.includes("store") || combined.includes("ecommerce") || combined.includes("e-commerce")) {
              detectedType = "store";
            } else if (combined.includes("blog")) {
              detectedType = "blog";
            } else if (combined.includes("informativ") || combined.includes("web") || combined.includes("landing") || combined.includes("corporativ") || combined.includes("institucional")) {
              detectedType = "informational";
            }

            if (redirectNubia) {
              console.log(`[chat] Fallback site_type: detected Nubia redirect from user message`);
              // Collect project data for handoff
              const [projRows] = await pool.execute(
                "SELECT name, industry, subdomain, social_links FROM md_projects WHERE id = ? AND user_id = ?",
                [project_id, user.id]
              ) as any;
              const projData = projRows[0] || {};
              const [designRows] = await pool.execute(
                "SELECT primary_color, secondary_color, accent_color, font_heading, font_body FROM md_design WHERE project_id = ?",
                [project_id]
              ) as any;
              const designData = designRows[0] || {};
              let socialLinks: any[] = [];
              try { socialLinks = JSON.parse(projData.social_links || "[]"); } catch {}
              const nubiaHandoff = {
                name: projData.name || "",
                industry: projData.industry || "",
                subdomain: projData.subdomain || "",
                colors: { primary: designData.primary_color || "", secondary: designData.secondary_color || "", accent: designData.accent_color || "" },
                fonts: { heading: designData.font_heading || "", body: designData.font_body || "" },
                email: socialLinks.find((s: any) => s.platform === "email")?.value || "",
                phone: socialLinks.find((s: any) => s.platform === "whatsapp")?.value || "",
                whatsapp: socialLinks.find((s: any) => s.platform === "whatsapp")?.value || "",
              };
              // M2: Store handoff in DB (fallback path)
              let fallbackHandoffId: number | null = null;
              try {
                const sp = await upsertBrandbook(user.id, {});
                const { recordHandoff } = await import("@/lib/shared-project");
                fallbackHandoffId = await recordHandoff(user.id, sp, "manu_dev", "nubia", nubiaHandoff as Record<string, unknown>);
              } catch {}
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ done: true, step: "redirect_nubia", project_id: project_id, cleanText: safeCleanText, handoffId: fallbackHandoffId })}\n\n`
                )
              );
              controller.close();
              return;
            }

            if (detectedType) {
              console.log(`[chat] Fallback site_type: detected "${detectedType}" from user message, forcing content step`);
              // Save site_type only; extra_content is populated later in the content -> building transition.
              await pool.execute(
                "UPDATE md_projects SET site_type = ? WHERE id = ? AND user_id = ?",
                [detectedType, project_id, user.id]
              );
              nextStep = "content" as Step;
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                step: nextStep,
                project_id: newProjectId,
                options,
                colors,
                fonts,
                upload,
                cleanText: safeCleanText,
                logoPreview,
                ...(modeToReturn ? { mode: modeToReturn } : {}),
              })}\n\n`
            )
          );
          controller.close();
        } catch (err: any) {
          console.error("[chat] Stream error:", err?.message || err, { step: currentStep, userId: user.id });
          const message = toUserFacingAiError(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: message })}\n\n`
            )
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
