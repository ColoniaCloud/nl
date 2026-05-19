/**
 * Manu Dev DB Migration Script
 * Run once: npx ts-node -e "require('./scripts/migrate-manu-dev.ts')"
 * Or: npx tsx scripts/migrate-manu-dev.ts
 *
 * Idempotent — safe to run multiple times.
 */

import mysql from "mysql2/promise";

async function main() {
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || "mysql",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "nl360user",
    password: process.env.MYSQL_PASSWORD!,
    database: "manu_dev",
    multipleStatements: true,
  });

  const conn = await pool.getConnection();

  try {
    console.log("Running Manu Dev migrations...");

    // ── md_projects: new columns ──────────────────────────────────────────────
    const addCols = [
      "ALTER TABLE md_projects ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL AFTER logo_url",
      "ALTER TABLE md_projects ADD COLUMN IF NOT EXISTS has_store TINYINT(1) NOT NULL DEFAULT 0 AFTER email",
      "ALTER TABLE md_projects ADD COLUMN IF NOT EXISTS has_blog TINYINT(1) NOT NULL DEFAULT 0 AFTER has_store",
      "ALTER TABLE md_projects ADD COLUMN IF NOT EXISTS store_info JSON NULL AFTER has_blog",
      "ALTER TABLE md_projects ADD COLUMN IF NOT EXISTS blog_config JSON NULL AFTER store_info",
    ];
    for (const sql of addCols) {
      try {
        await conn.execute(sql);
        console.log("  OK:", sql.slice(0, 60));
      } catch (e: any) {
        // MySQL 5.x doesn't support IF NOT EXISTS for columns — ignore duplicate errors
        if (!e.message?.includes("Duplicate column")) throw e;
        console.log("  SKIP (already exists):", sql.slice(0, 60));
      }
    }

    // ── md_messages ──────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS md_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(255),
        email       VARCHAR(255),
        phone       VARCHAR(50),
        subject     VARCHAR(255),
        message     TEXT NOT NULL,
        ip          VARCHAR(45),
        read_at     DATETIME NULL DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_msg_project FOREIGN KEY (project_id) REFERENCES md_projects(id) ON DELETE CASCADE,
        INDEX idx_msg_project (project_id),
        INDEX idx_msg_unread (project_id, read_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: md_messages");

    // ── md_product_categories ─────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS md_product_categories (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(255) NOT NULL,
        slug        VARCHAR(255) NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pcat_project FOREIGN KEY (project_id) REFERENCES md_projects(id) ON DELETE CASCADE,
        UNIQUE KEY uq_pcat_slug (project_id, slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: md_product_categories");

    // ── md_products ───────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS md_products (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        project_id   INT NOT NULL,
        category_id  INT NULL,
        name         VARCHAR(255) NOT NULL,
        description  TEXT,
        price        DECIMAL(12,2) NULL,
        sale_price   DECIMAL(12,2) NULL,
        images       JSON NULL COMMENT 'Array of up to 3 image URLs',
        tags         JSON NULL COMMENT 'Array of tag strings',
        active       TINYINT(1) NOT NULL DEFAULT 1,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_prod_project  FOREIGN KEY (project_id)  REFERENCES md_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES md_product_categories(id) ON DELETE SET NULL,
        INDEX idx_prod_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: md_products");

    // ── md_blog_categories ────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS md_blog_categories (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(255) NOT NULL,
        slug        VARCHAR(255) NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_bcat_project FOREIGN KEY (project_id) REFERENCES md_projects(id) ON DELETE CASCADE,
        UNIQUE KEY uq_bcat_slug (project_id, slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: md_blog_categories");

    // ── md_blog_posts ─────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS md_blog_posts (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        project_id      INT NOT NULL,
        category_id     INT NULL,
        title           VARCHAR(255) NOT NULL,
        slug            VARCHAR(255) NOT NULL,
        summary         TEXT,
        content         LONGTEXT,
        featured_image  VARCHAR(500),
        tags            JSON NULL,
        published       TINYINT(1) NOT NULL DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_post_project  FOREIGN KEY (project_id)  REFERENCES md_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_post_category FOREIGN KEY (category_id) REFERENCES md_blog_categories(id) ON DELETE SET NULL,
        UNIQUE KEY uq_post_slug (project_id, slug),
        INDEX idx_post_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  OK: md_blog_posts");

    console.log("\nAll migrations completed successfully.");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
