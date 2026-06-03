/**
 * Nubia AI helpers — uses claude-sonnet for chat, haiku for cheap ops
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAgent, loadSystemPrompt } from "@/lib/agents";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONNET = getAgent("nubia")!.model;
const HAIKU = getAgent("nubia")!.models!.haiku;

// ─── Chat completion ──────────────────────────────────────────────────────────

export async function nubiaChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  currentStep: string,
  brandContext?: string | null
): Promise<string> {
  const basePrompt = loadSystemPrompt("nubia").trim();
  const system = brandContext
    ? `${basePrompt}\n\nContexto de marca del cliente (ya registrado, no volver a preguntar):\n${brandContext}`
    : basePrompt;
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1024,
    system,
    messages,
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Tagline generation ───────────────────────────────────────────────────────

export async function generateTagline(storeName: string, industry: string): Promise<string> {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Genera un tagline atractivo y corto (maximo 10 palabras) para una tienda llamada "${storeName}" que vende ${industry}. Solo devuelve el tagline, sin comillas ni explicacion.`,
      },
    ],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : `La mejor seleccion de ${industry}`;
}

// ─── Product description enhancer ────────────────────────────────────────────

export async function enhanceProductDescription(
  productName: string,
  rawDescription: string,
  industry: string
): Promise<string> {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Mejora esta descripcion de producto para una tienda de ${industry}:

Producto: ${productName}
Descripcion actual: ${rawDescription}

Crea una descripcion atractiva de 2-3 oraciones que destaque los beneficios y motive la compra. Solo devuelve la descripcion mejorada, sin encabezados ni explicaciones.`,
      },
    ],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : rawDescription;
}

// ─── Parse NUBIA_READY block ──────────────────────────────────────────────────

export function parseNubiaReady(text: string): Record<string, unknown> | null {
  const match = text.match(/<NUBIA_READY>([\s\S]*?)<\/NUBIA_READY>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}
