import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";
import {
  markBuildFailed,
  markBuildQueued,
  markBuildSuccess,
  prepareBuildInfra,
  queueBuild,
} from "@/lib/manu-dev-build";
import { normalizeGenerationMode } from "@/lib/manu-dev-lite-site";

export const runtime = "nodejs";
export const maxDuration = 300;

function buildImgTag(attrs: string): string {
  const srcMatch = attrs.match(/src=\{([^}]+)\}|src="([^"]+)"|src='([^']+)'/);
  const src = srcMatch ? (srcMatch[1] || srcMatch[2] || srcMatch[3]) : '""';
  const altMatch = attrs.match(/alt=\{([^}]+)\}|alt="([^"]+)"|alt='([^']+)'/);
  const alt = altMatch ? (altMatch[1] || altMatch[2] || altMatch[3]) : "";
  const srcAttr = srcMatch?.[1] ? `src={${src}}` : `src="${src}"`;
  const altAttr = altMatch?.[1] ? `alt={${alt}}` : `alt="${alt}"`;
  return `<img ${srcAttr} ${altAttr} style={{width:"100%",height:"100%",objectFit:"cover"}} />`;
}

function sanitizeJSX(content: string): string {
  let out = content.replace(/^.*import\s+\w+\s+from\s+['"]next\/image['"]\s*;?\s*\n?/gm, "");
  out = out.replace(/<Image\b([\s\S]*?)\/>/g, (_match, attrs) => buildImgTag(attrs));
  out = out.replace(/<Image\b([\s\S]*?)>/g, (_match, attrs) => buildImgTag(attrs));
  out = out.replace(/<\/Image>/g, "");
  return out;
}

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

function mapContentRebuildError(err: any): string {
  const msg = String(err?.message || err?.stderr || "").toLowerCase();
  if (msg.includes("timeout")) return "Rebuild por contenido excedio timeout.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econn")) return "Error de red en rebuild de contenido.";
  return String(err?.message || "Error en rebuild de contenido");
}

async function getUserId(token: string): Promise<number | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const d = await res.json();
    return d.user?.id ?? null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const d2 = await res2.json();
  return d2.id ?? null;
}

// GET /api/manu-dev/content?project_id=X — returns all pages with their content
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();

  const [prows] = await pool.execute(
    "SELECT * FROM md_projects WHERE id = ? AND user_id = ?",
    [projectId, userId]
  ) as any;
  if (!prows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const project = prows[0];
  const projectMode = normalizeGenerationMode(project.generation_mode);
  const [pages] = await pool.execute(
    "SELECT * FROM md_pages WHERE project_id = ? ORDER BY id ASC",
    [projectId]
  ) as any;

  const [design] = await pool.execute(
    "SELECT * FROM md_design WHERE project_id = ?",
    [projectId]
  ) as any;

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      site_url: project.site_url,
      status: project.status,
    },
    design: design[0] || null,
    pages,
  });
}

// PATCH /api/manu-dev/content — update a page's content_json
export async function PATCH(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { project_id, page_id, content_json, change_description } = await req.json();

  if (!project_id || !page_id || !change_description) {
    return NextResponse.json({ error: "project_id, page_id y change_description requeridos" }, { status: 400 });
  }

  const pool = getPool();

  // Verify ownership
  const [prows] = await pool.execute(
    "SELECT * FROM md_projects WHERE id = ? AND user_id = ?",
    [project_id, userId]
  ) as any;
  if (!prows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const project = prows[0];
  const projectMode = normalizeGenerationMode(project.generation_mode);

  const [pgrows] = await pool.execute(
    "SELECT * FROM md_pages WHERE id = ? AND project_id = ?",
    [page_id, project_id]
  ) as any;
  if (!pgrows[0]) return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });

  const page = pgrows[0];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isLiteMode = projectMode === "lite";

  // Read current file according to project mode
  const pageFile = isLiteMode
    ? path.join(SITES_DIR, project.subdomain, "index.html")
    : page.slug === "home"
      ? path.join(SITES_DIR, project.subdomain, "app", "page.jsx")
      : path.join(SITES_DIR, project.subdomain, "app", "[slug]", "page.jsx");

  let currentContent = "";
  try {
    currentContent = await fs.readFile(pageFile, "utf8");
  } catch {
    currentContent = "// File not found";
  }

  const prompt = isLiteMode
    ? `Tienes el siguiente archivo HTML de una landing page de un sitio web:

\`\`\`html
${currentContent.slice(0, 16000)}
\`\`\`

El usuario pide el siguiente cambio: "${change_description}".
La pagina es de "${project.name}" y la seccion objetivo es "${page.title}".

Genera el archivo HTML actualizado con el cambio aplicado.
Mantener estructura existente, IDs de secciones y enlaces de anclas del header.
No agregues markdown ni explicaciones.

USA ESTE FORMATO:
===FILE:index.html===
[contenido actualizado]
===END===`
    : `Tienes el siguiente archivo JSX de una página de un sitio web Next.js:

\`\`\`jsx
${currentContent.slice(0, 6000)}
\`\`\`

El usuario pide el siguiente cambio: "${change_description}"

Genera el archivo JSX actualizado con ese cambio aplicado.
USA ESTE FORMATO:
===FILE:app/page.jsx===
[contenido actualizado]
===END===

Mantén toda la estructura existente, solo aplica el cambio solicitado. Sin explicaciones.`;

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const fileMatch = raw.match(/===FILE:[^\n]+===\n([\s\S]*?)===END===/);
  if (!fileMatch) {
    return NextResponse.json({ error: "No se pudo generar el archivo actualizado" }, { status: 502 });
  }

  // Strip markdown code fences Claude sometimes adds despite instructions
  const rawContent = fileMatch[1]
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .replace(/\n$/, "");

  // Only sanitize JSX for Next projects. Lite projects use plain HTML.
  const newContent = isLiteMode ? rawContent : sanitizeJSX(rawContent);
  await fs.writeFile(pageFile, newContent, "utf8");

  // Update content_json in DB if provided
  const newContentJson = content_json || page.content_json;
  await pool.execute(
    "UPDATE md_pages SET content_json = ? WHERE id = ?",
    [typeof newContentJson === "string" ? newContentJson : JSON.stringify(newContentJson), page_id]
  );

  // Auto-rebuild the site container in the background through the shared build queue
  await prepareBuildInfra();
  await markBuildQueued(Number(project_id), "queued-content-update");
  const queuedBuild = queueBuild({
    subdomain: project.subdomain,
    projectId: Number(project_id),
  });

  queuedBuild.run
    .then(({ containerId }) => {
      return markBuildSuccess(Number(project_id), containerId);
    })
    .catch((err: any) => {
      const diagnostic = mapContentRebuildError(err).slice(0, 1200);
      console.error("[content] Auto-rebuild failed for", project.subdomain, diagnostic);
      return markBuildFailed(Number(project_id), "content-rebuild-failed", diagnostic);
    });

  return NextResponse.json({
    ok: true,
    rebuilding: true,
    queue_position: queuedBuild.queuePosition,
    message: "Página actualizada. El sitio se está reconstruyendo en segundo plano.",
  });
}
