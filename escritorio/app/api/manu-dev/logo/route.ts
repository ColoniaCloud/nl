import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";

async function getUser(token: string): Promise<{ id: number } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    return data.user?.id ? { id: data.user.id } : null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id } : null;
}

// POST /api/manu-dev/logo — upload logo file
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const formData = await req.formData();
    const projectIdRaw = formData.get("project_id");
    const file = formData.get("file") as File | null;

    if (!projectIdRaw || !file) {
      return NextResponse.json({ error: "Faltan parametros" }, { status: 400 });
    }

    const projectId = parseInt(String(projectIdRaw), 10);
    if (isNaN(projectId)) return NextResponse.json({ error: "project_id invalido" }, { status: 400 });

    const pool = getPool();
    const [rows] = (await pool.execute(
      "SELECT subdomain FROM md_projects WHERE id = ? AND user_id = ?",
      [projectId, user.id]
    )) as any;

    if (!rows[0]) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const { subdomain } = rows[0];

    // Determine extension
    const originalName = file.name || "logo.png";
    const ext = path.extname(originalName).toLowerCase() || ".png";
    const allowedExts = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
    }

    const siteDir = path.join(SITES_DIR, subdomain);
    await fs.mkdir(siteDir, { recursive: true });

    const logoFileName = `logo${ext}`;
    const logoPath = path.join(siteDir, logoFileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(logoPath, Buffer.from(bytes));

    const logoUrl = `/logo${ext}`;
    await pool.execute(
      "UPDATE md_projects SET logo_url = ? WHERE id = ? AND user_id = ?",
      [logoUrl, projectId, user.id]
    );

    return NextResponse.json({ ok: true, logo_url: logoUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
