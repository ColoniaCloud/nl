export type PlanSlug =
  | "nl360_free"
  | "nl360_basic"
  | "nl360_pro"
  | "nl360_elite"
  | "nl_setters";

const WP_BASE_URL = process.env.WP_BASE_URL!;
const INTERNAL_SECRET = process.env.NL360_INTERNAL_SECRET!;

/**
 * Assigns a WordPress role to the user via the nl360-core admin endpoint.
 * This is the single integration point between the billing system and WordPress.
 */
export async function setUserPlan(
  userId: number,
  planSlug: PlanSlug
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${WP_BASE_URL}/wp-json/nl360/v1/admin/users/${userId}/set-plan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NL360-Internal": INTERNAL_SECRET,
        },
        body: JSON.stringify({ plan_slug: planSlug }),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: (body as Record<string, string>)?.message || `WP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    };
  }
}

/**
 * Calculates the period end date from now based on billing cycle.
 */
export function calcPeriodEnd(cycle: "monthly" | "annual"): Date {
  const d = new Date();
  if (cycle === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setDate(d.getDate() + 30);
  }
  return d;
}

export function toMysqlDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
