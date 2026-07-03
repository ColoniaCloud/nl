import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
import { normalizeGenerationMode, isStaticMode, type GenerationMode } from "@/lib/manu-dev-lite-site";
import { regenerateStaticDynamicPages } from "@/lib/manu-dev-static-render";

export const runtime = "nodejs";
export const maxDuration = 300;

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

/**
 * Sync design changes (colors/fonts) from md_design into the site's source files
 * before Docker rebuild so that design edits actually persist.
 *
 *  - next            → app/globals.css (CSS variables + @import)
 *  - lite/lite_plus  → every *.html (inline Tailwind config + Google Fonts + <style>)
 */
async function syncDesignToFiles(
  subdomain: string,
  projectId: number,
  pool: any,
  mode: GenerationMode
) {
  const [drows] = await pool.execute(
    "SELECT * FROM md_design WHERE project_id = ? LIMIT 1",
    [projectId]
  ) as any;
  if (!drows[0]) return; // no design record, nothing to sync

  const design = drows[0];
  if (isStaticMode(mode)) {
    await syncDesignToStaticHtml(subdomain, design);
  } else {
    await syncDesignToGlobalsCss(subdomain, design);
  }
}

/** Build the Google Fonts css2 URL for the given heading/body fonts. */
function buildGoogleFontsUrl(heading: string, body: string): string {
  const uniqueFonts = [...new Set([heading, body])];
  const familyParams = uniqueFonts
    .map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

/** Next.js sites: design lives in app/globals.css as CSS variables. */
async function syncDesignToGlobalsCss(subdomain: string, design: any) {
  const safeSubdomain = subdomain.replace(/[^a-z0-9-]/g, "");
  const cssPath = path.join(SITES_DIR, safeSubdomain, "app", "globals.css");

  let css: string;
  try {
    css = await fs.readFile(cssPath, "utf8");
  } catch {
    return; // file doesn't exist, skip
  }

  if (design.primary_color) {
    css = css.replace(/(--color-primary:\s*)([^;]+)/g, `$1${design.primary_color}`);
  }
  if (design.secondary_color) {
    css = css.replace(/(--color-secondary:\s*)([^;]+)/g, `$1${design.secondary_color}`);
  }
  if (design.accent_color) {
    css = css.replace(/(--color-accent:\s*)([^;]+)/g, `$1${design.accent_color}`);
  }

  const newHeading = design.font_heading || "Inter";
  const newBody = design.font_body || "Inter";

  css = css.replace(/(--font-heading:\s*')([^']+)(')/g, `$1${newHeading}$3`);
  css = css.replace(/(--font-body:\s*')([^']+)(')/g, `$1${newBody}$3`);

  const newImportUrl = buildGoogleFontsUrl(newHeading, newBody);
  css = css.replace(
    /@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/css2\?[^)]+\);\s*/,
    `@import url('${newImportUrl}');\n`
  );

  await fs.writeFile(cssPath, css, "utf8");
}

/**
 * Static sites (lite/lite_plus): colors live in the inline `tailwind.config`
 * (colors.primary/secondary/accent) and fonts in `fontFamily`, the Google Fonts
 * <link> and a <style> block. Apply the design to every .html file.
 */
async function syncDesignToStaticHtml(subdomain: string, design: any) {
  const safeSubdomain = subdomain.replace(/[^a-z0-9-]/g, "");
  const siteDir = path.join(SITES_DIR, safeSubdomain);

  let entries: string[];
  try {
    // Store/Blog pages are regenerated from scratch right after this (see
    // regenerateStaticDynamicPages), reusing the already-synced shell — skip them
    // here to avoid writing each file twice on every rebuild.
    entries = (await fs.readdir(siteDir)).filter(
      f => f.toLowerCase().endsWith(".html") && f !== "tienda.html" && f !== "blog.html" && !f.startsWith("blog-")
    );
  } catch {
    return;
  }
  if (entries.length === 0) return;

  const newHeading = design.font_heading || "Inter";
  const newBody = design.font_body || "Inter";
  const newFontsUrl = buildGoogleFontsUrl(newHeading, newBody);

  for (const file of entries) {
    const filePath = path.join(siteDir, file);
    let html: string;
    try {
      html = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    // ── Colors: update tailwind.config AND inline hardcoded hex usages ──
    for (const key of ["primary", "secondary", "accent"] as const) {
      const color = design[`${key}_color`];
      if (!color) continue;
      // Capture the previous hex from the tailwind config so we can also fix inline
      // usages (e.g. style="color:#2E7D32") that some generated sites bake in.
      const oldHex = html.match(new RegExp(`\\b${key}\\s*:\\s*['"](#[0-9a-fA-F]{3,8})['"]`))?.[1];
      const re = new RegExp(`(\\b${key}\\s*:\\s*['"])#[0-9a-fA-F]{3,8}(['"])`, "g");
      html = html.replace(re, `$1${color}$2`);
      if (oldHex && oldHex.toLowerCase() !== String(color).toLowerCase()) {
        html = html.replace(new RegExp(oldHex, "gi"), color);
      }
    }

    // ── Fonts: capture the previous names so we can replace literals too ──
    const oldHeading = html.match(/heading:\s*\[\s*["']([^"']+)["']/)?.[1];
    const oldBody = html.match(/body:\s*\[\s*["']([^"']+)["']/)?.[1];

    // tailwind.config fontFamily arrays
    html = html.replace(/(heading:\s*\[\s*["'])[^"']+(["'])/, `$1${newHeading}$2`);
    html = html.replace(/(body:\s*\[\s*["'])[^"']+(["'])/, `$1${newBody}$2`);

    // literal font-family usages in the <style> block (e.g. h1 { font-family: "Outfit" })
    if (oldHeading && oldHeading !== newHeading) {
      html = html.split(`"${oldHeading}"`).join(`"${newHeading}"`);
      html = html.split(`'${oldHeading}'`).join(`'${newHeading}'`);
    }
    if (oldBody && oldBody !== newBody) {
      html = html.split(`"${oldBody}"`).join(`"${newBody}"`);
      html = html.split(`'${oldBody}'`).join(`'${newBody}'`);
    }

    // Google Fonts <link href="...css2?...">
    html = html.replace(
      /href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/g,
      `href="${newFontsUrl}"`
    );

    await fs.writeFile(filePath, html, "utf8");
  }
}

function mapRebuildError(err: any): string {
  const msg = String(err?.message || err?.stderr || "").toLowerCase();
  if (msg.includes("timeout")) return "El rebuild excedio el timeout operativo.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econn")) return "Error de red durante el rebuild.";
  return String(err?.message || "Error en el rebuild");
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

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { project_id } = await req.json();
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();

  const [prows] = await pool.execute(
    "SELECT * FROM md_projects WHERE id = ? AND user_id = ?",
    [project_id, userId]
  ) as any;

  if (!prows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const project = prows[0];
  const subdomain = project.subdomain;
  const projectMode = normalizeGenerationMode(project.generation_mode);

  await prepareBuildInfra();
  await markBuildQueued(Number(project_id), "queued-rebuild");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send({ status: "syncing", message: "Aplicando cambios de diseno..." });
        await syncDesignToFiles(subdomain, Number(project_id), pool, projectMode);

        // Static sites: regenerate Store/Blog pages from the DB (deterministic, no LLM).
        if (isStaticMode(projectMode)) {
          try {
            const pages = await regenerateStaticDynamicPages({
              subdomain,
              projectId: Number(project_id),
              pool,
            });
            if (pages.length > 0) {
              send({ status: "syncing", message: `Generando ${pages.length} pagina(s) de tienda/blog...` });
            }
          } catch (e: any) {
            console.error("[rebuild] regenerateStaticDynamicPages failed:", e?.message);
          }
        }

        const queuedBuild = queueBuild({
          subdomain,
          projectId: Number(project_id),
          // Static sites (lite/lite_plus) rebuild in "lite" mode (nginx); only Next uses "next".
          mode: isStaticMode(projectMode) ? "lite" : "next",
          onStart: () => {
            send({ status: "building", message: "Reconstruyendo imagen Docker..." });
          },
        });

        if (queuedBuild.queuePosition > 1) {
          send({
            status: "queued",
            message: `Build en cola (posicion ${queuedBuild.queuePosition}). Esperando turno...`,
          });
        }

        const { containerId } = await queuedBuild.run;

        await markBuildSuccess(Number(project_id), containerId);

        send({
          status: "done",
          message: "¡Sitio actualizado!",
          url: project.site_url,
        });
      } catch (err: any) {
        const diagnostic = mapRebuildError(err).slice(0, 1200);
        await markBuildFailed(Number(project_id), "rebuild-failed", diagnostic);
        send({ status: "error", message: diagnostic });
      } finally {
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
}
