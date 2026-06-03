// ─── Lite+ Site Generator ────────────────────────────────────────────────────
// Uses Claude Sonnet to generate unique HTML pages per site.
// Falls back to Lite templates if generation fails.

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
const GENERATION_TIMEOUT_MS = 60_000;

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

function buildBusinessContext(input: LitePlusInput): string {
  const { project, design, pages } = input;
  const pageList = pages
    .map((p) => {
      const sections = parseSections(p.content_json);
      return `  - ${p.title || p.slug} (slug: "${p.slug}"${sections.length > 0 ? `, secciones: ${sections.join(", ")}` : ""})`;
    })
    .join("\n");

  const socialLinks = parseSocialLinks(project.social_links);
  const socialInfo = socialLinks.length > 0
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
  return `\nIMAGENES DISPONIBLES (Unsplash, usa como src de <img>):\n${photos.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}`;
}

function buildPagePrompt(
  input: LitePlusInput,
  page: { slug: string; title?: string; content_json?: any },
  isHome: boolean,
): string {
  const title = page.title || page.slug;
  const sections = parseSections(page.content_json);

  const sectionHint = sections.length > 0
    ? `Incluye estas secciones en orden: ${sections.join(", ")}.`
    : "";

  const homeInstructions = isHome
    ? `- Hero a pantalla completa con imagen de fondo, overlay oscuro semitransparente y texto sobre el overlay
- Incluye CTA prominente en el hero
- Secciones de servicios/productos, testimonios y CTA final`
    : `- Banner superior con imagen de fondo y titulo de la pagina
- Contenido especifico relevante para "${title}"`;

  const formInstructions = (page.slug === "contacto" || page.slug === "contact")
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
- Configura Tailwind con los colores del negocio via script tailwind.config inline
- Google Fonts via <link>: "${input.design?.font_heading || "Inter"}" y "${input.design?.font_body || "Inter"}"
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout ${Math.round(ms / 1000)}s`)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }).catch((e) => { clearTimeout(timer); reject(e); });
  });
}

function slugToFile(slug: string): string {
  if (!slug || slug === "home") return "index.html";
  return `${slug.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}.html`;
}

function validateHtml(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.toLowerCase().startsWith("<!doctype html") && !trimmed.toLowerCase().startsWith("<html")) return false;
  if (!trimmed.includes("</html>")) return false;
  if (trimmed.length < 500) return false;
  return true;
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
  return JSON.stringify(links.map((l) => ({ platform: l.platform, name: l.platform, url: l.url })), null, 2);
}

/**
 * Generate all HTML pages for a Lite+ site using Claude Sonnet.
 * Returns file list ready to write to disk.
 */
export async function generateLitePlusSite(
  input: LitePlusInput,
  onProgress?: (msg: string) => void,
): Promise<LitePlusResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, files: [], pagesGenerated: 0, fallbackUsed: false, error: "ANTHROPIC_API_KEY no configurada" };
  }

  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
  const maxPages = Math.min(input.pages.length, 6);
  const pagesToGenerate = input.pages.slice(0, maxPages);

  const home = pagesToGenerate.find((p) => p.slug === "home") || pagesToGenerate[0];
  const others = pagesToGenerate.filter((p) => p !== home);

  const htmlFiles: { path: string; content: string }[] = [];
  let failCount = 0;

  // Generate each page sequentially to keep costs predictable
  for (const page of [home, ...others]) {
    const isHome = page === home;
    const prompt = buildPagePrompt(input, page, isHome);
    const label = page.title || page.slug;

    onProgress?.(`Generando ${label}...`);

    try {
      const response = await withTimeout(
        client.messages.create({
          model: SONNET_MODEL,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
        GENERATION_TIMEOUT_MS,
        `Generacion ${label}`,
      );

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Strip any markdown wrapping Claude might add
      let html = text.trim();
      if (html.startsWith("```html")) html = html.slice(7);
      if (html.startsWith("```")) html = html.slice(3);
      if (html.endsWith("```")) html = html.slice(0, -3);
      html = html.trim();

      if (validateHtml(html)) {
        htmlFiles.push({ path: slugToFile(page.slug), content: html });
      } else {
        console.warn(`[lite-plus] Invalid HTML for ${label}, length=${html.length}`);
        failCount++;
      }
    } catch (err: any) {
      console.error(`[lite-plus] Error generating ${label}:`, err?.message);
      failCount++;
    }
  }

  // If we got zero pages, signal failure
  if (htmlFiles.length === 0) {
    return {
      success: false,
      files: [],
      pagesGenerated: 0,
      fallbackUsed: false,
      error: `No se pudo generar ninguna pagina (${failCount} errores)`,
    };
  }

  // Build social links JSON
  const socialLinks = parseSocialLinks(input.project.social_links);

  // Assemble final file list
  const files: { path: string; content: string }[] = [
    ...htmlFiles,
    { path: "assets/social-links.json", content: buildSocialLinksJson(socialLinks) },
    { path: "Dockerfile", content: buildDockerfileLite() },
    { path: "nginx.conf", content: buildNginxConf() },
  ];

  return {
    success: true,
    files,
    pagesGenerated: htmlFiles.length,
    fallbackUsed: failCount > 0,
  };
}
