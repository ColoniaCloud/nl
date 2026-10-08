import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";
import { normalizeGenerationMode, isStaticMode, type GenerationMode } from "@/lib/manu-dev-lite-site";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

// Static sites (lite/lite_plus) keep custom CSS in this file, linked from every page.
const STATIC_CSS_REL = "assets/custom.css";
const STATIC_CSS_LINK = `<link rel="stylesheet" href="${STATIC_CSS_REL}" />`;

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
  return (await res2.json()).id ?? null;
}

async function getProjectInfo(
  projectId: number,
  userId: number
): Promise<{ subdomain: string; mode: GenerationMode } | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT subdomain, generation_mode FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1",
    [projectId, userId]
  ) as any;
  if (!rows[0]?.subdomain) return null;
  return { subdomain: rows[0].subdomain, mode: normalizeGenerationMode(rows[0].generation_mode) };
}

function getCssPath(subdomain: string, mode: GenerationMode): string {
  const safe = subdomain.replace(/[^a-z0-9-]/g, "");
  return isStaticMode(mode)
    ? path.join(SITES_DIR, safe, STATIC_CSS_REL)
    : path.join(SITES_DIR, safe, "app", "globals.css");
}

/** Ensure every .html page links the custom stylesheet so the CSS actually applies. */
async function ensureStaticCssLinked(subdomain: string): Promise<void> {
  const safe = subdomain.replace(/[^a-z0-9-]/g, "");
  const siteDir = path.join(SITES_DIR, safe);
  let entries: string[];
  try {
    entries = (await fs.readdir(siteDir)).filter(f => f.toLowerCase().endsWith(".html"));
  } catch {
    return;
  }
  for (const file of entries) {
    const filePath = path.join(siteDir, file);
    let html: string;
    try {
      html = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    if (html.includes(STATIC_CSS_REL)) continue; // already linked
    if (html.includes("</head>")) {
      html = html.replace("</head>", `  ${STATIC_CSS_LINK}\n</head>`);
      await fs.writeFile(filePath, html, "utf8");
    }
  }
}

// GET /api/manu-dev/css?project_id=X
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const projectId = Number(req.nextUrl.searchParams.get("project_id"));
  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const info = await getProjectInfo(projectId, userId);
  if (!info) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const cssPath = getCssPath(info.subdomain, info.mode);

  // Ensure the resolved path is inside SITES_DIR
  if (!cssPath.startsWith(SITES_DIR)) {
    return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
  }

  try {
    const css = await fs.readFile(cssPath, "utf8");
    return NextResponse.json({ css });
  } catch {
    // Static sites may not have a custom.css yet — open the editor empty instead of 404.
    if (isStaticMode(info.mode)) return NextResponse.json({ css: "" });
    return NextResponse.json({ error: "No se encontro el archivo CSS" }, { status: 404 });
  }
}

// PUT /api/manu-dev/css
export async function PUT(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const projectId = Number(body?.project_id);
  const css = body?.css;

  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });
  if (typeof css !== "string") return NextResponse.json({ error: "css requerido" }, { status: 400 });

  const MAX_CSS_BYTES = 200_000;
  if (Buffer.byteLength(css, "utf8") > MAX_CSS_BYTES) {
    return NextResponse.json({ error: "El CSS excede el tamano maximo permitido (200KB)" }, { status: 400 });
  }
  const sanitizedCss = css.replace(/@import\b[^;]*;?/gi, "").replace(/expression\s*\([^)]*\)/gi, "");

  const info = await getProjectInfo(projectId, userId);
  if (!info) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const cssPath = getCssPath(info.subdomain, info.mode);

  // Ensure the resolved path is inside SITES_DIR
  if (!cssPath.startsWith(SITES_DIR)) {
    return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
  }

  try {
    await fs.mkdir(path.dirname(cssPath), { recursive: true });
    await fs.writeFile(cssPath, sanitizedCss, "utf8");
    // Static sites: make sure every page links the stylesheet so edits take effect.
    if (isStaticMode(info.mode)) await ensureStaticCssLinked(info.subdomain);
    return NextResponse.json({ ok: true, message: "CSS guardado" });
  } catch (err: any) {
    return NextResponse.json({ error: "Error al guardar CSS" }, { status: 500 });
  }
}
