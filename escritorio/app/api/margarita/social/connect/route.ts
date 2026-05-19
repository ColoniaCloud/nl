import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthUrl, type Platform } from "@/lib/margarita-social";
import crypto from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

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

// GET /api/margarita/social/connect?platform=facebook
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform") as Platform | null;

    if (!platform) return NextResponse.json({ error: "platform requerido" }, { status: 400 });

    const validPlatforms: Platform[] = ["facebook", "instagram", "linkedin", "x", "gmb", "clickup"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: "Plataforma no soportada" }, { status: 400 });
    }

    // Generate state token: user_id:platform:random
    const state = `${user.id}:${platform}:${crypto.randomBytes(16).toString("hex")}`;

    const authUrl = buildAuthUrl(platform, state);
    if (!authUrl) {
      return NextResponse.json({
        error: `Credenciales OAuth no configuradas para ${platform}`,
      }, { status: 503 });
    }

    return NextResponse.json({ auth_url: authUrl, state });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
