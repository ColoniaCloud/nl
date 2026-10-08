export const runtime = "nodejs";
export const maxDuration = 20;

import { requireEmailAccess, EmailAccessError } from "@/lib/email-access";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { buildTransport } from "@/lib/email-transport";
import { encryptToken } from "@/lib/margarita-encrypt";
import getPool from "@/lib/db-manu";

export async function POST(req: Request) {
  try {
    const userId = await requireEmailAccess();
    await ensureTables();

    const { provider, host, port, secure, user, password, fromName, fromEmail } = await req.json();

    if (!host?.trim() || !port || !user?.trim() || !password?.trim() || !fromEmail?.trim()) {
      return Response.json({ error: "Faltan datos de conexión" }, { status: 422 });
    }

    const transport = buildTransport({
      smtp_host: host.trim(),
      smtp_port: Number(port),
      smtp_secure: !!secure,
      smtp_user: user.trim(),
      smtp_password_enc: encryptToken(password),
    });

    try {
      await transport.verify();
    } catch (e: any) {
      return Response.json({ error: `No se pudo conectar: ${e?.message || e}` }, { status: 422 });
    }

    const pool = getPool();
    await pool.execute(
      `INSERT INTO mm_email_accounts
        (user_id, provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_enc, from_name, from_email, status, last_error, connected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', NULL, NOW())
       ON DUPLICATE KEY UPDATE
        provider = VALUES(provider), smtp_host = VALUES(smtp_host), smtp_port = VALUES(smtp_port),
        smtp_secure = VALUES(smtp_secure), smtp_user = VALUES(smtp_user), smtp_password_enc = VALUES(smtp_password_enc),
        from_name = VALUES(from_name), from_email = VALUES(from_email), status = 'connected', last_error = NULL, connected_at = NOW()`,
      [
        userId, provider || "custom", host.trim(), Number(port), secure ? 1 : 0, user.trim(),
        encryptToken(password), fromName?.trim() || null, fromEmail.trim(),
      ]
    );

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof EmailAccessError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: e?.message || "Error interno" }, { status: 500 });
  }
}
