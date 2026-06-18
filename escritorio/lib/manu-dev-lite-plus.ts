// ─── Lite+ Site Generator ────────────────────────────────────────────────────
// Architecture: shared layout (1 LLM call) + main content per page (N calls).
// Layout contains header, <!-- CONTENT_PLACEHOLDER --> and footer.
// Each page generates only <main>, then gets assembled with the layout.
// Fallback: if layout generation fails, generates complete pages (legacy mode).

import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "@/lib/agents";

export interface LitePlusInput {
  project: {
    name: string;
    industry: string;
    description?: string;
    audience?: string;
    location?: string;
    extra_content?: string;
    site_type?: string;
    address_type?: string;
    social_links?: any;
    logo_url?: string;
  };
  design: {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    font_heading?: string;
    font_body?: string;
  } | null;
  pages: { slug: string; title?: string; content_json?: any }[];
  photos: string[];
  projectId: number;
}

export interface LitePlusResult {
  success: boolean;
  files: { path: string; content: string }[];
  pagesGenerated: number;
  fallbackUsed: boolean;
  error?: string;
}

const SONNET_MODEL = getAgent("manu-dev")!.model;

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseSocialLinks(raw: any): { platform: string; url: string }[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x: any) => x?.platform && (x?.url || x?.value))
      .map((x: any) => ({ platform: String(x.platform), url: String(x.url || x.value) }));
  } catch {
    return [];
  }
}

