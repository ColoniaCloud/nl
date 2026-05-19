import { NextRequest, NextResponse } from "next/server";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";

// Simple in-memory rate limiter: max 10 submissions per IP per hour
const ipSubmissions = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipSubmissions.get(ip);
  if (!entry || now > entry.resetAt) {
    ipSubmissions.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // CORS for generated sites on *.nl360.site
  const origin = req.headers.get("origin") || "";
  const allowedOrigin =
    origin === "https://nl360.site" || origin.endsWith(".nl360.site")
      ? origin
      : "https://nl360.site";

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiados mensajes. Intenta de nuevo mas tarde." },
      { status: 429, headers: corsHeaders }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400, headers: corsHeaders });
  }

  const project_id = Number(body?.project_id);
  const name = String(body?.name || "").slice(0, 200);
  const email = String(body?.email || "").slice(0, 200);
  const phone = String(body?.phone || "").slice(0, 50);
  const subject = String(body?.subject || "").slice(0, 200);
  const message = String(body?.message || "").slice(0, 5000);

  if (!project_id || isNaN(project_id) || project_id <= 0) {
    return NextResponse.json({ error: "project_id requerido" }, { status: 400, headers: corsHeaders });
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "Mensaje requerido" }, { status: 400, headers: corsHeaders });
  }
  if (message.trim().length < 3) {
    return NextResponse.json({ error: "Mensaje demasiado corto" }, { status: 400, headers: corsHeaders });
  }

  // Basic email format validation if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400, headers: corsHeaders });
  }

  const pool = getPool();

  // Verify project exists and is active
  const [rows] = await pool.execute(
    "SELECT id FROM md_projects WHERE id = ? AND status = 'active' LIMIT 1",
    [project_id]
  ) as any;

  if (!rows.length) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404, headers: corsHeaders });
  }

  await pool.execute(
    `INSERT INTO md_messages (project_id, name, email, phone, subject, message, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [project_id, name || null, email || null, phone || null, subject || null, message, ip]
  );

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://nl360.site",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
