import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import mysql from "mysql2/promise";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nl360.site";
const JWT_SECRET = process.env.NL360_JWT_SECRET || "default-secret-change-me";

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

function generateResetToken(userId: number): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = `${userId}:${timestamp}`;
  const signature = createHmac("sha256", JWT_SECRET).update(data).digest("hex");
  return `${data}:${signature}`;
}

export async function POST(req: Request) {
  const pool = getWpPool();
  try {
    const { identifier } = await req.json();

    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json(
        { error: "Usuario o email es requerido" },
        { status: 400 }
      );
    }

    const trimmed = identifier.trim();

    // Search user directly in wp_users table
    const [rows] = await pool.execute(
      "SELECT ID, user_login, user_email FROM wp_users WHERE user_login = ? OR user_email = ? LIMIT 1",
      [trimmed, trimmed]
    );

    const users = rows as Array<{ ID: number; user_login: string; user_email: string }>;

    if (!users.length) {
      // Don't reveal if user exists
      return NextResponse.json(
        { ok: true, message: "Si el usuario existe, recibira un enlace de recuperacion" },
        { status: 200 }
      );
    }

    const user = users[0];
    const token = generateResetToken(user.ID);
    const resetLink = `${APP_BASE_URL}/resetear-contrasena?token=${token}&uid=${user.ID}`;

    console.log(`\n✉️  PASSWORD RESET LINK FOR: ${user.user_email}`);
    console.log(`👤 User: ${user.user_login}`);
    console.log(`🔗 Link: ${resetLink}`);
    console.log(`⏰ Expires: 1 hour from now\n`);

    return NextResponse.json(
      { ok: true, message: "Si el usuario existe, recibira un enlace de recuperacion" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Error procesando tu solicitud" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
