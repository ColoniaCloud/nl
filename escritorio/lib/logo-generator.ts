import { createLogger } from "@/lib/logger";
import fs from "fs/promises";
import path from "path";

const logger = createLogger("LogoGenerator");

const SITES_DIR = "/opt/docker-apps/sites";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogoParams {
  businessName: string;
  industry?: string;
  primaryColor?: string;    // hex, e.g. "#1a1a2e"
  secondaryColor?: string;
  accentColor?: string;
  style?: "minimalist" | "modern" | "bold" | "elegant" | "tech" | "friendly";
  additionalContext?: string;
}

export interface LogoResult {
  url: string;
  svgContent?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function buildPrompt(params: LogoParams): string {
  const styleDescriptions: Record<string, string> = {
    minimalist: "ultra-minimalist, clean lines, simple geometric shapes",
    modern: "modern professional, balanced composition, strong visual hierarchy",
    bold: "bold impactful, strong contrast, powerful typography, commanding presence",
    elegant: "elegant sophisticated, refined details, premium luxury feel",
    tech: "tech-forward, geometric precision, digital aesthetic, sharp edges",
    friendly: "friendly approachable, rounded shapes, warm and inviting feel",
  };

  const styleDesc = styleDescriptions[params.style || "modern"] || styleDescriptions.modern;

  const colorHint = params.primaryColor
    ? `Primary brand color: ${params.primaryColor}.`
    : "";

  return `Professional logo for "${params.businessName}"${params.industry ? `, a ${params.industry} business` : ""}.

Style: ${styleDesc}. ${colorHint}
${params.additionalContext ? `Context: ${params.additionalContext}.` : ""}

Design requirements:
- Logomark (icon/symbol) combined with the business name as wordmark
- Transparent background, flat design, no gradients, no shadows
- Bold clean typography, fully legible at small sizes
- Horizontal composition suitable for a website header (wider than tall, not square)
- The logomark + wordmark group must fill the canvas edge-to-edge with minimal margin (no more than 5% padding on any side) — avoid centering a small composition inside a large empty canvas
- Scalable vector shapes, no raster effects
- Single cohesive visual concept that represents the brand
- Do NOT include taglines, decorative borders, or complex textures`;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateLogo(params: LogoParams): Promise<LogoResult | null> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) {
    logger.warn("RECRAFT_API_KEY no configurada — generacion de logo omitida");
    return null;
  }

  // Build color palette from hex values
  const colors: [number, number, number][] = [];
  for (const hex of [params.primaryColor, params.secondaryColor, params.accentColor]) {
    if (!hex) continue;
    const rgb = hexToRgb(hex);
    if (rgb) colors.push(rgb);
  }

  const body: Record<string, unknown> = {
    model: "recraftv4_vector",
    prompt: buildPrompt(params),
    style: "vector_illustration",
    n: 1,
    response_format: "url",
  };

  if (colors.length > 0) {
    body.colors = colors.map(([r, g, b]) => ({ r, g, b }));
  }

  try {
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      logger.error(`Recraft API error ${res.status}`, new Error(errText));
      return null;
    }

    const data = await res.json();
    const url: string | undefined = data?.data?.[0]?.url;

    if (!url) {
      logger.error("Recraft no retorno URL en la respuesta", new Error(JSON.stringify(data).slice(0, 200)));
      return null;
    }

    logger.info(`Logo generado para "${params.businessName}": ${url}`);
    return { url };

  } catch (error) {
    logger.error("Error generando logo con Recraft", error);
    return null;
  }
}

// ─── Local download ───────────────────────────────────────────────────────────

/**
 * Downloads a remote logo URL and saves it to /public/logos/logo-{projectId}.svg.
 * Returns the local absolute URL (using NL360_FRONTEND_URL) or null on failure.
 * Shared by Manu Dev and Nubia so generated sites load logos without CORS/expiry issues.
 */
export async function downloadLogoLocally(
  projectId: number,
  remoteUrl: string,
  subdomain?: string,
): Promise<string | null> {
  try {
    const response = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();

    if (subdomain) {
      // Save to sites/{subdomain}/ — persistent volume, served by site's own nginx
      const siteDir = path.join(SITES_DIR, subdomain);
      await fs.mkdir(siteDir, { recursive: true });
      const destPath = path.join(siteDir, "logo-ia.svg");
      await fs.writeFile(destPath, Buffer.from(buffer));
      console.log(`[logo-generator] Logo guardado en ${destPath}`);
      return `/logo-ia.svg`;
    } else {
      // Fallback: save to public/logos/ (for Nubia or unknown callers)
      const logosDir = path.join(process.cwd(), "public", "logos");
      await fs.mkdir(logosDir, { recursive: true });
      const localPath = path.join(logosDir, `logo-${projectId}.svg`);
      await fs.writeFile(localPath, Buffer.from(buffer));
      const frontendUrl = process.env.NL360_FRONTEND_URL || "https://nl360.site";
      console.log(`[logo-generator] Logo guardado en public/logos/ (sin subdomain)`);
      return `${frontendUrl}/logos/logo-${projectId}.svg`;
    }
  } catch (err: any) {
    console.error("[logo-generator] Error descargando logo:", err?.message);
    return null;
  }
}
