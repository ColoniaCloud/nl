import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { normalizeGenerationMode, resolveEffectiveMode, validateLiteScope } from "@/lib/manu-dev-lite-site";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
let modeColumnEnsured = false;

async function ensureGenerationModeColumn() {
  if (modeColumnEnsured) return;
  const pool = getPool();
  try {
    await pool.execute("ALTER TABLE md_projects ADD COLUMN generation_mode VARCHAR(16) DEFAULT 'auto'");
  } catch {
    // Column may already exist.
  }
  modeColumnEnsured = true;
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

// GET /api/manu-dev/generation-mode?project_id=123
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id requerido" }, { status: 400 });
  }

  const pool = getPool();
  await ensureGenerationModeColumn();
  const [prows] = (await pool.execute(
    "SELECT id, name, generation_mode FROM md_projects WHERE id = ? AND user_id = ?",
    [projectId, userId]
  )) as any;

  const project = prows[0];
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const [pgrows] = (await pool.execute(
    "SELECT id, slug, title FROM md_pages WHERE project_id = ? ORDER BY id ASC",
    [projectId]
  )) as any;

  const pages = pgrows as any[];
  const liteCheck = validateLiteScope(pages);

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    mode: normalizeGenerationMode(project.generation_mode),
    total_pages: pages.length,
    recommended_mode: resolveEffectiveMode("auto", pages.length),
    lite_eligible: liteCheck.ok,
    lite_reason: liteCheck.ok ? null : liteCheck.reason,
    available_modes: ["next", "lite", "auto"],
  });
}

// POST /api/manu-dev/generation-mode
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const projectId = body?.project_id;
  const mode = normalizeGenerationMode(body?.mode);

  if (!projectId) {
    return NextResponse.json({ error: "project_id requerido" }, { status: 400 });
  }

  const pool = getPool();
  await ensureGenerationModeColumn();

  const [prows] = (await pool.execute(
    "SELECT id FROM md_projects WHERE id = ? AND user_id = ?",
    [projectId, userId]
  )) as any;
  if (!prows[0]) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  await pool.execute(
    "UPDATE md_projects SET generation_mode = ? WHERE id = ? AND user_id = ?",
    [mode, projectId, userId]
  );

  return NextResponse.json({ ok: true, mode });
}
