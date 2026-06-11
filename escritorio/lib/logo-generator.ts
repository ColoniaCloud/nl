import { createLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

const logger = createLogger("LogoGenerator");

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
  const { businessName, industry, style = "modern", additionalContext } = params;

  const styleDescriptions: Record<string, string> = {
    minimalist: "clean minimalist design, simple shapes, lots of white space, single color accent",
    modern:     "modern professional design, geometric shapes, clean lines, contemporary aesthetic",
    bold:       "bold impactful design, strong typography, high contrast, powerful visual identity",
    elegant:    "elegant sophisticated design, refined details, premium feel, luxury aesthetic",
    tech:       "tech startup design, digital aesthetic, sharp angles, futuristic elements",
    friendly:   "friendly approachable design, rounded shapes, warm tones, inviting aesthetic",
  };

  const industryHint = industry ? `, ${industry} sector` : "";
  const contextHint = additionalContext ? `. ${additionalContext}` : "";
  const styleHint = styleDescriptions[style] || styleDescriptions.modern;

  return [
    `Professional SVG logo for "${businessName}"${industryHint}.`,
    styleHint + ".",
    "Vector logo design: clear readable business name text integrated into the mark,",
    "transparent background, scalable vector artwork, no gradients, flat design.",
    "Suitable for business cards, websites, and print.",
    contextHint,
  ].join(" ").trim();
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
  remoteUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "logos");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `logo-${projectId}.svg`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    const frontendUrl = process.env.NL360_FRONTEND_URL || "https://nl360.site";
    return `${frontendUrl}/logos/${filename}`;
  } catch {
    return null;
  }
}
