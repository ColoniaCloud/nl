import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

// POST — change password
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { newPassword } = body;

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "La contrasena debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return NextResponse.json(
      { error: err?.message || "Error al cambiar contrasena" },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true });
}
