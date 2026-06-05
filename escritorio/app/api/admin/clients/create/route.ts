import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getPool, getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import { sendWelcomeEmail } from "@/lib/email";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const maxDuration = 30;

const WP_BASE_URL = process.env.WP_BASE_URL!;
const INTERNAL_SECRET = process.env.NL360_INTERNAL_SECRET!;

const ALLOWED_PLANS = [
  "nl360_free",
  "nl360_basic",
  "nl360_pro",
  "nl360_elite",
] as const;
type AllowedPlan = (typeof ALLOWED_PLANS)[number];

export async function POST(req: Request) {
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

  // 2. Parsear y validar body
  let body: { username?: string; email?: string; plan_slug?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const { username, email, plan_slug, notes } = body;

  if (!username || !email || !plan_slug) {
    return Response.json(
      { ok: false, error: "username, email y plan_slug son requeridos" },
      { status: 400 }
    );
  }

  if (!ALLOWED_PLANS.includes(plan_slug as AllowedPlan)) {
    return Response.json(
      { ok: false, error: `plan_slug debe ser uno de: ${ALLOWED_PLANS.join(", ")}` },
      { status: 400 }
    );
  }

  const pool = getPool();

  // 3. Si es setter (no admin): verificar límite de 20 clientes
  if (isSetter && !isAdmin) {
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM setter_clients WHERE setter_id = ?`,
      [meta.id]
    );
    const clientCount = Number(countRows[0]?.cnt ?? 0);
    if (clientCount >= 20) {
      return Response.json(
        { ok: false, error: "Límite de 20 clientes alcanzado" },
        { status: 403 }
      );
    }
  }

  // 4. Generar contraseña temporal
  const tempPassword = randomBytes(10).toString("base64url");

  // 5. Crear usuario en WP via endpoint admin
  const wpRes = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/admin/users/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NL360-Internal": INTERNAL_SECRET,
    },
    body: JSON.stringify({ username, email, password: tempPassword, plan_slug }),
    cache: "no-store",
  });

  const wpData = await wpRes.json().catch(() => ({})) as { ok?: boolean; user_id?: number; message?: string };

  if (!wpRes.ok || !wpData.ok) {
    return Response.json(
      { ok: false, error: wpData.message || `WP ${wpRes.status}` },
      { status: 409 }
    );
  }

  const newUserId = wpData.user_id!;

  // 7. Si es setter: registrar relación en setter_clients
  if (isSetter) {
    await pool.execute(
      `INSERT INTO setter_clients (setter_id, client_id, plan_slug, notes) VALUES (?, ?, ?, ?)`,
      [meta.id, newUserId, plan_slug, notes ?? null]
    );
  }

  // 8. Enviar email de bienvenida
  try {
    await sendWelcomeEmail(email, username, tempPassword);
  } catch (err) {
    console.error("[admin/clients/create] welcome email failed:", err);
  }

  // 9. Respuesta
  return Response.json({ ok: true, userId: newUserId });
}
