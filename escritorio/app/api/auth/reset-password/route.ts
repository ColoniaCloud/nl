import { NextResponse } from "next/server";
import { createHmac, createHash } from "crypto";
import mysql from "mysql2/promise";

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

function verifyResetToken(token: string): { userId: number; timestamp: number } | null {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return null;

    const userId = parseInt(parts[0]);
    const timestamp = parseInt(parts[1]);
    const signature = parts[2];

    const data = `${userId}:${timestamp}`;
    const expectedSignature = createHmac("sha256", JWT_SECRET)
      .update(data)
      .digest("hex");

    if (signature !== expectedSignature) return null;

    // 1 hour expiration
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 3600) return null;

    return { userId, timestamp };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const pool = getWpPool();
  try {
    const { token, uid, newPassword, validate } = await req.json();

    if (!token || !uid) {
      return NextResponse.json(
        { error: "Token o usuario invalido", valid: false },
        { status: 400 }
      );
    }

    const tokenData = verifyResetToken(token);

    if (!tokenData || tokenData.userId !== parseInt(uid)) {
      return NextResponse.json(
        { error: "Enlace invalido o expirado", valid: false },
        { status: 400 }
      );
    }

    // Verify user exists
    const [rows] = await pool.execute(
      "SELECT ID FROM wp_users WHERE ID = ? LIMIT 1",
      [uid]
    );
    const users = rows as Array<{ ID: number }>;
    if (!users.length) {
      return NextResponse.json(
        { error: "Usuario no encontrado", valid: false },
        { status: 400 }
      );
    }

    // If only validating, return success
    if (validate) {
      return NextResponse.json({ valid: true }, { status: 200 });
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres", valid: false },
        { status: 400 }
      );
    }

    // Update password via MD5 (WordPress auto-rehashes to phpass on next login)
    const md5Hash = createHash("md5").update(newPassword).digest("hex");
    await pool.execute(
      "UPDATE wp_users SET user_pass = ? WHERE ID = ?",
      [md5Hash, uid]
    );

    console.log(`✅ Password reset for user ${uid}`);

    return NextResponse.json(
      { ok: true, message: "Contraseña actualizada exitosamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Error procesando tu solicitud", valid: false },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
