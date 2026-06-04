-- 2026-06-04
-- Creates setter_clients table in nl360_billing to track the setter→client relationship.

CREATE TABLE IF NOT EXISTS nl360_billing.setter_clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  setter_id     INT NOT NULL COMMENT 'WP user_id del setter',
  client_id     INT NOT NULL COMMENT 'WP user_id del cliente',
  plan_slug     ENUM('nl360_free','nl360_basic','nl360_pro','nl360_elite')
                NOT NULL DEFAULT 'nl360_free',
  notes         TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client (client_id),
  INDEX idx_setter (setter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
