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
      database: "mentoria",
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export const TRASH_RETENTION_DAYS = 30;

let lastPurgeAt = 0;

async function columnExists(
  p: mysql.Pool,
  table: string,
  column: string
): Promise<boolean> {
  const [rows] = (await p.execute(
    `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = ?
        AND COLUMN_NAME  = ?`,
    [table, column]
  )) as any[];
  return rows[0]?.c > 0;
}

export async function ensureTables(): Promise<void> {
  if (initialized) return;
  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt_sessions (
      id         CHAR(36)     NOT NULL PRIMARY KEY,
      user_id    INT          NOT NULL,
      tool       VARCHAR(40)  NOT NULL,
      title      VARCHAR(200) NOT NULL DEFAULT '',
      messages   JSON         NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME     NULL DEFAULT NULL,
      INDEX idx_user_tool (user_id, tool),
      INDEX idx_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migration: relax old ENUM('LEYES_EXITO','MARKETING_PREMIUM','CLOSER_PRO')
  // to VARCHAR(40) so we can add new subagents (NAPOLEON, NEVILLE_DISRUPTIVO_1,
  // NEVILLE_DISRUPTIVO_2, ...) without DDL changes.
  try {
    const [colInfo] = (await p.execute(
      `SELECT COLUMN_TYPE, DATA_TYPE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'mt_sessions'
          AND COLUMN_NAME  = 'tool'`
    )) as any[];
    const type = colInfo?.[0]?.DATA_TYPE?.toLowerCase() || "";
    if (type === "enum") {
      await p.execute(`ALTER TABLE mt_sessions MODIFY COLUMN tool VARCHAR(40) NOT NULL`);
    }
  } catch {
    // ignore — best-effort migration
  }
  // Rename legacy LEYES_EXITO sessions to NAPOLEON (the new subagent id).
  try {
    await p.execute(`UPDATE mt_sessions SET tool='NAPOLEON' WHERE tool='LEYES_EXITO'`);
  } catch {
    // ignore
  }
  // Migration: add deleted_at / idx_deleted to pre-existing installs
  if (!(await columnExists(p, "mt_sessions", "deleted_at"))) {
    await p.execute(`ALTER TABLE mt_sessions ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL`);
    try {
      await p.execute(`ALTER TABLE mt_sessions ADD INDEX idx_deleted (deleted_at)`);
    } catch {
      // index may already exist
    }
  }
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt_notes (
      user_id    INT          NOT NULL,
      tool       VARCHAR(40)  NOT NULL,
      content    MEDIUMTEXT   NOT NULL,
      updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tool)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migrate legacy ENUM on mt_notes too
  try {
    const [notesCol] = (await p.execute(
      `SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'mt_notes'
          AND COLUMN_NAME  = 'tool'`
    )) as any[];
    if ((notesCol?.[0]?.DATA_TYPE || "").toLowerCase() === "enum") {
      await p.execute(`ALTER TABLE mt_notes MODIFY COLUMN tool VARCHAR(40) NOT NULL`);
    }
    await p.execute(`UPDATE mt_notes SET tool='NAPOLEON' WHERE tool='LEYES_EXITO'`);
  } catch {
    // ignore
  }
  // Relational message log — enables incremental append instead of rewriting
  // the entire messages JSON on every autosave.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt_messages (
      session_id CHAR(36)   NOT NULL,
      seq        INT        NOT NULL,
      msg_id     VARCHAR(64) NOT NULL,
      role       ENUM('user','agent','system') NOT NULL,
      content    MEDIUMTEXT NOT NULL,
      ts         DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, seq),
      UNIQUE KEY uq_session_msg (session_id, msg_id),
      FULLTEXT KEY ft_content (content),
      CONSTRAINT fk_mt_messages_session
        FOREIGN KEY (session_id) REFERENCES mt_sessions(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migration: add FULLTEXT index on content if missing
  const [ftRows] = (await p.execute(
    `SELECT COUNT(*) AS c
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'mt_messages'
        AND INDEX_NAME   = 'ft_content'`
  )) as any[];
  if (!ftRows[0] || ftRows[0].c === 0) {
    try {
      await p.execute(`ALTER TABLE mt_messages ADD FULLTEXT INDEX ft_content (content)`);
    } catch {
      // ignore — may already exist in race conditions
    }
  }
  // Public read-only share links for sessions. One row per share; tokens are
  // 32-char base64url strings generated by crypto.randomBytes(24).
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt_shares (
      token       VARCHAR(64) NOT NULL PRIMARY KEY,
      session_id  CHAR(36)    NOT NULL,
      user_id     INT         NOT NULL,
      created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at  DATETIME    NOT NULL,
      revoked_at  DATETIME    NULL DEFAULT NULL,
      view_count  INT         NOT NULL DEFAULT 0,
      INDEX idx_session (session_id),
      INDEX idx_user (user_id),
      CONSTRAINT fk_mt_shares_session
        FOREIGN KEY (session_id) REFERENCES mt_sessions(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Per-user progress through a curriculum (one row per user × subagent).
  // current_lesson is 1-based. completed is a JSON array of completed lesson
  // ids. deliverables is a JSON map { lessonId: "text" } for longer answers.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt_progress (
      user_id         INT          NOT NULL,
      tool            VARCHAR(40)  NOT NULL,
      current_lesson  INT          NOT NULL DEFAULT 1,
      completed       JSON         NOT NULL,
      deliverables    JSON         NOT NULL,
      started_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at    DATETIME     NULL DEFAULT NULL,
      PRIMARY KEY (user_id, tool)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  initialized = true;
}

/**
 * Hard-delete sessions that have been in the trash for more than N days.
 * Runs opportunistically (rate-limited to once per 6h per Node instance).
 */
export async function maybePurgeTrash(): Promise<void> {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  if (Date.now() - lastPurgeAt < SIX_HOURS) return;
  lastPurgeAt = Date.now();
  try {
    const p = getPool();
    await p.execute(
      `DELETE FROM mt_sessions
        WHERE deleted_at IS NOT NULL
          AND deleted_at < (NOW() - INTERVAL ? DAY)`,
      [TRASH_RETENTION_DAYS]
    );
  } catch {
    // swallow — purge is best-effort
  }
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
    // Fallback to core WP endpoint
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
