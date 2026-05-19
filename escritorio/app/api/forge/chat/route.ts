import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import {
  getProjectById,
  createProject,
  updateProject,
  saveChatMessage,
  getChatHistory,
} from "@/lib/forge/db-forge";
import { forgeChat, parseForgeReady } from "@/lib/forge/forge-ai";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

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

  // Get AI response
  const response = await forgeChat(messages, step || "onboarding");

  // Save assistant message
  await saveChatMessage(userId, "assistant", response, step || "onboarding", project_id);

  // Parse visual markers
  const visuals: Record<string, unknown> = {};

  const standardMatch = response.match(/<!--FORGE_STANDARD:(\[[\s\S]*?\])-->/);
  if (standardMatch) {
    try { visuals.standardPicker = JSON.parse(standardMatch[1]); } catch {}
  }

  const networkMatch = response.match(/<!--FORGE_NETWORK:(\[[\s\S]*?\])-->/);
  if (networkMatch) {
    try { visuals.networkOptions = JSON.parse(networkMatch[1]); } catch {}
  }

  const featuresMatch = response.match(/<!--FORGE_FEATURES:(\[[\s\S]*?\])-->/);
  if (featuresMatch) {
    try { visuals.featureOptions = JSON.parse(featuresMatch[1]); } catch {}
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
