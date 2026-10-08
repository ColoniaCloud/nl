export const runtime = "nodejs";
export const maxDuration = 10;

import { requireEmailAccess, EmailAccessError } from "@/lib/email-access";
import getPool from "@/lib/db-manu";

export async function POST() {
  try {
    const userId = await requireEmailAccess();
    const pool = getPool();
    await pool.execute(`DELETE FROM mm_email_accounts WHERE user_id = ?`, [userId]);
    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof EmailAccessError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
