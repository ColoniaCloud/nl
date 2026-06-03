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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────

export async function createConversation(userId: number, title = "Nueva conversación"): Promise<number> {
  const p = getPool();
  const [result] = await p.execute(
    `INSERT INTO j_conversations (user_id, title) VALUES (?, ?)`,
    [userId, title.slice(0, 255)]
  ) as any[];
  return result.insertId as number;
}

export async function getConversations(userId: number): Promise<Conversation[]> {
  const p = getPool();
  const [rows] = await p.execute(
    `SELECT id, user_id, title, created_at, updated_at
     FROM j_conversations WHERE user_id = ?
     ORDER BY updated_at DESC LIMIT 50`,
    [userId]
  ) as any[];
  return rows as Conversation[];
}

export async function getConversationMessages(conversationId: number): Promise<Message[]> {
  const p = getPool();
  const [rows] = await p.execute(
    `SELECT id, conversation_id, role, content, created_at
     FROM j_messages WHERE conversation_id = ?
     ORDER BY created_at ASC`,
    [conversationId]
  ) as any[];
  return rows as Message[];
}

export async function addMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const p = getPool();
  await p.execute(
    `INSERT INTO j_messages (conversation_id, role, content) VALUES (?, ?, ?)`,
    [conversationId, role, content]
  );
}

export async function updateConversationTitle(conversationId: number, title: string): Promise<void> {
  const p = getPool();
  await p.execute(
    `UPDATE j_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title.slice(0, 255), conversationId]
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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
