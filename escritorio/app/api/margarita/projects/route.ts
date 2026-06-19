import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { checkAgentAccess } from "@/lib/billing-access";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  const pool = getPool();

  const statements = [
    `CREATE TABLE IF NOT EXISTS mm_brandbooks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      project_id INT NULL,
      business_name VARCHAR(255),
      industry VARCHAR(255),
      description TEXT,
      location VARCHAR(255),
      audience TEXT,
      tone_of_voice VARCHAR(100),
      brand_values JSON,
      tagline VARCHAR(255),
      unique_value_proposition TEXT,
      primary_color VARCHAR(7),
      secondary_color VARCHAR(7),
      accent_color VARCHAR(7),
      font_heading VARCHAR(100),
      font_body VARCHAR(100),
      logo_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS mm_social_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      platform ENUM('facebook','instagram','x','linkedin','gmb') NOT NULL,
      account_id VARCHAR(255),
      account_name VARCHAR(255),
      page_id VARCHAR(255),
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP NULL,
      scopes TEXT,
      connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_platform (user_id, platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS mm_strategies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandbook_id INT NOT NULL,
      title VARCHAR(255),
      objectives JSON,
      target_audience TEXT,
      content_pillars JSON,
      posting_frequency JSON,
      brand_voice_guidelines TEXT,
      hashtag_strategy TEXT,
      audit_summary JSON,
      selected_platforms JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS mm_content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      strategy_id INT NOT NULL,
      platform ENUM('facebook','instagram','x','linkedin','gmb') NOT NULL,
      post_type ENUM('image','carousel','story','reel','text','gmb_post') DEFAULT 'image',
      pillar VARCHAR(100),
      title VARCHAR(255),
      caption TEXT,
      hashtags TEXT,
      visual_description TEXT,
      media_url VARCHAR(512),
      scheduled_at DATETIME,
      status ENUM('draft','approved','scheduled','published','failed') DEFAULT 'draft',
      clickup_task_id VARCHAR(100),
      external_post_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS mm_chat_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandbook_id INT NULL,
      user_id INT NOT NULL,
      role ENUM('user','assistant') NOT NULL,
      content TEXT NOT NULL,
      step VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS mm_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      nombre VARCHAR(255) NOT NULL,
      empresa VARCHAR(255),
      email VARCHAR(255),
      telefono VARCHAR(50),
      optin TINYINT(1) DEFAULT 0,
      fecha_contactado DATE,
      pais VARCHAR(100),
      ciudad VARCHAR(100),
      direccion TEXT,
      etiquetas JSON,
      notas TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mc_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const sql of statements) {
    try {
      await pool.execute(sql);
    } catch {}
  }

  // Add clickup_list_id + calendar_url to mm_strategies if not present
  // Expand mm_social_accounts.platform ENUM to include 'clickup'
  // mm_tags catalog
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mm_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#10b981',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_tag (user_id, name),
      INDEX idx_mt_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});

  const extras = [
    "ALTER TABLE mm_strategies ADD COLUMN clickup_list_id VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE mm_strategies ADD COLUMN calendar_url VARCHAR(512) DEFAULT NULL",
    "ALTER TABLE mm_social_accounts MODIFY COLUMN platform ENUM('facebook','instagram','x','linkedin','gmb','clickup') NOT NULL",
    // mm_contacts extensions
    "ALTER TABLE mm_contacts ADD COLUMN website VARCHAR(500) DEFAULT NULL",
    "ALTER TABLE mm_contacts ADD COLUMN rubro VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE mm_contacts ADD COLUMN score TINYINT DEFAULT NULL",
    "ALTER TABLE mm_contacts ADD COLUMN status VARCHAR(20) DEFAULT 'nuevo'",
    "ALTER TABLE mm_contacts ADD COLUMN ai_analysis JSON DEFAULT NULL",
    "ALTER TABLE mm_contacts ADD COLUMN source VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE mm_contacts ADD COLUMN priority ENUM('high','medium','low') DEFAULT 'medium'",
    "ALTER TABLE mm_contacts ADD COLUMN website_quality ENUM('none','poor','decent','good') DEFAULT 'none'",
  ];
  for (const sql of extras) {
    try { await pool.execute(sql); } catch {}
  }

  tablesEnsured = true;
}

// GET /api/margarita/projects
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const [brandbooks] = (await pool.execute(
      `SELECT b.id, b.business_name, b.industry, b.tone_of_voice, b.primary_color,
              b.secondary_color, b.accent_color, b.created_at,
              p.subdomain, p.name AS manu_dev_name
       FROM mm_brandbooks b
       LEFT JOIN md_projects p ON p.id = b.project_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [user.id]
    )) as any;

    return NextResponse.json({ brandbooks });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

export { ensureTables };
