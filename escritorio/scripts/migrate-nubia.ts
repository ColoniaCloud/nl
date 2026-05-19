/**
 * Nubia DB Migration Script
 * Run once: npx tsx scripts/migrate-nubia.ts
 *
 * Idempotent — safe to run multiple times.
 * Tables use prefix nb_ inside manu_dev database.
 */

import mysql from "mysql2/promise";

async function main() {
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || "mysql_db",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "nl360user",
    password: process.env.MYSQL_PASSWORD!,
    database: process.env.MANU_DEV_DB || "manu_dev",
    multipleStatements: true,
  });

  const conn = await pool.getConnection();

  try {
    console.log("Running Nubia migrations...");

    // ── nb_projects ───────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_projects (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        user_id               INT NOT NULL,
        subdomain             VARCHAR(255) NOT NULL,
        name                  VARCHAR(255) NOT NULL,
        description           TEXT NULL,
        industry              VARCHAR(255) NULL,
        template              VARCHAR(20) NOT NULL DEFAULT 'boutique'
          COMMENT 'boutique | fresh | spark | classic | neon | terra',
        logo_url              VARCHAR(500) NULL,
        email                 VARCHAR(255) NULL,
        phone                 VARCHAR(50) NULL,
        location              VARCHAR(255) NULL,
        whatsapp              VARCHAR(50) NULL,
        manu_dev_project_id   INT NULL
          COMMENT 'Optional link to md_projects to inherit brandbook',
        container_id          VARCHAR(255) NULL,
        site_url              VARCHAR(500) NULL,
        status                VARCHAR(32) NOT NULL DEFAULT 'draft'
          COMMENT 'draft | building | active | error',
        last_build_error      TEXT NULL,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        build_started_at      DATETIME NULL,
        build_finished_at     DATETIME NULL,
        UNIQUE KEY uq_nb_subdomain (subdomain),
        INDEX idx_nb_user (user_id),
        INDEX idx_nb_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_projects");

    // ── nb_design ─────────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_design (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        project_id       INT NOT NULL,
        primary_color    VARCHAR(20) NOT NULL DEFAULT '#6366f1',
        secondary_color  VARCHAR(20) NOT NULL DEFAULT '#4f46e5',
        accent_color     VARCHAR(20) NOT NULL DEFAULT '#f59e0b',
        font_heading     VARCHAR(100) NOT NULL DEFAULT 'Playfair Display',
        font_body        VARCHAR(100) NOT NULL DEFAULT 'Inter',
        tagline          TEXT NULL
          COMMENT 'AI-generated store tagline',
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nb_design_project (project_id),
        CONSTRAINT fk_nb_design_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_design");

    // ── nb_categories ─────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_categories (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(255) NOT NULL,
        slug        VARCHAR(255) NOT NULL,
        description TEXT NULL,
        sort_order  INT NOT NULL DEFAULT 0,
        active      TINYINT(1) NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nb_cat_slug (project_id, slug),
        CONSTRAINT fk_nb_cat_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_categories");

    // ── nb_products ───────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_products (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        project_id           INT NOT NULL,
        category_id          INT NULL,
        name                 VARCHAR(255) NOT NULL,
        slug                 VARCHAR(255) NOT NULL,
        description          TEXT NULL,
        description_enhanced TEXT NULL
          COMMENT 'AI-improved version of description',
        price                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        compare_price        DECIMAL(12,2) NULL
          COMMENT 'Original price for discount display',
        stock                INT NULL
          COMMENT 'NULL = unlimited',
        track_stock          TINYINT(1) NOT NULL DEFAULT 0,
        images               JSON NULL
          COMMENT 'Array of image URL strings',
        featured             TINYINT(1) NOT NULL DEFAULT 0,
        active               TINYINT(1) NOT NULL DEFAULT 1,
        sort_order           INT NOT NULL DEFAULT 0,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nb_prod_slug (project_id, slug),
        INDEX idx_nb_prod_project (project_id),
        INDEX idx_nb_prod_category (category_id),
        CONSTRAINT fk_nb_prod_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_nb_prod_category FOREIGN KEY (category_id)
          REFERENCES nb_categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_products");

    // ── nb_payment_config ─────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_payment_config (
        id                         INT AUTO_INCREMENT PRIMARY KEY,
        project_id                 INT NOT NULL,
        bank_transfer_enabled      TINYINT(1) NOT NULL DEFAULT 0,
        bank_transfer_details      TEXT NULL
          COMMENT 'JSON: {bank, account, cbu, alias, holder}',
        mercadopago_enabled        TINYINT(1) NOT NULL DEFAULT 0,
        mercadopago_access_token   VARCHAR(255) NULL,
        mercadopago_public_key     VARCHAR(255) NULL,
        mercadopago_country        VARCHAR(5) NULL
          COMMENT 'AR | MX | CO | CL | BR | UY | PE',
        mercadopago_currency       VARCHAR(5) NULL
          COMMENT 'ARS | MXN | COP | CLP | BRL | UYU | PEN',
        coinbase_enabled           TINYINT(1) NOT NULL DEFAULT 0,
        coinbase_api_key           VARCHAR(255) NULL,
        coinbase_webhook_secret    VARCHAR(255) NULL,
        created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nb_pay_project (project_id),
        CONSTRAINT fk_nb_pay_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_payment_config");

    // ── nb_orders ─────────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_orders (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        project_id          INT NOT NULL,
        order_number        VARCHAR(20) NOT NULL,
        customer_name       VARCHAR(255) NULL,
        customer_email      VARCHAR(255) NULL,
        customer_phone      VARCHAR(50) NULL,
        shipping_address    TEXT NULL,
        subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        payment_method      VARCHAR(20) NOT NULL
          COMMENT 'bank_transfer | mercadopago | coinbase',
        payment_status      VARCHAR(20) NOT NULL DEFAULT 'pending'
          COMMENT 'pending | paid | failed | refunded',
        payment_reference   VARCHAR(255) NULL
          COMMENT 'MP preference_id or Coinbase charge_id',
        notes               TEXT NULL
          COMMENT 'Customer notes',
        admin_notes         TEXT NULL
          COMMENT 'Internal notes',
        status              VARCHAR(20) NOT NULL DEFAULT 'pending'
          COMMENT 'pending | confirmed | shipped | delivered | cancelled',
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nb_order_num (project_id, order_number),
        INDEX idx_nb_ord_project (project_id),
        INDEX idx_nb_ord_status (project_id, status),
        INDEX idx_nb_ord_payment (project_id, payment_status),
        CONSTRAINT fk_nb_ord_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_orders");

    // ── nb_order_items ────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_order_items (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        order_id       INT NOT NULL,
        product_id     INT NULL,
        product_name   VARCHAR(255) NOT NULL,
        product_price  DECIMAL(12,2) NOT NULL,
        quantity       INT NOT NULL DEFAULT 1,
        subtotal       DECIMAL(12,2) NOT NULL,
        CONSTRAINT fk_nb_item_order FOREIGN KEY (order_id)
          REFERENCES nb_orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_nb_item_product FOREIGN KEY (product_id)
          REFERENCES nb_products(id) ON DELETE SET NULL,
        INDEX idx_nb_item_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_order_items");

    // ── nb_chat_history ───────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS nb_chat_history (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        project_id  INT NULL,
        role        ENUM('user','assistant') NOT NULL,
        content     LONGTEXT NOT NULL,
        step        VARCHAR(32) NOT NULL DEFAULT 'welcome',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nb_chat_user (user_id),
        INDEX idx_nb_chat_project (project_id),
        CONSTRAINT fk_nb_chat_project FOREIGN KEY (project_id)
          REFERENCES nb_projects(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: nb_chat_history");

    console.log("\nAll Nubia migrations completed successfully.");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
