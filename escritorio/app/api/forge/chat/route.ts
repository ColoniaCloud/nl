import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("Forge");
import { cookies } from "next/headers";
import {
  getProjectById,
  createProject,
  updateProject,
  saveChatMessage,
  getChatHistory,
} from "@/lib/forge/db-forge";
import { forgeChat, parseForgeReady } from "@/lib/forge/forge-ai";
import { getBrandContext, getSharedProject, linkAgentProject } from "@/lib/shared-project";
import getPool from "@/lib/db-manu";
import { checkAgentAccess } from "@/lib/billing-access";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
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

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  // F3: Verificar acceso al agente por plan
  const agentCheck = checkAgentAccess(user.roles, "forge");
  if (!agentCheck.allowed) {
    return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
  }

  const userId = user.id;

  const { message, project_id, step } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

  // Load chat history
  const history = await getChatHistory(userId, project_id, 30);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: message },
  ];

  // Save user message
  await saveChatMessage(userId, "user", message, step || "onboarding", project_id);

  // Get brand context (read-only for Forge — never writes to shared_projects)
  const brandContext = await getBrandContext(userId);

  // Get AI response
  const response = await forgeChat(messages, step || "onboarding", brandContext);

  // Save assistant message
  await saveChatMessage(userId, "assistant", response, step || "onboarding", project_id);

  // Parse visual markers
  const visuals: Record<string, unknown> = {};

  const standardMatch = response.match(/<!--FORGE_STANDARD:(\[[\s\S]*?\])-->/);
  if (standardMatch) {
    try { visuals.standardPicker = JSON.parse(standardMatch[1]); } catch (error) {
      logger.warn("Error al parsear marker FORGE_STANDARD — se omite el selector de token estándar");
    }
  }

  const networkMatch = response.match(/<!--FORGE_NETWORK:(\[[\s\S]*?\])-->/);
  if (networkMatch) {
    try { visuals.networkOptions = JSON.parse(networkMatch[1]); } catch (error) {
      logger.warn("Error al parsear marker FORGE_NETWORK — se omiten las opciones de red");
    }
  }

  const featuresMatch = response.match(/<!--FORGE_FEATURES:(\[[\s\S]*?\])-->/);
  if (featuresMatch) {
    try { visuals.featureOptions = JSON.parse(featuresMatch[1]); } catch (error) {
      logger.warn("Error al parsear marker FORGE_FEATURES — se omiten las opciones de features");
    }
  }

  // Check if FORGE_READY
  const ready = parseForgeReady(response);
  let newProjectId = project_id;

  if (ready) {
    // Create or update project with collected data
    if (project_id) {
      await updateProject(project_id, userId, {
        name: ready.name,
        asset_type: ready.asset_type,
        asset_description: ready.asset_description,
        token_name: ready.token_name,
        token_symbol: ready.token_symbol,
        token_standard: ready.token_standard,
        total_supply: ready.total_supply,
        decimals: ready.decimals,
        network: ready.network,
        features: ready.features,
        status: "generating",
      });
    } else {
      newProjectId = await createProject({
        user_id: userId,
        name: ready.name,
        asset_type: ready.asset_type,
        asset_description: ready.asset_description,
        token_name: ready.token_name,
        token_symbol: ready.token_symbol,
        token_standard: ready.token_standard,
        total_supply: ready.total_supply,
        decimals: ready.decimals,
        network: ready.network,
        features: ready.features,
      });
      await updateProject(newProjectId, userId, { status: "generating" });

      // Link to shared_project if one exists (Forge never creates/updates brandbook)
      try {
        const sharedProject = await getSharedProject(userId);
        if (sharedProject) {
          await linkAgentProject(sharedProject.id, "forge", newProjectId);
          const pool = getPool();
          await pool.execute(
            "UPDATE fg_projects SET shared_project_id = ? WHERE id = ?",
            [sharedProject.id, newProjectId]
          );
        }
      } catch {
        logger.warn("No se pudo vincular fg_project a shared_project");
      }
    }
    visuals.forgeReady = true;
    visuals.projectId = newProjectId;
  }

  // Clean visual markers from the displayed text
  let cleanResponse = response
    .replace(/<!--FORGE_STANDARD:[\s\S]*?-->/g, "")
    .replace(/<!--FORGE_NETWORK:[\s\S]*?-->/g, "")
    .replace(/<!--FORGE_FEATURES:[\s\S]*?-->/g, "")
    .replace(/<FORGE_READY>[\s\S]*?<\/FORGE_READY>/g, "")
    .trim();

  return NextResponse.json({
    response: cleanResponse,
    project_id: newProjectId,
    visuals,
  });
}
