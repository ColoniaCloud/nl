import { cookies } from "next/headers";
import { getPlanFromRoles } from "@/lib/billing-access";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

const WA_ALLOWED = new Set(["pro", "elite", "nl_setters", "nl_admin"]);

export class WaAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function resolveUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      return { id: data.user.id, roles: Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []) };
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

/**
 * Extrae userId del JWT nl360_jwt y verifica que el plan sea pro/elite/nl_setters.
 * Lanza WaAccessError con status 401 o 403 si no pasa.
 * Retorna el userId como string.
 */
export async function requireWaAccess(): Promise<string> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) throw new WaAccessError("No autenticado", 401);

  const user = await resolveUser(token);
  if (!user?.id) throw new WaAccessError("Token inválido", 401);

  const plan = getPlanFromRoles(user.roles);
  if (!WA_ALLOWED.has(plan)) {
    throw new WaAccessError(
      "WhatsApp requiere plan Pro o Elite. Actualizá tu plan para usar esta función.",
      403
    );
  }

  return String(user.id);
}
