import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";
import { normalizeGenerationMode } from "@/lib/manu-dev-lite-site";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  telegram: "Telegram",
};

let columnsEnsured = false;
async function ensureSocialColumn() {
  if (columnsEnsured) return;
  const pool = getPool();
  try { await pool.execute("ALTER TABLE md_projects ADD COLUMN social_links JSON DEFAULT NULL"); } catch {}
  columnsEnsured = true;
}

async function getUserId(token: string): Promise<number | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const d = await res.json();
    return d.user?.id ?? null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const d2 = await res2.json();
  return d2.id ?? null;
}

function getSocialUrl(platform: string, value: string): string {
  const v = value.trim().replace(/^@/, "");
  switch (platform) {
    case "instagram": return `https://instagram.com/${v}`;
    case "facebook": return value.includes("facebook.com")
      ? (value.startsWith("http") ? value : `https://${value}`)
      : `https://facebook.com/${v}`;
    case "tiktok": return `https://tiktok.com/@${v}`;
    case "whatsapp": return `https://wa.me/${v.replace(/\D/g, "")}`;
    case "youtube": return value.includes("youtube.com")
      ? (value.startsWith("http") ? value : `https://${value}`)
      : `https://youtube.com/@${v}`;
    case "twitter": return `https://x.com/${v}`;
    case "linkedin": return value.includes("linkedin.com")
      ? (value.startsWith("http") ? value : `https://${value}`)
      : `https://linkedin.com/company/${v}`;
    case "pinterest": return value.includes("pinterest.com")
      ? (value.startsWith("http") ? value : `https://${value}`)
      : `https://pinterest.com/${v}`;
    case "telegram": return value.startsWith("+")
      ? `https://t.me/${v.replace(/\D/g, "")}`
      : `https://t.me/${v}`;
    default: return value.startsWith("http") ? value : `https://${value}`;
  }
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  await ensureSocialColumn();
  const pool = getPool();
  const [rows] = (await pool.execute(
    "SELECT social_links FROM md_projects WHERE id = ? AND user_id = ?",
    [project_id, userId]
  )) as any;

  if (!rows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  let socialLinks: any[] = [];
  const raw = rows[0].social_links;
  if (raw) {
    try { socialLinks = typeof raw === "string" ? JSON.parse(raw) : raw; } catch {}
  }

  return NextResponse.json({ social_links: socialLinks });
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { project_id, social_links } = await req.json();
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  await ensureSocialColumn();
  const pool = getPool();
  const [rows] = (await pool.execute(
    "SELECT subdomain, generation_mode FROM md_projects WHERE id = ? AND user_id = ?",
    [project_id, userId]
  )) as any;

  if (!rows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const subdomain = rows[0].subdomain;
  const mode = normalizeGenerationMode(rows[0].generation_mode);
  const links: { platform: string; value: string }[] = Array.isArray(social_links) ? social_links : [];

  // Build enriched links with resolved URLs
  const enrichedLinks = links.map((l) => ({
    platform: l.platform,
    name: PLATFORM_NAMES[l.platform] || l.platform,
    url: getSocialUrl(l.platform, l.value),
    value: l.value,
  }));

  // Write app/social-links.js for Next projects
  const fileContent = `// Redes sociales — administradas desde el panel de control\nexport const socialLinks = ${JSON.stringify(enrichedLinks, null, 2)};\n`;

  const socialLinksPath = path.join(SITES_DIR, subdomain, "app", "social-links.js");
  const liteSocialPath = path.join(SITES_DIR, subdomain, "assets", "social-links.json");
  try {
    await fs.mkdir(path.dirname(socialLinksPath), { recursive: true });
    await fs.writeFile(socialLinksPath, fileContent, "utf8");

    // For Lite landing, also write JSON consumed by assets/app.js
    if (mode === "lite") {
      await fs.mkdir(path.dirname(liteSocialPath), { recursive: true });
      await fs.writeFile(liteSocialPath, `${JSON.stringify(enrichedLinks, null, 2)}\n`, "utf8");
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error escribiendo archivo: ${err.message}` },
      { status: 500 }
    );
  }

  // Persist to DB
  await pool.execute(
    "UPDATE md_projects SET social_links = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(links), project_id, userId]
  );

  return NextResponse.json({ ok: true, message: "Redes sociales guardadas" });
}
