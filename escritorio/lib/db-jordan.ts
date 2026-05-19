import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;
let initialized = false;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "mysql_db",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: "jordan",
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export async function ensureTables(): Promise<void> {
  if (initialized) return;
  const p = getPool();
  // Drop legacy table if it uses old ENUM schema, then recreate with VARCHAR
  await p.execute(`
    CREATE TABLE IF NOT EXISTS jd_sessions (
      id         CHAR(36)     NOT NULL PRIMARY KEY,
      user_id    INT          NOT NULL,
      tool       VARCHAR(50)  NOT NULL,
      title      VARCHAR(200) NOT NULL DEFAULT '',
      messages   JSON         NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_tool (user_id, tool)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migrate ENUM column to VARCHAR if still old schema
  try {
    await p.execute(
      `ALTER TABLE jd_sessions MODIFY COLUMN tool VARCHAR(50) NOT NULL`
    );
  } catch { /* already VARCHAR, ignore */ }
  initialized = true;
}

const WP_BASE_URL = process.env.WP_BASE_URL!;

export async function getUserId(token: string): Promise<number | null> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      if (d.user?.id) return Number(d.user.id);
    }
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res2.ok) {
      const d2 = await res2.json();
      return d2.id ? Number(d2.id) : null;
    }
  } catch {
    // ignore
  }
  return null;
}
