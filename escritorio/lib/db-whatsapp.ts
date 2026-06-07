import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.MYSQL_HOST || "mysql_db",
      port:     Number(process.env.MYSQL_PORT || 3306),
      user:     process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: "nl360",
      waitForConnections: true,
      connectionLimit: 5,
      charset: "utf8mb4",
    });
  }
  return pool;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type WaStatus    = "disconnected" | "qr_pending" | "connected" | "error";
export type WaDirection = "inbound" | "outbound";

export interface WaSession {
  id: string;
  user_id: string;
  status: WaStatus;
  phone: string | null;
  display_name: string | null;
  qr_code: string | null;
  qr_expires_at: Date | null;
  connected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WaMessage {
  id: string;
  wa_id: string;
  user_id: string;
  direction: WaDirection;
  jid: string;
  body: string | null;
  media_url: string | null;
  mimetype: string | null;
  ts: Date;
  created_at: Date;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getWaSession(userId: string | number): Promise<WaSession | null> {
  const [rows] = await getPool().execute<any[]>(
    "SELECT * FROM wa_sessions WHERE user_id = ? LIMIT 1",
    [String(userId)]
  );
  return (rows[0] as WaSession) ?? null;
}

export async function upsertWaSession(
  userId: string | number,
  data: Partial<Pick<WaSession, "status" | "phone" | "display_name" | "qr_code" | "qr_expires_at" | "connected_at">>
): Promise<void> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return;
  const values = fields.map((f) => (data as any)[f]);
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  await getPool().execute(
    `INSERT INTO wa_sessions (user_id, ${fields.join(", ")})
     VALUES (?, ${fields.map(() => "?").join(", ")})
     ON DUPLICATE KEY UPDATE ${setClauses}`,
    [String(userId), ...values, ...values]
  );
}

export async function saveWaMessage(
  data: Omit<WaMessage, "id" | "created_at">
): Promise<void> {
  await getPool().execute(
    `INSERT IGNORE INTO wa_messages
       (wa_id, user_id, direction, jid, body, media_url, mimetype, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.wa_id, data.user_id, data.direction, data.jid,
     data.body, data.media_url, data.mimetype, data.ts]
  );
}

export async function getWaHistory(
  userId: string | number,
  jid: string,
  limit = 50
): Promise<WaMessage[]> {
  const [rows] = await getPool().execute<any[]>(
    `SELECT * FROM wa_messages
     WHERE user_id = ? AND jid = ?
     ORDER BY ts DESC LIMIT ?`,
    [String(userId), jid, limit]
  );
  return (rows as WaMessage[]).reverse();
}

export async function getWaContactList(
  userId: string | number
): Promise<{ jid: string; last_body: string | null; last_ts: Date | null }[]> {
  const [rows] = await getPool().execute<any[]>(
    `SELECT
       jid,
       (SELECT body FROM wa_messages m2
        WHERE m2.user_id = m.user_id AND m2.jid = m.jid
        ORDER BY ts DESC LIMIT 1) AS last_body,
       MAX(ts) AS last_ts
     FROM wa_messages m
     WHERE user_id = ?
     GROUP BY jid
     ORDER BY last_ts DESC`,
    [String(userId)]
  );
  return rows;
}
