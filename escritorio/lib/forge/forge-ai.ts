/**
 * Forge AI — system prompts and Claude calls for token generation
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAgent, loadSystemPrompt } from "@/lib/agents";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONNET = getAgent("forge")!.model;

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function forgeChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  currentStep: string,
  brandContext?: string | null
): Promise<string> {
  const basePrompt = loadSystemPrompt("forge").trim();
  const system = brandContext
    ? `${basePrompt}\n\nContexto de la empresa que emite este token:\n${brandContext}`
    : basePrompt;
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1500,
    system,
    messages,
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Parse FORGE_READY block ──────────────────────────────────────────────────

export interface ForgeReadyData {
  name: string;
  asset_type: string;
  asset_description: string;
  token_name: string;
  token_symbol: string;
  token_standard: "ERC-20" | "ERC-721" | "ERC-1155";
  total_supply: string;
  decimals: number;
  network: string;
  features: Record<string, boolean>;
}

export function parseForgeReady(text: string): ForgeReadyData | null {
  const match = text.match(/<FORGE_READY>([\s\S]*?)<\/FORGE_READY>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

// ─── Generate Solidity code ───────────────────────────────────────────────────

export async function generateSolidity(project: ForgeReadyData): Promise<string> {
  const featureList = Object.entries(project.features)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");

  const prompt = `Genera un smart contract en Solidity para el siguiente token:

- Estandar: ${project.token_standard}
- Nombre: ${project.token_name}
- Simbolo: ${project.token_symbol}
- Supply total: ${project.total_supply}
- Decimales: ${project.decimals}
- Features: ${featureList || "ninguna extra"}
- Red destino: ${project.network}
- Descripcion del activo: ${project.asset_description}

Requisitos:
1. Usa Solidity ^0.8.20
2. Usa los contratos de OpenZeppelin v5 (importa desde @openzeppelin/contracts/)
3. El contrato debe ser completo y compilable
4. Incluye comentarios NATSPEC con la descripcion del activo
5. Para ERC-20: constructor que mintea el total_supply al deployer
6. Para ERC-721: constructor con name y symbol, funcion safeMint solo para owner
7. Para ERC-1155: constructor con URI base, funciones mint y mintBatch solo para owner
8. Incluye las features solicitadas usando los mixins de OpenZeppelin correspondientes
9. NO uses proxies ni upgradeable patterns
10. Agrega un campo string public constant ASSET_DESCRIPTION con la descripcion del activo

Responde SOLO con el codigo Solidity completo, sin markdown, sin explicaciones, sin bloques de codigo. Solo el .sol puro.`;

  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  let code = block.type === "text" ? block.text : "";

  // Strip any accidental markdown fences
  code = code.replace(/^```(?:solidity)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  return code;
}
