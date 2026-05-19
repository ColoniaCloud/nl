import { getPool } from "@/lib/db-billing";

let initialized = false;

export async function ensureReferralTables(): Promise<void> {
  if (initialized) return;
  const pool = getPool();

  // Referral codes — one per user, auto-generated
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bl_referral_codes (
      user_id    INT          NOT NULL PRIMARY KEY,
      code       VARCHAR(12)  NOT NULL UNIQUE,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Referral events — one row per referred user
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bl_referrals (
      id              CHAR(36)     NOT NULL PRIMARY KEY,
      referrer_id     INT          NOT NULL,
      referee_id      INT          NOT NULL UNIQUE,
      referee_username VARCHAR(60) NOT NULL DEFAULT '',
      status          ENUM('pending','converted') NOT NULL DEFAULT 'pending',
      plan_slug       VARCHAR(30)  NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      converted_at    DATETIME     NULL,
      INDEX idx_referrer (referrer_id),
      INDEX idx_referee  (referee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  initialized = true;
}

/** Returns existing code or creates one for the user */
export async function getOrCreateCode(userId: number): Promise<string> {
  await ensureReferralTables();
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT code FROM bl_referral_codes WHERE user_id = ?`,
    [userId]
  ) as [Array<{ code: string }>, unknown];

  if (rows[0]) return rows[0].code;

  // Generate 8-char alphanumeric code, retry on collision
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    try {
      await pool.execute(
        `INSERT INTO bl_referral_codes (user_id, code) VALUES (?, ?)`,
        [userId, code]
      );
      return code;
    } catch {
      // duplicate key — retry
    }
  }
  throw new Error("Could not generate unique referral code");
}

/** Records a referral when a new user registers via a referral code */
export async function recordReferral(
  referralCode: string,
  refereeId: number,
  refereeUsername: string
): Promise<void> {
  await ensureReferralTables();
  const pool = getPool();

  const [codeRows] = await pool.execute(
    `SELECT user_id FROM bl_referral_codes WHERE code = ?`,
    [referralCode]
  ) as [Array<{ user_id: number }>, unknown];

  const referrer = codeRows[0];
  if (!referrer || referrer.user_id === refereeId) return;

  const { randomUUID } = await import("crypto");
  await pool.execute(
    `INSERT IGNORE INTO bl_referrals
       (id, referrer_id, referee_id, referee_username, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [randomUUID(), referrer.user_id, refereeId, refereeUsername]
  );
}

/** Marks a referral as converted when the referee activates a paid plan */
export async function convertReferral(
  refereeId: number,
  planSlug: string
): Promise<void> {
  await ensureReferralTables();
  const pool = getPool();

  await pool.execute(
    `UPDATE bl_referrals
     SET status = 'converted', plan_slug = ?, converted_at = CURRENT_TIMESTAMP
     WHERE referee_id = ? AND status = 'pending'`,
    [planSlug, refereeId]
  );
}

export type ReferralStats = {
  code: string;
  total: number;
  converted: number;
  pending: number;
  referrals: Array<{
    referee_id: number;
    referee_username: string;
    status: string;
    plan_slug: string | null;
    created_at: string;
    converted_at: string | null;
  }>;
};

export async function getUserReferralStats(userId: number): Promise<ReferralStats> {
  await ensureReferralTables();
  const pool = getPool();

  const code = await getOrCreateCode(userId);

  const [rows] = await pool.execute(
    `SELECT referee_id, referee_username, status, plan_slug, created_at, converted_at
     FROM bl_referrals WHERE referrer_id = ?
     ORDER BY created_at DESC`,
    [userId]
  ) as [Array<Record<string, unknown>>, unknown];

  const referrals = rows as ReferralStats["referrals"];
  return {
    code,
    total: referrals.length,
    converted: referrals.filter((r) => r.status === "converted").length,
    pending: referrals.filter((r) => r.status === "pending").length,
    referrals,
  };
}

export type AdminReferrerRow = {
  user_id: number;
  code: string;
  total: number;
  converted: number;
  pending: number;
  last_referral_at: string;
};

export async function getAdminReferralSummary(): Promise<AdminReferrerRow[]> {
  await ensureReferralTables();
  const pool = getPool();

  const [rows] = await pool.execute(`
    SELECT
      rc.user_id,
      rc.code,
      COUNT(r.id)                                        AS total,
      SUM(r.status = 'converted')                        AS converted,
      SUM(r.status = 'pending')                          AS pending,
      MAX(r.created_at)                                  AS last_referral_at
    FROM bl_referral_codes rc
    JOIN bl_referrals r ON r.referrer_id = rc.user_id
    GROUP BY rc.user_id, rc.code
    ORDER BY total DESC
  `) as [Array<Record<string, unknown>>, unknown];

  return rows as AdminReferrerRow[];
}
