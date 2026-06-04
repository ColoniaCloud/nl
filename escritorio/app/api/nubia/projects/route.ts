import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProjectsByUser } from "@/lib/nubia/db-nubia";
import { checkAgentAccess } from "@/lib/billing-access";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

export async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: [] } : null;
}

/** Backward-compat wrapper for routes that only need the user id. */
export async function getUserId(token: string): Promise<number | null> {
  const user = await getUser(token);
  return user?.id ?? null;
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  // F3: Verificar acceso al agente por plan
  const agentCheck = checkAgentAccess(user.roles, "nubia");
  if (!agentCheck.allowed) {
    return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
  }

  const projects = await getProjectsByUser(user.id);
  return NextResponse.json({ projects });
}
