import { cookies } from "next/headers";
import { getPool, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

const PLAN_PRIORITY = [
  "nl360_elite",
  "nl360_pro",
  "nl360_basic",
  "nl360_free",
  "nl_setters",
  "administrator",
] as const;

function extractPlan(capabilities: string | null): string {
  if (!capabilities) return "unknown";
  for (const p of PLAN_PRIORITY) {
    if (capabilities.includes(p)) return p;
  }
  return "unknown";
}

export async function GET(req: Request) {
  // 1. Auth — solo administrator
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const meta = await getUserMeta(token);
  if (!meta) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = meta.roles.includes("administrator") || meta.isAdmin;
  const isSetter = meta.roles.includes("nl_setters");

  if (isSetter && !isAdmin) {
    return Response.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }
  if (!isAdmin) {
    return Response.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  // 2. Query params opcionales
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || null;
  const plan = url.searchParams.get("plan")?.trim() || null;

  const pool = getPool();

  // 3. Construir query con filtros opcionales
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push("(wu.user_login LIKE ? OR wu.user_email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (plan) {
    conditions.push("um.meta_value LIKE ?");
    params.push(`%${plan}%`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       wu.ID               AS id,
       wu.user_login       AS username,
       wu.user_email       AS email,
       wu.user_registered  AS registeredAt,
       um.meta_value       AS capabilities
     FROM wordpress.wp_users wu
     LEFT JOIN wordpress.wp_usermeta um
       ON um.user_id = wu.ID
       AND um.meta_key = 'wp_capabilities'
     ${whereClause}
     ORDER BY wu.user_registered DESC
     LIMIT 200`,
    params
  );

  const users = rows.map((r) => ({
    id:           Number(r.id),
    username:     r.username as string,
    email:        r.email as string,
    plan:         extractPlan(r.capabilities as string | null),
    registeredAt: r.registeredAt as string,
  }));

  return Response.json({ ok: true, users, total: users.length });
}
