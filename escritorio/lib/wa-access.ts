import { cookies } from "next/headers";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

export class WaAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function resolveUserId(token: string): Promise<number | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) return data.user.id;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ?? null;
}

/**
 * Extrae userId del JWT nl360_jwt. Cualquier usuario autenticado puede
 * vincular su WhatsApp — no hay restricción por plan/rol.
 * Lanza WaAccessError con status 401 si no hay sesión válida.
 * Retorna el userId como string.
 */
export async function requireWaAccess(): Promise<string> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) throw new WaAccessError("No autenticado", 401);

  const userId = await resolveUserId(token);
  if (!userId) throw new WaAccessError("Token inválido", 401);

  return String(userId);
}
