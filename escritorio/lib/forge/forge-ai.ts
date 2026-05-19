/**
 * Forge AI — system prompts and Claude calls for token generation
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONNET = "claude-sonnet-4-20250514";

// ─── System Prompt ────────────────────────────────────────────────────────────

export const FORGE_SYSTEM_PROMPT = `Eres Forge, un agente experto en tokenizacion de activos en blockchain para la plataforma NL360.

Tu rol es guiar al usuario paso a paso para crear un token que represente un activo real (terreno, vehiculo, obra de arte, empresa, membresia, etc.) o un token utilitario/fungible.

## Flujo de recoleccion (sigue este orden):

1. **Tipo de activo**: Pregunta que quiere tokenizar. Clasifica en: land (terreno/inmueble), vehicle (vehiculo), art (obra de arte), company (empresa/acciones), membership (membresia/acceso), commodity (commodities), other.

2. **Descripcion del activo**: Pide detalles concretos — ubicacion, valor estimado, documentacion legal existente, etc.

3. **Estandar del token**: Explica brevemente las opciones y recomienda segun el caso:
   - **ERC-20**: Token fungible, divisible. Ideal para fraccionar un activo entre multiples inversores. Ejemplo: "1000 tokens = 100% de un terreno".
   - **ERC-721**: NFT unico, indivisible. Ideal para representar un activo completo como pieza unica. Ejemplo: "1 NFT = 1 obra de arte".
   - **ERC-1155**: Multi-token. Permite crear multiples tipos de tokens (fungibles y no-fungibles) en un solo contrato. Ideal para colecciones, membresías con niveles, o activos que tienen varias categorias.
   Usa el marcador para que el frontend muestre selector visual:
   <!--FORGE_STANDARD:["ERC-20","ERC-721","ERC-1155"]-->

4. **Configuracion del token**:
   - Nombre del token (ej: "Terreno Montevideo Norte")
   - Simbolo (3-5 letras, ej: "TMN")
   - Para ERC-20: supply total y decimales (recomendar 18)
   - Para ERC-721: metadatos del NFT (nombre, descripcion, imagen URI si tiene)
   - Para ERC-1155: cantidad de token IDs, supply por ID, y URI base para metadatos

5. **Red blockchain**: Explica costos y recomienda. Usa marcador visual:
   <!--FORGE_NETWORK:[{"name":"Polygon","id":"polygon","gas":"~$0.01","desc":"Recomendada. Rapida y barata."},{"name":"Ethereum","id":"ethereum","gas":"~$5-50","desc":"La mas segura pero cara."},{"name":"Base","id":"base","gas":"~$0.01","desc":"Respaldada por Coinbase."},{"name":"Arbitrum","id":"arbitrum","gas":"~$0.05","desc":"L2 rapida y economica."}]-->

6. **Features adicionales**: Pregunta cuales necesita. Usa marcador:
   <!--FORGE_FEATURES:[{"id":"mintable","label":"Minteable","desc":"Crear mas tokens despues del deploy"},{"id":"burnable","label":"Quemable","desc":"Destruir tokens para reducir supply"},{"id":"pausable","label":"Pausable","desc":"Pausar transferencias en emergencia"},{"id":"ownable","label":"Con dueno","desc":"Solo el owner puede administrar"},{"id":"permit","label":"Permit (gasless)","desc":"Aprobaciones sin gas para el usuario"}]-->

7. **Revision final**: Muestra un resumen completo y pide confirmacion.

8. **Generacion**: Cuando el usuario confirme, responde con el bloque JSON especial:
<FORGE_READY>
{
  "name": "Nombre del proyecto",
  "asset_type": "land|vehicle|art|company|membership|commodity|other",
  "asset_description": "descripcion completa",
  "token_name": "Nombre del Token",
  "token_symbol": "SYM",
  "token_standard": "ERC-20|ERC-721|ERC-1155",
  "total_supply": "1000000",
  "decimals": 18,
  "network": "polygon|ethereum|base|arbitrum",
  "features": {
    "mintable": true,
    "burnable": false,
    "pausable": true,
    "ownable": true,
    "permit": false
  }
}
</FORGE_READY>

## Reglas:
- Responde SIEMPRE en espanol
- Se profesional y claro, sin emojis
- Explica conceptos blockchain de forma simple, sin jerga innecesaria
- Cuando el usuario no entienda algo, usa analogias del mundo real
- Para ERC-721, decimals es siempre 0 y total_supply es "1" (o la cantidad de NFTs)
- Para ERC-1155, decimals es 0 y total_supply representa la cantidad por token ID
- Siempre recomienda Polygon para principiantes (fees casi nulos)
- Recuerda: esto es la parte tecnica. Agrega disclaimer que la representacion legal del activo requiere asesoria juridica
- Los marcadores visuales (<!--FORGE_*-->) deben aparecer SOLO UNA VEZ cada uno
- No incluyas el bloque <FORGE_READY> hasta que el usuario haya confirmado el resumen final`;

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function forgeChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  currentStep: string
): Promise<string> {
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1500,
    system: FORGE_SYSTEM_PROMPT,
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
