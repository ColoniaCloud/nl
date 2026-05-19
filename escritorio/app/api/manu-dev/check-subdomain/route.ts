import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exec } from "child_process";
import { promisify } from "util";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

const execAsync = promisify(exec);
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

function sanitize(subdomain: string): string {
  return subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
}

async function checkDockerContainer(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=site-${name}" --format "{{.Names}}"`
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const subdomain = sanitize(
    req.nextUrl.searchParams.get("subdomain") || ""
  );

  if (!subdomain || subdomain.length < 3) {
    return NextResponse.json(
      { available: false, reason: "Subdominio inválido (mínimo 3 caracteres)" },
      { status: 400 }
    );
  }

  const NO_CACHE = { headers: { "Cache-Control": "no-store" } };

  const reserved = ["www", "api", "mail", "ftp", "admin", "app", "db", "files", "automata"];
  if (reserved.includes(subdomain)) {
    return NextResponse.json({ available: false, reason: "Subdominio reservado" }, NO_CACHE);
  }

  const pool = getPool();

  // Check in manu_dev DB
  const [mdRows] = (await pool.execute(
    "SELECT id FROM md_projects WHERE subdomain = ?",
    [subdomain]
  )) as any;
  if (mdRows.length > 0) {
    return NextResponse.json({ available: false, reason: "Ya existe un sitio con ese subdominio" }, NO_CACHE);
  }

  // Check Docker containers
  const containerExists = await checkDockerContainer(subdomain);
  if (containerExists) {
    return NextResponse.json({ available: false, reason: "Ya existe un sitio con ese subdominio" }, NO_CACHE);
  }

  return NextResponse.json({ available: true, subdomain }, NO_CACHE);
}
