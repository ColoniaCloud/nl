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
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#09090b;color:#e4e4e7;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
  <img src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
       alt="NL360" style="height:32px;filter:invert(1);margin-bottom:24px;" />
  <h1 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Restablecer contraseña</h1>
  <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Hola <strong style="color:#e4e4e7;">${username}</strong>, recibimos una solicitud para restablecer tu contraseña en NL360.</p>
  <a href="${resetLink}"
     style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">
    Restablecer contraseña
  </a>
  <p style="color:#52525b;font-size:12px;margin:24px 0 0;">Este enlace es válido por 1 hora. Si no solicitaste esto, ignorá este email.</p>
</div></body></html>`;

  await sendEmail(to, "Restablecer contraseña — NL360", html);
}

export async function sendWelcomeEmail(
  to: string,
  username: string,
  tempPassword: string
): Promise<void> {
  const loginUrl = `${FRONTEND_URL}/login`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#09090b;color:#e4e4e7;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
  <img src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
       alt="NL360" style="height:32px;filter:invert(1);margin-bottom:24px;" />
  <h1 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Bienvenido a NL360</h1>
  <p style="color:#a1a1aa;font-size:14px;margin:0 0 16px;">Hola <strong style="color:#e4e4e7;">${username}</strong>, tu cuenta en NL360 fue creada exitosamente.</p>
  <div style="background:#27272a;border-radius:10px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa;">Usuario: <strong style="color:#e4e4e7;">${username}</strong></p>
    <p style="margin:0;font-size:13px;color:#a1a1aa;">Contraseña temporal: <strong style="color:#e4e4e7;font-family:monospace;">${tempPassword}</strong></p>
  </div>
  <a href="${loginUrl}"
     style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">
    Ingresar a NL360
  </a>
  <p style="color:#52525b;font-size:12px;margin:24px 0 0;">Te recomendamos cambiar tu contraseña después de ingresar.</p>
</div></body></html>`;

  await sendEmail(to, "Bienvenido a NL360 — Tu cuenta fue creada", html);
}
