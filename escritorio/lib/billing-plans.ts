import type { PlanSlug } from "./wp-billing";

export type PlanId = "free" | "basic" | "pro" | "elite";
export type BillingCycle = "monthly" | "annual";

export interface PlanConfig {
  id: PlanId;
  slug: PlanSlug;
  name: string;
  monthlyUsd: number;
  annualUsd: number;
  tokens: string;
  maxSites: number | "unlimited";
  tools: string[];
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    slug: "nl360_free",
    name: "Free",
    monthlyUsd: 0,
    annualUsd: 0,
    tokens: "25,000 tokens/mes",
    maxSites: 0,
    tools: [],
    features: ["Acceso basico a la plataforma"],
  },
  basic: {
    id: "basic",
    slug: "nl360_basic",
    name: "Basic",
    monthlyUsd: 49,
    annualUsd: 490,
    tokens: "100,000 tokens/mes",
    maxSites: 1,
    tools: ["Manu Dev", "MentorIA"],
    features: ["1 sitio web", "Manu Dev", "MentorIA", "100k tokens/mes"],
  },
  pro: {
    id: "pro",
    slug: "nl360_pro",
    name: "Pro",
    monthlyUsd: 149,
    annualUsd: 1490,
    tokens: "250,000 tokens/mes",
    maxSites: 2,
    tools: ["Manu Dev", "Vilma", "MentorIA"],
    features: ["2 sitios web", "Manu Dev", "Vilma", "MentorIA", "250k tokens/mes"],
  },
  elite: {
    id: "elite",
    slug: "nl360_elite",
    name: "Elite",
    monthlyUsd: 299,
    annualUsd: 2990,
    tokens: "1,000,000 tokens/mes",
    maxSites: "unlimited",
    tools: ["Manu Dev", "Vilma", "Jordan", "MentorIA"],
    features: ["Sitios ilimitados", "Todos los agentes", "1M tokens/mes", "Soporte prioritario"],
  },
};

export const PLANS_SPECIAL: Record<string, PlanConfig> = {
  nl_setters: {
    id: "elite" as PlanId,
    slug: "nl_setters" as PlanSlug,
    name: "NL Setters",
    monthlyUsd: 0,
    annualUsd: 0,
    tokens: "unlimited",
    maxSites: 3,
    tools: ["Manu Dev", "Vilma", "Jordan", "MentorIA"],
    features: ["3 sitios web/dia", "Todos los agentes", "Uso libre"],
  },
};

/** Max sites that can be CREATED per day (0 = no daily cap, uses maxSites total) */
export const DAILY_BUILD_CAP: Record<string, number> = {
  nl_setters: 3,
};

export const PLAN_BY_SLUG: Record<string, PlanConfig> = {
  nl360_free:  PLANS.free,
  nl360_basic: PLANS.basic,
  nl360_pro:   PLANS.pro,
  nl360_elite: PLANS.elite,
  nl_setters:  PLANS_SPECIAL.nl_setters,
};

export function getPlanPrice(planId: PlanId, cycle: BillingCycle): number {
  const plan = PLANS[planId];
  return cycle === "annual" ? plan.annualUsd : plan.monthlyUsd;
}

/** Returns the slug for a given PlanId */
export function slugForPlan(planId: PlanId): PlanSlug {
  return PLANS[planId].slug;
}

/** Extracts the short id from a WP role slug, e.g. "nl360_pro" -> "pro" */
export function planIdFromSlug(slug: string): PlanId {
  const short = slug.replace("nl360_", "") as PlanId;
  return PLANS[short] ? short : "free";
}

// ─── Site Generation Modes ──────────────────────────────────────────────────

export type SiteGenerationMode = "lite" | "lite_plus" | "next";

/** Which generation modes each WP role can access */
export const ALLOWED_GENERATION_MODES: Record<string, SiteGenerationMode[]> = {
  nl360_free:    ["lite"],
  nl360_basic:   ["lite", "lite_plus"],
  nl360_pro:     ["lite", "lite_plus", "next"],
  nl360_elite:   ["lite", "lite_plus", "next"],
  nl_setters:    ["lite", "lite_plus", "next"],
  administrator: ["lite", "lite_plus", "next"],
};

/** Default generation mode per WP role */
export const DEFAULT_GENERATION_MODE: Record<string, SiteGenerationMode> = {
  nl360_free:    "lite",
  nl360_basic:   "lite_plus",
  nl360_pro:     "lite_plus",
  nl360_elite:   "lite_plus",
  nl_setters:    "lite_plus",
  administrator: "lite_plus",
};

/**
 * Returns the set of generation modes available to a user based on their WP roles.
 * If multiple roles grant different modes, the union of all is returned.
 * Administrator always gets all modes.
 */
export function getAllowedModes(roles: string[]): SiteGenerationMode[] {
  if (roles.includes("administrator")) return ["lite", "lite_plus", "next"];

  const modes = new Set<SiteGenerationMode>();
  for (const role of roles) {
    const allowed = ALLOWED_GENERATION_MODES[role];
    if (allowed) {
      for (const m of allowed) modes.add(m);
    }
  }
  // Fallback: if no recognized plan role, default to free (lite only)
  if (modes.size === 0) modes.add("lite");
  return ["lite", "lite_plus", "next"].filter((m) => modes.has(m as SiteGenerationMode)) as SiteGenerationMode[];
}

/**
 * Returns the default generation mode for a user based on their WP roles.
 * Picks the highest-tier default among all roles.
 */
export function getDefaultMode(roles: string[]): SiteGenerationMode {
  if (roles.includes("administrator")) return "lite_plus";

  const priority: SiteGenerationMode[] = ["next", "lite_plus", "lite"];
  for (const mode of priority) {
    for (const role of roles) {
      if (DEFAULT_GENERATION_MODE[role] === mode) return mode;
    }
  }
  return "lite";
}

/**
 * Validates that a requested mode is allowed for the given roles.
 * Returns the mode if allowed, otherwise falls back to the default.
 */
export function validateModeForRoles(
  requested: SiteGenerationMode,
  roles: string[],
): SiteGenerationMode {
  const allowed = getAllowedModes(roles);
  return allowed.includes(requested) ? requested : getDefaultMode(roles);
}
