import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

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

async function getSubdomain(projectId: number, userId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT subdomain FROM md_projects WHERE id = ? AND user_id = ? LIMIT 1",
    [projectId, userId]
  ) as any;
  return rows[0]?.subdomain || null;
}

function getCssPath(subdomain: string): string {
  const safe = subdomain.replace(/[^a-z0-9-]/g, "");
  return path.join(SITES_DIR, safe, "app", "globals.css");
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

  const subdomain = await getSubdomain(projectId, userId);
  if (!subdomain) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const cssPath = getCssPath(subdomain);

  // Ensure the resolved path is inside SITES_DIR
  if (!cssPath.startsWith(SITES_DIR)) {
    return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
  }

  try {
    const css = await fs.readFile(cssPath, "utf8");
    return NextResponse.json({ css });
  } catch {
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

  const subdomain = await getSubdomain(projectId, userId);
  if (!subdomain) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const cssPath = getCssPath(subdomain);

  // Ensure the resolved path is inside SITES_DIR
  if (!cssPath.startsWith(SITES_DIR)) {
    return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
  }

  try {
    await fs.writeFile(cssPath, css, "utf8");
    return NextResponse.json({ ok: true, message: "CSS guardado" });
  } catch (err: any) {
    return NextResponse.json({ error: "Error al guardar CSS" }, { status: 500 });
  }
}
