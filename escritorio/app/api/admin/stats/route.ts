import { cookies } from "next/headers";
import { getPool, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import getManuPool from "@/lib/db-manu";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

export async function GET() {
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

  const pool = getPool();
  const manuPool = getManuPool();

  // 2. Ejecutar queries en paralelo
  const [
    revenueRows,
    subsRows,
    sitesRows,
    settersRows,
    usersRows,
  ] = await Promise.all([
    // QUERY A — Ingresos
    pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(amount_usd), 0)                                          AS total_revenue,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END), 0) AS paid_revenue,
         COUNT(*)                                                               AS total_invoices
       FROM bl_invoices`
    ),
    // QUERY B — Suscripciones activas por plan
    pool.execute<RowDataPacket[]>(
      `SELECT plan_slug, COUNT(*) AS total
       FROM bl_subscriptions
       WHERE status = 'active'
       GROUP BY plan_slug`
    ),
    // QUERY C — Sitios generados (pool manu_dev)
    manuPool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*)                                                AS total_sites,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)    AS running_sites
       FROM md_projects`
    ),
    // QUERY D — Setters y cantidad de clientes
    pool.execute<RowDataPacket[]>(
      `SELECT
         sc.setter_id   AS setter_id,
         wu.user_login  AS setter_username,
         wu.user_email  AS setter_email,
         COUNT(sc.id)   AS client_count
       FROM setter_clients sc
       JOIN wordpress.wp_users wu ON wu.ID = sc.setter_id
       GROUP BY sc.setter_id, wu.user_login, wu.user_email
       ORDER BY client_count DESC`
    ),
    // QUERY E — Usuarios por rol nl360
    pool.execute<RowDataPacket[]>(
      `SELECT meta_value, COUNT(*) AS total
       FROM wordpress.wp_usermeta
       WHERE meta_key = 'wp_capabilities'
         AND (meta_value LIKE '%nl360_%' OR meta_value LIKE '%nl_setters%')
       GROUP BY meta_value`
    ),
  ]);

  // 3. Estructurar respuesta
  const rev = revenueRows[0][0];
  const activeSubs = subsRows[0] as RowDataPacket[];
  const byPlan = Object.fromEntries(activeSubs.map((r) => [r.plan_slug, Number(r.total)]));
  const activeTotal = activeSubs.reduce((sum, r) => sum + Number(r.total), 0);
  const sites = sitesRows[0][0];

  return Response.json({
    ok: true,
    revenue: {
      total:    Number(rev.total_revenue),
      paid:     Number(rev.paid_revenue),
      invoices: Number(rev.total_invoices),
    },
    subscriptions: {
      active: activeTotal,
      byPlan,
    },
    sites: {
      total:   Number(sites.total_sites),
      running: Number(sites.running_sites ?? 0),
    },
    setters:     settersRows[0] as RowDataPacket[],
    usersByRole: usersRows[0]   as RowDataPacket[],
  });
}
