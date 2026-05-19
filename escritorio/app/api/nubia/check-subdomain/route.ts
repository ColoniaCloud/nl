import { NextRequest, NextResponse } from "next/server";
import { subdomainAvailable } from "@/lib/nubia/db-nubia";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const subdomain = String(body.subdomain || "").trim().toLowerCase();

  if (!subdomain || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(subdomain)) {
    return NextResponse.json({ available: false, error: "Subdominio invalido. Solo letras minusculas, numeros y guiones (min 3 caracteres)." });
  }

  const RESERVED = ["www", "api", "admin", "mail", "ftp", "nubia", "manu", "nl360", "app", "db", "files", "automata"];
  if (RESERVED.includes(subdomain)) {
    return NextResponse.json({ available: false, error: "Subdominio reservado." });
  }

  // Check both Nubia and Manu Dev tables
  const nubiaFree = await subdomainAvailable(subdomain);
  if (!nubiaFree) {
    return NextResponse.json({ available: false, error: "Subdominio no disponible." });
  }

  const pool = getPool();
  const [rows] = await pool.execute("SELECT id FROM md_projects WHERE subdomain = ? LIMIT 1", [subdomain]);
  if ((rows as unknown[]).length > 0) {
    return NextResponse.json({ available: false, error: "Subdominio no disponible." });
  }

  return NextResponse.json({ available: true });
}
