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
      database: process.env.BILLING_DB || "nl360_billing",
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

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_subscriptions (
      id                   CHAR(36)      NOT NULL PRIMARY KEY,
      user_id              INT           NOT NULL,
      plan_slug            ENUM('nl360_free','nl360_basic','nl360_pro','nl360_elite') NOT NULL,
      billing_cycle        ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
      gateway              ENUM('coinbase','bank','manual') NOT NULL,
      gateway_charge_id    VARCHAR(255)  NULL,
      status               ENUM('pending','active','past_due','cancelled','expired') NOT NULL DEFAULT 'pending',
      current_period_start DATETIME      NULL,
      current_period_end   DATETIME      NULL,
      cancel_at_period_end TINYINT(1)    NOT NULL DEFAULT 0,
      cancelled_at         DATETIME      NULL,
      created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_invoices (
      id              CHAR(36)      NOT NULL PRIMARY KEY,
      subscription_id CHAR(36)      NOT NULL,
      user_id         INT           NOT NULL,
      gateway         ENUM('coinbase','bank','manual') NOT NULL,
      gateway_inv_id  VARCHAR(255)  NULL,
      amount_usd      DECIMAL(10,2) NOT NULL,
      currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
      status          ENUM('open','paid','void') NOT NULL DEFAULT 'open',
      period_start    DATETIME      NULL,
      period_end      DATETIME      NULL,
      paid_at         DATETIME      NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_subscription (subscription_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_webhook_events (
      id           VARCHAR(255) NOT NULL PRIMARY KEY,
      gateway      ENUM('coinbase','mercadopago') NOT NULL,
      event_type   VARCHAR(100) NOT NULL,
      processed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      payload      JSON         NULL,
      INDEX idx_gateway (gateway)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_coinbase_charges (
      charge_id      VARCHAR(100) NOT NULL PRIMARY KEY,
      charge_code    VARCHAR(20)  NULL,
      user_id        INT          NOT NULL,
      subscription_id CHAR(36)   NULL,
      plan_slug      ENUM('nl360_basic','nl360_pro','nl360_elite') NOT NULL,
      billing_cycle  ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
      amount_usd     DECIMAL(10,2) NOT NULL,
      hosted_url     VARCHAR(500) NULL,
      status         VARCHAR(50)  NOT NULL DEFAULT 'NEW',
      created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_bank_transfers (
      id           CHAR(36)      NOT NULL PRIMARY KEY,
      user_id      INT           NOT NULL,
      plan_slug    ENUM('nl360_basic','nl360_pro','nl360_elite') NOT NULL,
      billing_cycle ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
      amount_usd   DECIMAL(10,2) NOT NULL,
      receipt_url  VARCHAR(500)  NOT NULL,
      status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reviewed_by  INT           NULL,
      reviewed_at  DATETIME      NULL,
      notes        TEXT          NULL,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS bl_checkout_sessions (
      id                 CHAR(36)     NOT NULL PRIMARY KEY,
      user_id            INT          NOT NULL,
      plan_slug          ENUM('nl360_basic','nl360_pro','nl360_elite') NOT NULL,
      billing_cycle      ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
      gateway            ENUM('coinbase','bank') NOT NULL,
      gateway_session_id VARCHAR(255) NULL,
      status             ENUM('pending','completed','expired') NOT NULL DEFAULT 'pending',
      expires_at         DATETIME     NOT NULL,
      created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_gateway_session (gateway_session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  initialized = true;
}

const WP_BASE_URL = process.env.WP_BASE_URL!;
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export { COOKIE_NAME };

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

export async function getUserMeta(token: string): Promise<{
  id: number;
  roles: string[];
  isAdmin: boolean;
} | null> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      if (d.user?.id) {
        const roles: string[] = d.roles || [];
        return {
          id: Number(d.user.id),
          roles,
          isAdmin: roles.includes("administrator"),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}
