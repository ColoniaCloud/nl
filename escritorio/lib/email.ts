const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "NL360 <no-responder@nl360.site>";
const FRONTEND_URL = process.env.NL360_FRONTEND_URL || "https://nl360.site";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not defined");

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  resetLink: string
): Promise<void> {
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f4f5;color:#3f3f46;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px;">
  <img src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
       alt="NL360" style="height:32px;margin-bottom:24px;" />
  <h1 style="font-size:20px;font-weight:700;color:#18181b;margin:0 0 8px;">Restablecer contraseña</h1>
  <p style="color:#52525b;font-size:14px;margin:0 0 24px;">Hola <strong style="color:#18181b;">${username}</strong>, recibimos una solicitud para restablecer tu contraseña en NL360.</p>
  <a href="${resetLink}"
     style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">
    Restablecer contraseña
  </a>
  <p style="color:#a1a1aa;font-size:12px;margin:24px 0 0;">Este enlace es válido por 1 hora. Si no solicitaste esto, ignorá este email.</p>
</div></body></html>`;

  await sendEmail(to, "Restablecer contraseña — NL360", html);
}

export function sendBuildErrorReport(
  errorMessage: string,
  projectId?: string | number
): void {
  const subject = `[URGENTE] Error de generación de sitio${projectId ? ` — proyecto #${projectId}` : ""}`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f4f5;color:#3f3f46;padding:32px;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(239,68,68,0.4);border-radius:16px;padding:32px;">
  <h2 style="color:#dc2626;margin:0 0 16px;">Error crítico en generación de sitio</h2>
  ${projectId ? `<p style="color:#52525b;margin:0 0 8px;">Proyecto ID: <strong style="color:#18181b;">${projectId}</strong></p>` : ""}
  <p style="color:#52525b;margin:0 0 16px;">Se intentó generar un sitio 2 veces y ambos intentos fallaron.</p>
  <div style="background:#f4f4f5;border-radius:8px;padding:16px;border-left:3px solid #dc2626;">
    <p style="margin:0 0 6px;font-size:12px;color:#71717a;font-family:monospace;">REPORTE TÉCNICO:</p>
    <pre style="margin:0;font-size:12px;color:#b91c1c;white-space:pre-wrap;word-break:break-all;">${errorMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  </div>
</div></body></html>`;

  sendEmail("manuel@wpuruguay.com", subject, html).catch((err) => {
    console.error("[email] sendBuildErrorReport failed:", err?.message);
  });
}

export async function sendWelcomeEmail(
  to: string,
  username: string,
  tempPassword: string
): Promise<void> {
  const loginUrl = `${FRONTEND_URL}/login`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f4f5;color:#3f3f46;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px;">
  <img src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
       alt="NL360" style="height:32px;margin-bottom:24px;" />
  <h1 style="font-size:20px;font-weight:700;color:#18181b;margin:0 0 8px;">Bienvenido a NL360</h1>
  <p style="color:#52525b;font-size:14px;margin:0 0 16px;">Hola <strong style="color:#18181b;">${username}</strong>, tu cuenta en NL360 fue creada exitosamente.</p>
  <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 6px;font-size:13px;color:#52525b;">Usuario: <strong style="color:#18181b;">${username}</strong></p>
    <p style="margin:0;font-size:13px;color:#52525b;">Contraseña temporal: <strong style="color:#18181b;font-family:monospace;">${tempPassword}</strong></p>
  </div>
  <a href="${loginUrl}"
     style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">
    Ingresar a NL360
  </a>
  <p style="color:#a1a1aa;font-size:12px;margin:24px 0 0;">Te recomendamos cambiar tu contraseña después de ingresar.</p>
</div></body></html>`;

  await sendEmail(to, "Bienvenido a NL360 — Tu cuenta fue creada", html);
}
