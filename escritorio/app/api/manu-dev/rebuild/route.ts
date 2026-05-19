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
import { normalizeGenerationMode } from "@/lib/manu-dev-lite-site";

export const runtime = "nodejs";
export const maxDuration = 300;

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

/**
 * Sync design changes (colors/fonts) from md_design into the site's globals.css
 * before Docker rebuild so that design edits actually persist.
 */
async function syncDesignToFiles(subdomain: string, projectId: number, pool: any) {
  const [drows] = await pool.execute(
    "SELECT * FROM md_design WHERE project_id = ? LIMIT 1",
    [projectId]
  ) as any;
  if (!drows[0]) return; // no design record, nothing to sync

  const design = drows[0];
  const cssPath = path.join(SITES_DIR, subdomain, "app", "globals.css");

  let css: string;
  try {
    css = await fs.readFile(cssPath, "utf8");
  } catch {
    return; // file doesn't exist, skip
  }

  // Replace CSS color variables
  if (design.primary_color) {
    css = css.replace(/(--color-primary:\s*)([^;]+)/g, `$1${design.primary_color}`);
  }
  if (design.secondary_color) {
    css = css.replace(/(--color-secondary:\s*)([^;]+)/g, `$1${design.secondary_color}`);
  }
  if (design.accent_color) {
    css = css.replace(/(--color-accent:\s*)([^;]+)/g, `$1${design.accent_color}`);
  }

  // Replace font variables and @import URL if fonts changed
  const newHeading = design.font_heading || "Inter";
  const newBody = design.font_body || "Inter";

  css = css.replace(/(--font-heading:\s*')([^']+)(')/g, `$1${newHeading}$3`);
  css = css.replace(/(--font-body:\s*')([^']+)(')/g, `$1${newBody}$3`);

  // Update Google Fonts @import URL
  const uniqueFonts = [...new Set([newHeading, newBody])];
  const familyParams = uniqueFonts
    .map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`)
    .join("&");
  const newImportUrl = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  css = css.replace(
    /@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/css2\?[^)]+\);\s*/,
    `@import url('${newImportUrl}');\n`
  );

  await fs.writeFile(cssPath, css, "utf8");
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
        await syncDesignToFiles(subdomain, Number(project_id), pool);

        const queuedBuild = queueBuild({
          subdomain,
          projectId: Number(project_id),
          mode: normalizeGenerationMode(project.generation_mode) === "lite" ? "lite" : "next",
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
