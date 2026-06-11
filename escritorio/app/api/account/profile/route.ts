import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getAuthToken() {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

// GET — current profile
export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res2.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const me = await res2.json();
    return NextResponse.json({
      id: me.id,
      username: me.slug,
      displayName: me.name,
      email: "",
      roles: [],
    });
  }

  const data = await res.json();
  return NextResponse.json({
    id: data.user?.id,
    username: data.user?.username,
    displayName: data.user?.displayName,
    email: data.user?.email || "",
    roles: data.user?.roles || data.roles || [],
    plan: data.plan || null,
  });
}

// PATCH — update profile fields (displayName, email)
export async function PATCH(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = {};

  if (typeof body.displayName === "string" && body.displayName.trim()) {
    updates.name = body.displayName.trim().slice(0, 100);
  }
  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }
    updates.email = email;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return NextResponse.json(
      { error: err?.message || "Error al actualizar perfil" },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true });
}
