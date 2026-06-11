import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("Nubia");
import { cookies } from "next/headers";
import { getUser } from "@/app/api/nubia/projects/route";
import {
  getProjectById,
  createProject,
  upsertDesign,
  saveChatMessage,
  getChatHistory,
  subdomainAvailable,
  type NbProject,
} from "@/lib/nubia/db-nubia";
import { nubiaChat, parseNubiaReady, generateTagline } from "@/lib/nubia/nubia-ai";
import { upsertBrandbook, linkAgentProject, getBrandContext } from "@/lib/shared-project";
import { generateLogo, downloadLogoLocally } from "@/lib/logo-generator";
import { checkAgentAccess } from "@/lib/billing-access";
import getPool from "@/lib/db-manu";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  // C2: Verificar acceso al agente por plan
  const agentCheck = checkAgentAccess(user.roles, "nubia");
  if (!agentCheck.allowed) {
    return NextResponse.json({ error: agentCheck.reason }, { status: 403 });
  }

  const userId = user.id;

  const { message, project_id, step } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

  // Load chat history
  const history = await getChatHistory(userId, project_id, 20);

  // Build messages array
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: message },
  ];

  // Save user message
  await saveChatMessage(userId, "user", message, step || "onboarding", project_id);

  // Get brand context from shared_projects to avoid re-asking known data
  const brandContext = await getBrandContext(userId);

  // Get AI response (inject brand context so it knows what's already collected)
  const response = await nubiaChat(messages, step || "onboarding", brandContext);

  // Save assistant message
  await saveChatMessage(userId, "assistant", response, step || "onboarding", project_id);

  // Parse visual markers (templates, colors, fonts)
  const visuals: Record<string, unknown> = {};

  if (response.includes("<!--NUBIA_TEMPLATES-->")) {
    visuals.templatePicker = true;
  }

  const colorsMatch = response.match(/<!--NUBIA_COLORS:(\[[\s\S]*?\])-->/);
  if (colorsMatch) {
    try { visuals.colorPalettes = JSON.parse(colorsMatch[1]); } catch (error) {
      logger.warn("Error al parsear marker NUBIA_COLORS — se omiten las paletas de color");
    }
  }

  const fontsMatch = response.match(/<!--NUBIA_FONTS:(\[[\s\S]*?\])-->/);
  if (fontsMatch) {
    try { visuals.fontOptions = JSON.parse(fontsMatch[1]); } catch (error) {
      logger.warn("Error al parsear marker NUBIA_FONTS — se omiten las opciones de tipografía");
    }
  }

  // Strip visual markers from the reply text
  let cleanedReply = response
    .replace(/<!--NUBIA_TEMPLATES-->/g, "")
    .replace(/<!--NUBIA_COLORS:\[[\s\S]*?\]-->/g, "")
    .replace(/<!--NUBIA_FONTS:\[[\s\S]*?\]-->/g, "")
    .trim();

  // Check if AI returned NUBIA_READY
  const ready = parseNubiaReady(response);
  if (ready) {
    // Validate subdomain
    const subdomain = String(ready.subdomain || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const isAvailable = await subdomainAvailable(subdomain);

    if (!isAvailable) {
      const altMsg = `El subdominio "${subdomain}" no esta disponible. Por favor elige otro.`;
      await saveChatMessage(userId, "assistant", altMsg, "subdomain_conflict", project_id);
      return NextResponse.json({ reply: altMsg, step: "subdomain_conflict" });
    }

    const colors = (ready.colors as any) || {};
    const fonts = (ready.fonts as any) || {};

    // Upsert shared brandbook with all collected data
    const sharedId = await upsertBrandbook(userId, {
      name: String(ready.name || "Mi Tienda"),
      industry: String(ready.industry || ""),
      email: String((ready as any).email || "") || undefined,
      phone: String((ready as any).phone || "") || undefined,
      whatsapp: String((ready as any).whatsapp || "") || undefined,
      primary_color: colors.primary || undefined,
      secondary_color: colors.secondary || undefined,
      accent_color: colors.accent || undefined,
      font_heading: fonts.heading || undefined,
      font_body: fonts.body || undefined,
    });

    // Create project
    const projectId = await createProject({
      user_id: userId,
      subdomain,
      name: String(ready.name || "Mi Tienda"),
      description: String(ready.industry || ""),
      industry: String(ready.industry || ""),
      template: (["boutique", "fresh", "spark", "classic", "neon", "terra"].includes(String(ready.template)) ? ready.template : "boutique") as NbProject["template"],
      email: String((ready as any).email || ""),
      phone: String((ready as any).phone || ""),
      location: String((ready as any).location || ""),
      whatsapp: String((ready as any).whatsapp || ""),
    });

    // Link nubia project to shared_projects and update nb_projects.shared_project_id
    await linkAgentProject(sharedId, "nubia", projectId);
    const pool = getPool();
    await pool.execute(
      "UPDATE nb_projects SET shared_project_id = ? WHERE id = ?",
      [sharedId, projectId]
    );

    // M4: Link orphan chat history to the newly created project
    await pool.execute(
      "UPDATE nb_chat_history SET project_id = ? WHERE user_id = ? AND project_id IS NULL",
      [projectId, userId]
    );

    // Generate tagline and save design
    const tagline = await generateTagline(String(ready.name), String(ready.industry || "productos"));
    await upsertDesign(projectId, {
      primary_color: colors.primary || "#6366f1",
      secondary_color: colors.secondary || "#4f46e5",
      accent_color: colors.accent || "#f59e0b",
      font_heading: fonts.heading || "Playfair Display",
      font_body: fonts.body || "Inter",
      tagline,
    });

    // Persist tagline to shared brandbook
    if (tagline) await upsertBrandbook(userId, { tagline });

    // A2 + M1: Generate logo only if user requested it, non-blocking (fire-and-forget)
    const logoRequested = (ready as any).logo_requested !== false;
    if (logoRequested) {
      generateLogo({
        businessName: String(ready.name),
        industry: String(ready.industry || ""),
        primaryColor: colors.primary,
        secondaryColor: colors.secondary,
        accentColor: colors.accent,
        style: "modern",
      }).then(async (logoResult) => {
        if (!logoResult) return;
        // A2: Download SVG locally so the store can load it without CORS / URL expiry issues
        const localUrl = await downloadLogoLocally(projectId, logoResult.url);
        const finalUrl = localUrl ?? logoResult.url;
        await pool.execute("UPDATE nb_projects SET logo_url = ? WHERE id = ?", [finalUrl, projectId]);
        await upsertBrandbook(userId, { logo_url: finalUrl });
      }).catch((err) => logger.error("Error generando logo para Nubia (background)", err));
    }

    const cleanReply = (cleanedReply.replace(/<NUBIA_READY>[\s\S]*?<\/NUBIA_READY>/, "").trim())
      || `Perfecto! Tu tienda "${ready.name}" esta lista para construirse. Haz clic en "Crear tienda" para continuar.`;

    return NextResponse.json({
      reply: cleanReply,
      step: "ready",
      project_id: projectId,
      subdomain,
    });
  }

  return NextResponse.json({ reply: cleanedReply || response, step: step || "onboarding", ...visuals });
}
