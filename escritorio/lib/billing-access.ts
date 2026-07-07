import { PLANS, type PlanId } from "./billing-plans";
import getPool from "./db-manu";
import type { RowDataPacket } from "mysql2/promise";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentAccessResult {
  allowed: boolean;
  reason?: string;
  requiredPlan?: string;
}

export interface SiteCountResult {
  allowed: boolean;
  current: number;
  max: number | "unlimited";
  reason?: string;
}

// ─── Internal constants ───────────────────────────────────────────────────────

/** WP role priority from highest to lowest billing tier */
const ROLE_HIERARCHY: string[] = ["nl360_elite", "nl360_pro", "nl360_basic", "nl360_free"];

/** Maps WP role slugs to internal plan IDs */
const ROLE_TO_PLAN: Record<string, PlanId> = {
  nl360_elite: "elite",
  nl360_pro:   "pro",
  nl360_basic: "basic",
  nl360_free:  "free",
};

/**
 * Maps agent route slugs to the display names used in billing-plans.ts `tools[]`.
 * Only slugs listed here are considered billable agents.
 */
const SLUG_TO_TOOL_NAME: Record<string, string> = {
  "manu-dev":  "Manu Dev",
  "margarita": "Margarita",
  "jordan":    "Jordan",
  "mentoria":  "MentorIA",
  "forge":     "Forge",
  "nubia":     "Nubia",
};

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Maps an array of WP roles to the highest-tier internal plan slug.
 * Returns "nl_setters" for bypass users; otherwise returns the highest
 * plan ID among the recognized billing roles, defaulting to "free".
 */
export function getPlanFromRoles(roles: string[]): string {
  if (roles.includes("nl_setters")) return "nl_setters";
  if (roles.includes("administrator")) return "nl_admin";

  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) return ROLE_TO_PLAN[role];
  }
  return "free";
}

/**
 * Checks whether the given WP roles grant access to an agent.
 * nl_setters bypasses all checks. For regular plans, verifies that
 * the agent's tool name appears in the plan's `tools` array.
 * Returns { allowed: false, reason, requiredPlan } when access is denied.
 */
export function checkAgentAccess(roles: string[], agentSlug: string): AgentAccessResult {
  if (roles.includes("nl_setters") || roles.includes("administrator")) return { allowed: true };

  const planId = getPlanFromRoles(roles) as PlanId;
  const plan = PLANS[planId] ?? PLANS.free;

  const toolName = SLUG_TO_TOOL_NAME[agentSlug];
  if (!toolName) {
    return { allowed: false, reason: `Agente "${agentSlug}" no reconocido.` };
  }

  if (plan.tools.includes(toolName)) return { allowed: true };

  // Find the minimum plan that includes this agent
  const requiredPlanId = (["basic", "pro", "elite"] as PlanId[]).find(
    (pid) => PLANS[pid].tools.includes(toolName)
  ) ?? "elite";

  return {
    allowed: false,
    reason: `Tu plan ${plan.name} no incluye ${toolName}. Requerido: ${PLANS[requiredPlanId].name}.`,
    requiredPlan: requiredPlanId,
  };
}

/**
 * Checks whether a user can create more sites based on their plan's maxSites limit.
 * Counts active md_projects rows for the user (excludes 'draft', 'deleted' and
 * 'error' — a failed or reconciled-timeout build shouldn't permanently consume
 * a paid site slot).
 * Pass `excludeProjectId` to omit the project being built right now from its own
 * quota count — chat/route.ts flips a project to 'building' before create-site
 * runs this check, so without the exclusion a project always counts against itself.
 * Never throws — DB errors return { allowed: false, reason: "Error verificando límite de sitios." }.
 */
export async function checkMaxSites(
  userId: number | string,
  roles: string[],
  excludeProjectId?: number | string
): Promise<SiteCountResult> {
  if (roles.includes("administrator")) {
    return { allowed: true, current: 0, max: "unlimited" };
  }

  if (roles.includes("nl_setters")) {
    const SETTER_MAX_SITES = 20;
    try {
      const pool = getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM md_projects
         WHERE user_id = ? AND status NOT IN ('draft', 'deleted', 'error') AND id != ?`,
        [userId, excludeProjectId ?? 0]
      );
      const current = Number(rows[0]?.cnt ?? 0);
      if (current >= SETTER_MAX_SITES) {
        return {
          allowed: false,
          current,
          max: SETTER_MAX_SITES,
          reason: `Los setters pueden crear hasta ${SETTER_MAX_SITES} sitios en total`,
        };
      }
      return { allowed: true, current, max: SETTER_MAX_SITES };
    } catch {
      return {
        allowed: false,
        current: 0,
        max: SETTER_MAX_SITES,
        reason: "Error verificando límite de sitios.",
      };
    }
  }

  const planId = getPlanFromRoles(roles) as PlanId;
  const plan = PLANS[planId] ?? PLANS.free;
  const max = plan.maxSites;

  if (max === 0) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      reason: `Tu plan ${plan.name} no incluye creación de sitios.`,
    };
  }

  if (max === "unlimited") {
    return { allowed: true, current: 0, max: "unlimited" };
  }

  // max is a finite number beyond this point
  try {
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM md_projects
       WHERE user_id = ? AND status NOT IN ('draft', 'deleted', 'error') AND id != ?`,
      [userId, excludeProjectId ?? 0]
    );
    const current = Number(rows[0]?.cnt ?? 0);

    if (current >= max) {
      return {
        allowed: false,
        current,
        max,
        reason: `Alcanzaste el límite de ${max} sitio(s) de tu plan ${plan.name}. Actualizá tu plan para crear más.`,
      };
    }

    return { allowed: true, current, max };
  } catch {
    return {
      allowed: false,
      current: 0,
      max,
      reason: "Error verificando límite de sitios.",
    };
  }
}
