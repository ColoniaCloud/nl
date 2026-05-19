import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { prepareBuildInfra } from "@/lib/manu-dev-build";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

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

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const pool = getPool();
  await prepareBuildInfra();
  const [rows] = await pool.execute(
    `SELECT p.id, p.subdomain, p.name, p.industry, p.status, p.site_url, p.created_at,
            p.build_started_at, p.build_finished_at, p.last_build_stage, p.last_build_error,
            d.primary_color, d.secondary_color, d.accent_color
     FROM md_projects p
     LEFT JOIN md_design d ON d.project_id = p.id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  ) as any;

  return NextResponse.json({ projects: rows });
}
