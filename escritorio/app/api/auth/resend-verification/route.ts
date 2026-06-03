import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const WP_BASE_URL = process.env.WP_BASE_URL!;
const INTERNAL_SECRET = process.env.NL360_INTERNAL_SECRET || "";

function getWpPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || "mysql_db",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: "wordpress",
    waitForConnections: true,
    connectionLimit: 2,
  });
}

export async function POST(req: Request) {
  const pool = getWpPool();
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body ?? {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email válido es requerido." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit: 1 solicitud por 60 segundos por email
    const rl = rateLimit(`resend-verification:${normalizedEmail}`, 1, 1 / 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${rl.resetSeconds} segundos antes de volver a intentar.` },
        {
          status: 429,
          headers: { "Retry-After": String(rl.resetSeconds) },
        }
      );
    }

    // Verificar que la cuenta exista en wp_users
    const [rows] = await pool.execute(
      "SELECT ID, user_email FROM wp_users WHERE user_email = ? LIMIT 1",
      [normalizedEmail]
    );
    const users = rows as Array<{ ID: number; user_email: string }>;

    if (!users.length) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con ese email." },
        { status: 404 }
      );
    }

    // Delegar a WordPress: genera nuevo token, lo persiste y envía el email.
    // WP devuelve 400 si la cuenta ya está verificada.
    const wpRes = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NL360-Internal": INTERNAL_SECRET,
      },
      body: JSON.stringify({ email: normalizedEmail }),
      cache: "no-store",
    });

    const data = await wpRes.json().catch(() => ({}));

    if (wpRes.status === 400) {
      return NextResponse.json(
        { error: data?.message || "Esta cuenta ya está verificada. Puedes iniciar sesión directamente." },
        { status: 400 }
      );
    }

    if (!wpRes.ok) {
      console.error("WP resend-verification error:", data);
      return NextResponse.json(
        { error: data?.message || "No pudimos reenviar el email de verificación." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Error inesperado. Intenta de nuevo." },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
