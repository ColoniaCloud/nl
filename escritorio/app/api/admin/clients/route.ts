import { cookies } from "next/headers";
import { getPool, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // 1. Auth
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

  if (!isAdmin && !isSetter) {
    return Response.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  // 2. Query param ?setterId= (solo admin puede usarlo)
  const url = new URL(req.url);
  const setterIdParam = url.searchParams.get("setterId");
  const filterSetterId = isSetter && !isAdmin
    ? meta.id
    : setterIdParam ? Number(setterIdParam) : null;

  const pool = getPool();

  // 3. Query según rol
  let rows: RowDataPacket[];

  if (isSetter && !isAdmin) {
    // Setter: solo sus propios clientes
    [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         sc.id, sc.client_id, sc.plan_slug,
         sc.notes, sc.created_at,
         wu.user_login AS username,
         wu.user_email AS email
       FROM setter_clients sc
       JOIN wordpress.wp_users wu ON wu.ID = sc.client_id
       WHERE sc.setter_id = ?
       ORDER BY sc.created_at DESC`,
      [filterSetterId]
    );
  } else if (filterSetterId !== null) {
    // Admin filtrando por setter específico
    [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         sc.id, sc.client_id, sc.plan_slug,
         sc.notes, sc.created_at,
         wu.user_login  AS username,
         wu.user_email  AS email,
         ws.user_login  AS setter_username
       FROM setter_clients sc
       JOIN wordpress.wp_users wu ON wu.ID = sc.client_id
       JOIN wordpress.wp_users ws ON ws.ID = sc.setter_id
       WHERE sc.setter_id = ?
       ORDER BY sc.created_at DESC`,
      [filterSetterId]
    );
  } else {
    // Admin: todos los clientes
    [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         sc.id, sc.client_id, sc.plan_slug,
         sc.notes, sc.created_at,
         wu.user_login  AS username,
         wu.user_email  AS email,
         ws.user_login  AS setter_username
       FROM setter_clients sc
       JOIN wordpress.wp_users wu ON wu.ID = sc.client_id
       JOIN wordpress.wp_users ws ON ws.ID = sc.setter_id
       ORDER BY sc.created_at DESC`
    );
  }

  return Response.json({ ok: true, clients: rows });
}