function parseSections(contentJson: any): string[] {
  try {
    if (Array.isArray(contentJson)) return contentJson.map(String);
    if (typeof contentJson === "string") {
      const parsed = JSON.parse(contentJson);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return [];
}

// ── Context builders ──────────────────────────────────────────────────────────

function buildBusinessContext(input: LitePlusInput): string {
  const { project, design, pages } = input;
  const pageList = pages
    .map((p) => {
      const sections = parseSections(p.content_json);
      return `  - ${p.title || p.slug} (slug: "${p.slug}"${sections.length > 0 ? `, secciones: ${sections.join(", ")}` : ""})`;
    })
    .join("\n");

  const socialLinks = parseSocialLinks(project.social_links);
  const socialInfo =
    socialLinks.length > 0
      ? `\nRedes sociales:\n${socialLinks.map((l) => `  - ${l.platform}: ${l.url}`).join("\n")}`
      : "";

  const contactEmail = socialLinks.find((l) => l.platform === "email")?.url || "";

  return `NEGOCIO:
- Nombre: ${project.name}
- Industria: ${project.industry}
- Tipo de sitio: ${project.site_type || "informational"}
- Descripcion: ${project.description || "Negocio profesional"}
- Audiencia: ${project.audience || "publico general"}
- Ubicacion: ${project.location || "America Latina"}
- Color primario: ${design?.primary_color || "#1a1a2e"}
- Color secundario: ${design?.secondary_color || "#16213e"}
- Color acento: ${design?.accent_color || "#0f3460"}
- Fuente titulos: ${design?.font_heading || "Inter"}
- Fuente cuerpo: ${design?.font_body || "Inter"}${contactEmail ? `\n- Email contacto: ${contactEmail}` : ""}
${socialInfo}
${project.extra_content ? `\nContenido adicional:\n${String(project.extra_content).slice(0, 1500)}` : ""}

PAGINAS:
${pageList}`;
}

function buildPhotoList(photos: string[]): string {
  if (photos.length === 0) return "";
  return `\nIMAGENES DISPONIBLES (Unsplash, usa como src de <img>):\n${photos
    .map((url, i) => `  ${i + 1}. ${url}`)
    .join("\n")}`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function slugToFile(slug: string): string {
  if (!slug || slug === "home") return "index.html";
  return `${slug.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}.html`;
}

function validateHtml(content: string): boolean {
  const trimmed = content.trim();
  if (
    !trimmed.toLowerCase().startsWith("<!doctype html") &&
    !trimmed.toLowerCase().startsWith("<html")
  )
    return false;
  if (trimmed.length < 1000) return false;
  return true;
}

function validateLayout(content: string): boolean {
  const trimmed = content.trim();
  if (
    !trimmed.toLowerCase().startsWith("<!doctype html") &&
    !trimmed.toLowerCase().startsWith("<html")
  )
    return false;
  if (trimmed.length < 500) return false;
  if (!/<!--\s*CONTENT_PLACEHOLDER\s*-->/i.test(trimmed)) return false;
  return true;
}

function validateMainContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.toLowerCase().includes("<main")) return false;
  if (trimmed.length < 200) return false;
  return true;
}

function extractHtml(text: string): string {
  let html = text.trim();
  const lower = html.toLowerCase();
  const startDoctype = lower.indexOf("<!doctype html");
  const startHtml = lower.indexOf("<html");
  const start = startDoctype !== -1 ? startDoctype : startHtml;
  const endIdx = lower.lastIndexOf("</html>");
  if (start !== -1 && endIdx !== -1) {
    html = html.slice(start, endIdx + "</html>".length);
  } else {
    html = html.replace(/^```[a-zA-Z]*\n?/, "");
    html = html.replace(/\n?```\s*$/, "");
    html = html.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return html.trim();
}

function extractMainContent(text: string): string {
  let content = text
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  const lower = content.toLowerCase();
  const start = lower.indexOf("<main");
  const end = lower.lastIndexOf("</main>");
  if (start !== -1 && end !== -1) {
    return content.slice(start, end + "</main>".length).trim();
  }
  return content;
}

function assembleHtml(layout: string, mainContent: string): string {
  return layout.replace(/<!--\s*CONTENT_PLACEHOLDER\s*-->/i, mainContent);
}

function buildDockerfileLite(): string {
  return `FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
EXPOSE 3000`;
}

function buildNginxConf(): string {
  return `server {
  listen 3000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}`;
}

function buildSocialLinksJson(links: { platform: string; url: string }[]): string {
  return JSON.stringify(
    links.map((l) => ({ platform: l.platform, name: l.platform, url: l.url })),
    null,
    2,
  );
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildLayoutPrompt(input: LitePlusInput): string {
  const { project, design, pages } = input;
  const socialLinks = parseSocialLinks(project.social_links);
  const contactEmail = socialLinks.find((l) => l.platform === "email")?.url || "";

  const navLinks = pages
    .map((p) => `  - ${p.title || p.slug} → ${slugToFile(p.slug)}`)
    .join("\n");

  const socialFooter =
    socialLinks.length > 0
      ? `Redes en footer:\n${socialLinks.map((l) => `  - ${l.platform}: ${l.url}`).join("\n")}`
      : "";

  const logoInstruction = project.logo_url
    ? `Usa <img src="${project.logo_url}" alt="${project.name}" style="height:40px;width:auto;object-fit:contain;"> como marca en el header. NO muestres el nombre del negocio como texto en el nav, solo el logo.`
    : `Muestra el nombre del negocio como texto en el header.`;

  return `Genera el layout base HTML compartido para el sitio web de ${project.name}.

NEGOCIO:
- Nombre: ${project.name}
- Color primario: ${design?.primary_color || "#1a1a2e"}
- Color secundario: ${design?.secondary_color || "#16213e"}
- Color acento: ${design?.accent_color || "#0f3460"}
- Fuente titulos: ${design?.font_heading || "Inter"}
- Fuente cuerpo: ${design?.font_body || "Inter"}
${contactEmail ? `- Email contacto: ${contactEmail}` : ""}
${socialFooter}

PAGINAS DEL SITIO (para el nav):
${navLinks}

INSTRUCCIONES:
- Genera un documento HTML completo desde <!doctype html> hasta </html>
- El <head> incluye: Tailwind CDN, Google Fonts, configuracion de colores Tailwind
- El <body> tiene EXACTAMENTE esta estructura en orden:
  1. <header> con navegacion responsive y logo
  2. <!-- CONTENT_PLACEHOLDER --> (exactamente este texto, no lo modifiques)
  3. <footer> con nombre del negocio, anio y redes sociales

HEADER:
- ${logoInstruction}
- Navegacion con links a todas las paginas
- Mobile-first con menu hamburguesa para movil (JS vanilla)
- Fondo con color primario o secundario del negocio

FOOTER:
- Nombre del negocio y anio ${new Date().getFullYear()}
${contactEmail ? `- Email: ${contactEmail}` : ""}
${socialLinks.length > 0 ? "- Links a redes sociales" : ""}
- Diseno consistente con el header

REGLAS TECNICAS:
- Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
- Tailwind config inline con: primary="${design?.primary_color || "#1a1a2e"}", secondary="${design?.secondary_color || "#16213e"}", accent="${design?.accent_color || "#0f3460"}"
- Google Fonts: "${design?.font_heading || "Inter"}" (titulos) y "${design?.font_body || "Inter"}" (cuerpo)
- El placeholder DEBE ser exactamente: <!-- CONTENT_PLACEHOLDER -->
- NO incluyas contenido de ninguna pagina especifica
- Sin emojis como iconos
- Animaciones CSS sutiles en nav (hover transitions)

Responde SOLO con el HTML. Empieza directamente con <!doctype html>. Sin markdown, sin explicaciones.`;
}

function buildMainContentPrompt(
  input: LitePlusInput,
  page: { slug: string; title?: string; content_json?: any },
  isHome: boolean,
): string {
  const title = page.title || page.slug;
  const sections = parseSections(page.content_json);

  const sectionHint =
    sections.length > 0 ? `Incluye estas secciones en orden: ${sections.join(", ")}.` : "";

  const homeInstructions = isHome
    ? `- Hero a pantalla completa con imagen de fondo, overlay oscuro semitransparente y texto sobre el overlay
- Incluye CTA prominente en el hero
- Secciones de servicios/productos, testimonios y CTA final`
    : `- Banner superior con imagen de fondo y titulo de la pagina
- Contenido especifico relevante para "${title}"`;

  const formInstructions =
    page.slug === "contacto" || page.slug === "contact"
      ? `
- FORMULARIO DE CONTACTO obligatorio con campos: nombre, email, mensaje
- El formulario debe hacer fetch POST a "https://nl360.site/api/manu-dev/form-submit"
  con body JSON: {project_id: ${input.projectId}, name, email, message}
- Al enviar: deshabilitar boton, mostrar spinner, mensaje exito/error inline. NO redirigir.
- Usa JavaScript vanilla en un <script> al final para manejar el submit.`
      : "";

  return `Genera SOLO el bloque <main>...</main> para la pagina "${title}" del sitio ${input.project.name}.

${buildBusinessContext(input)}
${buildPhotoList(input.photos)}

INSTRUCCIONES PARA ESTA PAGINA:
${homeInstructions}
${sectionHint}
${formInstructions}

REGLAS CRITICAS:
- Responde SOLO con el elemento <main>...</main> completo
- NO incluyas <!doctype>, <html>, <head>, <header>, <nav>, <footer>, <body>
- El header y footer ya estan en el layout compartido, NO los dupliques
- Usa clases Tailwind (ya cargado en el layout base)
- Usa las fuentes "${input.design?.font_heading || "Inter"}" y "${input.design?.font_body || "Inter"}" (ya cargadas)
- Usa los colores primary="${input.design?.primary_color || "#1a1a2e"}", accent="${input.design?.accent_color || "#0f3460"}"
- Contenido en espanol, real y especifico para este negocio (no lorem ipsum)
- Precios coherentes con la economia de "${input.project.location || "America Latina"}"
- Usa las imagenes de Unsplash proporcionadas como src de <img>
- Mobile-first responsive
- Animaciones CSS sutiles (fadeIn, hover transitions)
- Sin emojis como iconos

Responde SOLO con el elemento <main>. Sin markdown, sin explicaciones.`;
}

// Usado por el fallback legacy
function buildPagePrompt(
  input: LitePlusInput,
  page: { slug: string; title?: string; content_json?: any },
  isHome: boolean,
): string {
  const title = page.title || page.slug;
  const sections = parseSections(page.content_json);

  const sectionHint =
    sections.length > 0 ? `Incluye estas secciones en orden: ${sections.join(", ")}.` : "";

  const homeInstructions = isHome
    ? `- Hero a pantalla completa con imagen de fondo, overlay oscuro semitransparente y texto sobre el overlay
- Incluye CTA prominente en el hero
- Secciones de servicios/productos, testimonios y CTA final`
    : `- Banner superior con imagen de fondo y titulo de la pagina
- Contenido especifico relevante para "${title}"`;

  const formInstructions =
    page.slug === "contacto" || page.slug === "contact"
      ? `
- FORMULARIO DE CONTACTO obligatorio con campos: nombre, email, mensaje
- El formulario debe hacer fetch POST a "https://nl360.site/api/manu-dev/form-submit"
  con body JSON: {project_id: ${input.projectId}, name, email, message}
- Al enviar: deshabilitar boton, mostrar spinner, mensaje exito/error inline. NO redirigir.
- Usa JavaScript vanilla en un <script> al final para manejar el submit.`
      : "";

  return `Genera una pagina HTML completa para "${title}" de un sitio web de ${input.project.name}.

${buildBusinessContext(input)}
${buildPhotoList(input.photos)}

INSTRUCCIONES ESPECIFICAS PARA ESTA PAGINA:
${homeInstructions}
${sectionHint}
${formInstructions}

REGLAS TECNICAS:
- HTML completo: <!doctype html> hasta </html>
- Usa Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Configura Tailwind con los colores del negocio via script tailwind.config inline: primary="${input.design?.primary_color || "#1a1a2e"}", secondary="${input.design?.secondary_color || "#16213e"}", accent="${input.design?.accent_color || "#0f3460"}"
- Google Fonts via <link rel="preconnect"> y <link rel="stylesheet">: "${input.design?.font_heading || "Inter"}" (titulos) y "${input.design?.font_body || "Inter"}" (cuerpo).
- LOGO EN HEADER: ${input.project.logo_url ? `Usa <img src="${input.project.logo_url}" alt="${input.project.name}" style="height:40px;width:auto;object-fit:contain;"> como marca en el header. NO muestres el nombre del negocio como texto en el nav, solo el logo.` : `Muestra el nombre del negocio como texto en el header.`}
- Mobile-first responsive
- Contenido en espanol, real y especifico para este negocio (no lorem ipsum)
- Precios coherentes con la economia de "${input.project.location || "America Latina"}"
- Usa las imagenes de Unsplash proporcionadas como src de <img>
- Sin frameworks JS, solo JavaScript vanilla si necesario
- Header con navegacion y links a las otras paginas del sitio (usa los slugs como archivos .html)
- Footer con nombre del negocio y ano actual
- Animaciones CSS sutiles (fadeIn, hover transitions)
- NO uses emojis como iconos

Responde SOLO con el HTML. Empieza directamente con <!doctype html>. Sin markdown, sin explicaciones.`;
}

// ── Stream helper ─────────────────────────────────────────────────────────────

async function streamPrompt(
  client: Anthropic,
  prompt: string,
  label: string,
  maxTokens: number,
): Promise<string> {
  const IDLE_TIMEOUT_MS = 30_000;
  let accumulated = "";

  await new Promise<void>((resolve, reject) => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        reject(new Error(`Generacion ${label}: idle timeout 30s`));
      }, IDLE_TIMEOUT_MS);
    };

    resetIdle();

    const stream = client.messages.stream({
      model: SONNET_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("text", (chunk) => {
      accumulated += chunk;
      resetIdle();
    });

    stream.on("error", (err) => {
      clearTimeout(idleTimer);
      reject(err);
    });

    stream.on("finalMessage", () => {
      clearTimeout(idleTimer);
      resolve();
    });
  });

  return accumulated;
}

// ── Legacy fallback ───────────────────────────────────────────────────────────

async function generateFullPages(
  client: Anthropic,
  input: LitePlusInput,
  home: { slug: string; title?: string; content_json?: any },
  others: { slug: string; title?: string; content_json?: any }[],
  onProgress?: (msg: string) => void,
): Promise<LitePlusResult> {
  const htmlFiles: { path: string; content: string }[] = [];
  let failCount = 0;

  for (const page of [home, ...others]) {
    const isHome = page === home;
    const label = page.title || page.slug;

    onProgress?.(`Generando ${label}...`);

    try {
      const prompt = buildPagePrompt(input, page, isHome);
      const raw = await streamPrompt(client, prompt, label, 12000);
      const html = extractHtml(raw);

      if (validateHtml(html)) {
        htmlFiles.push({ path: slugToFile(page.slug), content: html });
      } else {
        console.warn(`[lite-plus] Invalid HTML for ${label}, length=${html.length}, preview=${html.slice(0, 200)}`);
        failCount++;
      }
    } catch (err: any) {
      console.error(`[lite-plus] Error generating ${label}:`, err?.message);
      failCount++;
    }
  }

  if (htmlFiles.length === 0) {
    return {
      success: false,
      files: [],
      pagesGenerated: 0,
      fallbackUsed: false,
      error: `No se pudo generar ninguna pagina (${failCount} errores)`,
    };
  }

  const socialLinks = parseSocialLinks(input.project.social_links);

  return {
    success: true,
    files: [
      ...htmlFiles,
      { path: "assets/social-links.json", content: buildSocialLinksJson(socialLinks) },
      { path: "Dockerfile", content: buildDockerfileLite() },
      { path: "nginx.conf", content: buildNginxConf() },
    ],
    pagesGenerated: htmlFiles.length,
    fallbackUsed: failCount > 0,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate all HTML pages for a Lite+ site using Claude Sonnet.
 *
 * Flow:
 *   1. Generate shared layout (header + footer, 1 call, 6000 tokens)
 *   2. Generate <main> content per page (N calls, 10000 tokens each)
 *   3. Assemble each page: layout + main
 *
 * If layout generation fails, falls back to legacy full-page generation.
 * Returns file list ready to write to disk.
 */
export async function generateLitePlusSite(
  input: LitePlusInput,
  onProgress?: (msg: string) => void,
): Promise<LitePlusResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      files: [],
      pagesGenerated: 0,
      fallbackUsed: false,
      error: "ANTHROPIC_API_KEY no configurada",
    };
  }

  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 0 });
  const maxPages = Math.min(input.pages.length, 6);
  const pagesToGenerate = input.pages.slice(0, maxPages);

  const home = pagesToGenerate.find((p) => p.slug === "home") || pagesToGenerate[0];
  const others = pagesToGenerate.filter((p) => p !== home);

  // ── Step 0: Generate shared layout ─────────────────────────────────────────
  onProgress?.("Generando layout compartido...");
  let layout: string | null = null;

  try {
    const layoutPrompt = buildLayoutPrompt(input);
    const layoutRaw = await streamPrompt(client, layoutPrompt, "layout", 6000);
    const layoutHtml = extractHtml(layoutRaw);
    if (validateLayout(layoutHtml)) {
      layout = layoutHtml;
      onProgress?.("Layout listo.");
    } else {
      console.warn(
        `[lite-plus] Layout invalido (length=${layoutHtml.length}, placeholder ausente). Usando modo legacy.`,
      );
    }
  } catch (err: any) {
    console.error("[lite-plus] Error generando layout:", err?.message);
  }

  // ── Fallback: layout failed → generate complete pages ──────────────────────
  if (!layout) {
    onProgress?.("Fallback: generando paginas completas...");
    return generateFullPages(client, input, home, others, onProgress);
  }

  // ── Steps 1–N: Generate <main> content per page ────────────────────────────
  const htmlFiles: { path: string; content: string }[] = [];
  let failCount = 0;

  for (const page of [home, ...others]) {
    const isHome = page === home;
    const label = page.title || page.slug;

    onProgress?.(`Generando ${label}...`);

    try {
      const prompt = buildMainContentPrompt(input, page, isHome);
      const raw = await streamPrompt(client, prompt, label, 10000);
      const mainContent = extractMainContent(raw);

      if (validateMainContent(mainContent)) {
        const assembled = assembleHtml(layout, mainContent);
        htmlFiles.push({ path: slugToFile(page.slug), content: assembled });
      } else {
        console.warn(
          `[lite-plus] Main content invalido para ${label}, length=${mainContent.length}, preview=${mainContent.slice(0, 200)}`,
        );
        failCount++;
      }
    } catch (err: any) {
      console.error(`[lite-plus] Error generando ${label}:`, err?.message);
      failCount++;
    }
  }

  if (htmlFiles.length === 0) {
    return {
      success: false,
      files: [],
      pagesGenerated: 0,
      fallbackUsed: false,
      error: `No se pudo generar ninguna pagina (${failCount} errores)`,
    };
  }

  const socialLinks = parseSocialLinks(input.project.social_links);

  return {
    success: true,
    files: [
      ...htmlFiles,
      { path: "assets/social-links.json", content: buildSocialLinksJson(socialLinks) },
      { path: "Dockerfile", content: buildDockerfileLite() },
      { path: "nginx.conf", content: buildNginxConf() },
    ],
    pagesGenerated: htmlFiles.length,
    fallbackUsed: failCount > 0,
  };
}
