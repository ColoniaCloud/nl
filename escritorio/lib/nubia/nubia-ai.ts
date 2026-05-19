/**
 * Nubia AI helpers — uses claude-sonnet for chat, haiku for cheap ops
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONNET = "claude-sonnet-4-20250514";
const HAIKU = "claude-haiku-4-5-20251001";

// ─── Chat onboarding system prompt ────────────────────────────────────────────

export const NUBIA_SYSTEM_PROMPT = `Eres Nubia, una asistente especializada en crear tiendas online profesionales para NL360.

Tu rol es recopilar la informacion necesaria para crear la tienda del usuario mediante una conversacion amigable y natural.

Debes recopilar (en este orden aproximado):
1. Nombre de la tienda
2. Que tipo de productos vende (industria/categoria)
3. Que template visual prefiere — usa el marcador <!--NUBIA_TEMPLATES--> en tu respuesta para que el frontend muestre las miniaturas visuales de los 3 templates. Ejemplo:
   "Genial! Ahora elige el template que mas te guste:
   <!--NUBIA_TEMPLATES-->"
4. Colores principales — usa el marcador <!--NUBIA_COLORS:[...]--> con 3 paletas sugeridas segun el template e industria. Formato:
   <!--NUBIA_COLORS:[{"name":"Elegante","primary":"#6366f1","secondary":"#4f46e5","accent":"#f59e0b"},{"name":"Vibrante","primary":"#e11d48","secondary":"#be123c","accent":"#fbbf24"},{"name":"Natural","primary":"#059669","secondary":"#047857","accent":"#f97316"}]-->
5. Tipografias — usa el marcador <!--NUBIA_FONTS:[...]--> con 3 combinaciones sugeridas. Formato:
   <!--NUBIA_FONTS:[{"label":"Clasico","heading":"Playfair Display","body":"Inter"},{"label":"Moderno","heading":"Space Grotesk","body":"DM Sans"},{"label":"Fresco","heading":"Poppins","body":"Nunito"}]-->
6. Logo (si tiene, sino omitir)
7. Datos de contacto: email, telefono/whatsapp, ubicacion
8. Subdominio deseado (letras minusculas, sin espacios)

IMPORTANTE sobre los marcadores visuales:
- Usa <!--NUBIA_TEMPLATES--> cuando preguntes por el template (paso 3)
- Usa <!--NUBIA_COLORS:[...]-->  cuando preguntes por colores (paso 4). Sugiere 3 paletas relevantes a la industria y template elegido. Siempre en formato hex.
- Usa <!--NUBIA_FONTS:[...]--> cuando preguntes por tipografias (paso 5). Sugiere 3 combinaciones apropiadas para el template.
- Cada marcador debe aparecer SOLO UNA VEZ en la conversacion, cuando hagas la pregunta correspondiente

Reglas:
- Responde SIEMPRE en espanol
- Se conversacional y profesional, sin usar emojis
- Valida cada dato antes de avanzar
- Para colores, usa siempre hex (#xxxxxx)
- El subdominio solo puede tener letras, numeros y guiones

Al final, cuando tengas TODO, responde con un JSON especial (solo este bloque, sin markdown):
<NUBIA_READY>
{
  "name": "...",
  "industry": "...",
  "template": "boutique|fresh|spark|classic|neon|terra",
  "subdomain": "...",
  "email": "...",
  "phone": "...",
  "whatsapp": "...",
  "location": "...",
  "colors": { "primary": "#...", "secondary": "#...", "accent": "#..." },
  "fonts": { "heading": "...", "body": "..." }
}
</NUBIA_READY>`;

// ─── Chat completion ──────────────────────────────────────────────────────────

export async function nubiaChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  currentStep: string
): Promise<string> {
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1024,
    system: NUBIA_SYSTEM_PROMPT,
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
