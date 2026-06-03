import getPool from "@/lib/db-manu";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SharedProject {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  logo_svg: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  tagline: string | null;
  manu_dev_project_id: number | null;
  nubia_project_id: number | null;
  forge_project_id: number | null;
}

export interface BrandbookUpdate {
  name?: string;
  description?: string;
  industry?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_heading?: string;
  font_body?: string;
  tagline?: string;
  logo_url?: string;
  logo_svg?: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSharedProject(userId: number): Promise<SharedProject | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, user_id, name, description, industry, email, phone, whatsapp,
            logo_url, logo_svg, primary_color, secondary_color, accent_color,
            font_heading, font_body, tagline,
            manu_dev_project_id, nubia_project_id, forge_project_id
     FROM shared_projects WHERE user_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  ) as any[];
  return rows[0] ?? null;
}

export async function createSharedProject(
  userId: number,
  data: BrandbookUpdate
): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO shared_projects
       (user_id, name, description, industry, email, phone, whatsapp,
        primary_color, secondary_color, accent_color, font_heading, font_body,
        tagline, logo_url, logo_svg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name ?? "Mi Proyecto",
      data.description ?? null,
      data.industry ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.whatsapp ?? null,
      data.primary_color ?? null,
      data.secondary_color ?? null,
      data.accent_color ?? null,
      data.font_heading ?? null,
      data.font_body ?? null,
      data.tagline ?? null,
      data.logo_url ?? null,
      data.logo_svg ?? null,
    ]
  ) as any[];
  return (result as { insertId: number }).insertId;
}

// Upsert: creates shared_project if none exists for this user, otherwise updates
// with non-null fields from data. Returns the shared_project id.
export async function upsertBrandbook(
  userId: number,
  data: BrandbookUpdate
): Promise<number> {
  const existing = await getSharedProject(userId);
  if (!existing) {
    return createSharedProject(userId, data);
  }

  // Build dynamic SET clause with only provided fields
  const fields: string[] = [];
  const values: unknown[] = [];

  const map: [keyof BrandbookUpdate, string][] = [
    ["name", "name"],
    ["description", "description"],
    ["industry", "industry"],
    ["email", "email"],
    ["phone", "phone"],
    ["whatsapp", "whatsapp"],
    ["primary_color", "primary_color"],
    ["secondary_color", "secondary_color"],
    ["accent_color", "accent_color"],
    ["font_heading", "font_heading"],
    ["font_body", "font_body"],
    ["tagline", "tagline"],
    ["logo_url", "logo_url"],
    ["logo_svg", "logo_svg"],
  ];

  for (const [key, col] of map) {
    if (data[key] !== undefined && data[key] !== null) {
      fields.push(`\`${col}\` = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length > 0) {
    const pool = getPool();
    await pool.execute(
      `UPDATE shared_projects SET ${fields.join(", ")} WHERE id = ?`,
      [...values, existing.id]
    );
  }

  return existing.id;
}

// Link an agent-specific project id to the shared_project row
export async function linkAgentProject(
  sharedProjectId: number,
  agent: "manu_dev" | "nubia" | "forge",
  agentProjectId: number
): Promise<void> {
  const col =
    agent === "manu_dev"
      ? "manu_dev_project_id"
      : agent === "nubia"
      ? "nubia_project_id"
      : "forge_project_id";

  const pool = getPool();
  await pool.execute(
    `UPDATE shared_projects SET \`${col}\` = ? WHERE id = ?`,
    [agentProjectId, sharedProjectId]
  );
}

// Record a handoff event between agents for auditing
export async function recordHandoff(
  userId: number,
  sharedProjectId: number,
  fromAgent: string,
  toAgent: string,
  contextSnapshot?: Record<string, unknown>
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO shared_handoffs (user_id, shared_project_id, from_agent, to_agent, context_snapshot)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, sharedProjectId, fromAgent, toAgent, contextSnapshot ? JSON.stringify(contextSnapshot) : null]
  );
}

// Returns a compact one-line brand context string for injecting into system prompts.
// Returns null if no shared_project exists for this user.
export async function getBrandContext(userId: number): Promise<string | null> {
  const sp = await getSharedProject(userId);
  if (!sp) return null;

  const parts: string[] = [];
  if (sp.name)            parts.push(`Empresa: ${sp.name}`);
  if (sp.industry)        parts.push(`Industria: ${sp.industry}`);
  if (sp.description)     parts.push(`Descripcion: ${sp.description}`);

  const colors = [sp.primary_color, sp.secondary_color, sp.accent_color].filter(Boolean);
  if (colors.length)      parts.push(`Colores: ${colors.join(" / ")}`);

  const fonts = [sp.font_heading, sp.font_body].filter(Boolean);
  if (fonts.length)       parts.push(`Tipografia: ${fonts.join(" / ")}`);

  if (sp.tagline)         parts.push(`Tagline: ${sp.tagline}`);
  if (sp.email)           parts.push(`Email: ${sp.email}`);
  if (sp.whatsapp)        parts.push(`WhatsApp: ${sp.whatsapp}`);
  if (sp.logo_url)        parts.push(`Logo: ${sp.logo_url}`);

  return parts.length ? parts.join(" | ") : null;
}
