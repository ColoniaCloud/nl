import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import mysql from "mysql2/promise";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

let pool: mysql.Pool | null = null;
let tablesReady = false;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "mysql_db",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: "nl360",
      waitForConnections: true,
      connectionLimit: 5,
      charset: "utf8mb4",
    });
  }
  return pool;
}

async function ensureTables() {
  if (tablesReady) return;
  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS nl_support_tickets (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      subject     VARCHAR(255) NOT NULL,
      message     TEXT NOT NULL,
      category    ENUM('bug','feature','billing','general') NOT NULL DEFAULT 'general',
      status      ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tablesReady = true;
}

async function getUserId(token: string): Promise<number | null> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      return d.user?.id ?? null;
    }
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res2.ok) return null;
    return (await res2.json()).id ?? null;
  } catch {
    return null;
  }
}

// GET — list user's tickets
export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureTables();
  const p = getPool();
  const [rows] = await p.execute(
    `SELECT id, subject, category, status, admin_reply, created_at, updated_at
     FROM nl_support_tickets
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  ) as any[];

  return NextResponse.json({ tickets: rows });
}

// POST — create ticket
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = String(body.subject || "").trim().slice(0, 255);
  const message = String(body.message || "").trim().slice(0, 5000);
  const category = ["bug", "feature", "billing", "general"].includes(body.category)
    ? body.category
    : "general";

  if (!subject || !message) {
    return NextResponse.json({ error: "Asunto y mensaje son requeridos" }, { status: 400 });
  }

  await ensureTables();
  const p = getPool();
  const [result] = await p.execute(
    `INSERT INTO nl_support_tickets (user_id, subject, message, category) VALUES (?, ?, ?, ?)`,
    [userId, subject, message, category]
  ) as any[];

  return NextResponse.json({ ok: true, ticketId: result.insertId });
}
