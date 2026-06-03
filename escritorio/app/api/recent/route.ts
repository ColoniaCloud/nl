import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import getManuPool from "@/lib/db-manu";
import { getPool as getJordanPool } from "@/lib/db-jordan";
import { getPool as getMentoriaPool } from "@/lib/db-mentoria";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUserId(token: string): Promise<number | null> {
  try {
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
  } catch {
    return null;
  }
}

export interface RecentItem {
  id: string;
  agent: "manu-dev" | "nubia" | "forge" | "margarita" | "jordan" | "mentoria";
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items: RecentItem[] = [];

  await Promise.allSettled([
    // Manu Dev projects
    (async () => {
      try {
        const pool = getManuPool();
        const [rows] = await pool.execute(
          `SELECT id, name, subdomain, status, created_at FROM md_projects
           WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `manu-dev-${r.id}`,
            agent: "manu-dev",
            title: r.name || r.subdomain || "Proyecto",
            subtitle:
              r.status === "active" ? "Activo" :
              r.status === "building" ? "Construyendo" : "Borrador",
            href: `/services/manu-dev?project=${r.id}`,
            updatedAt: r.created_at,
          });
        }
      } catch {}
    })(),

    // Margarita brandbooks
    (async () => {
      try {
        const pool = getManuPool();
        const [rows] = await pool.execute(
          `SELECT id, business_name, industry, created_at FROM mm_brandbooks
           WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `margarita-${r.id}`,
            agent: "margarita",
            title: r.business_name || "Proyecto Marketing",
            subtitle: r.industry || "Marketing",
            href: `/services/margarita`,
            updatedAt: r.created_at,
          });
        }
      } catch {}
    })(),

    // Jordan sessions
    (async () => {
      try {
        const pool = getJordanPool();
        const [rows] = await pool.execute(
          `SELECT id, title, tool, updated_at FROM jd_sessions
           WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `jordan-${r.id}`,
            agent: "jordan",
            title: r.title || "Conversacion",
            subtitle: r.tool || "Jordan",
            href: `/services/grant`,
            updatedAt: r.updated_at,
          });
        }
      } catch {}
    })(),

    // Nubia projects
    (async () => {
      try {
        const pool = getManuPool();
        const [rows] = await pool.execute(
          `SELECT id, name, subdomain, status, created_at FROM nb_projects
           WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `nubia-${r.id}`,
            agent: "nubia",
            title: r.name || r.subdomain || "Tienda",
            subtitle:
              r.status === "active" ? "Activa" :
              r.status === "building" ? "Construyendo" : "Borrador",
            href: `/services/nubia?project=${r.id}`,
            updatedAt: r.created_at,
          });
        }
      } catch {}
    })(),

    // Forge projects
    (async () => {
      try {
        const pool = getManuPool();
        const [rows] = await pool.execute(
          `SELECT id, name, token_name, token_symbol, status, created_at FROM fg_projects
           WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `forge-${r.id}`,
            agent: "forge",
            title: r.token_name || r.name || "Contrato",
            subtitle: r.token_symbol || "Token",
            href: `/services/forge?project=${r.id}`,
            updatedAt: r.created_at,
          });
        }
      } catch {}
    })(),

    // MentorIA sessions
    (async () => {
      try {
        const pool = getMentoriaPool();
        const [rows] = await pool.execute(
          `SELECT id, title, tool, updated_at FROM mt_sessions
           WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5`,
          [userId]
        ) as any[];
        for (const r of rows) {
          items.push({
            id: `mentoria-${r.id}`,
            agent: "mentoria",
            title: r.title || "Sesion",
            subtitle: r.tool || "MentorIA",
            href: `/services/mentoria`,
            updatedAt: r.updated_at,
          });
        }
      } catch {}
    })(),
  ]);

  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json({ items: items.slice(0, 6) });
}
