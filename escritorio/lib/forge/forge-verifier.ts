/**
 * Forge Verifier — verify contracts on block explorers (Etherscan, PolygonScan, etc.)
 * Uses the Standard JSON Input verification method to handle OpenZeppelin imports.
 */
import path from "path";
import fs from "fs";
import { TESTNET_CONFIG } from "./forge-deployer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifyResult {
  success: boolean;
  guid?: string;
  url?: string;
  error?: string;
  alreadyVerified?: boolean;
}

export interface VerifyStatusResult {
  status: "pending" | "pass" | "fail";
  message: string;
}

// ─── Build Standard JSON Input ────────────────────────────────────────────────

function resolveOzPath(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "@openzeppelin", "contracts"),
    "/app/node_modules/@openzeppelin/contracts",
    path.join(__dirname, "..", "..", "node_modules", "@openzeppelin", "contracts"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

/**
 * Recursively collect all imported files from a Solidity source.
 * Returns a map of importPath → source content.
 */
function collectImports(
  sourceCode: string,
  collected: Map<string, string> = new Map(),
  ozBasePath?: string
): Map<string, string> {
  const ozBase = ozBasePath || resolveOzPath();
  const importRegex = /import\s+(?:{[^}]*}\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(sourceCode)) !== null) {
    const importPath = match[1];
    if (collected.has(importPath)) continue;

    if (importPath.startsWith("@openzeppelin/")) {
      const filePath = path.join(ozBase, importPath.replace("@openzeppelin/contracts/", ""));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        collected.set(importPath, content);
        // Recurse into this file's imports
        collectImports(content, collected, ozBase);
      } catch {
        // Skip files that can't be found
      }
    }
  }

  return collected;
}

/**
 * Build the Standard JSON Input format for Etherscan verification.
 */
function buildStandardJsonInput(sourceCode: string): string {
  const imports = collectImports(sourceCode);

  const sources: Record<string, { content: string }> = {
    "Contract.sol": { content: sourceCode },
  };

  for (const [importPath, content] of imports.entries()) {
    sources[importPath] = { content };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  return JSON.stringify(input);
}

// ─── Verify on Explorer ──────────────────────────────────────────────────────

export async function verifyContract(params: {
  contractAddress: string;
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  network: string;
  constructorArgs?: string; // ABI-encoded
}): Promise<VerifyResult> {
  const config = TESTNET_CONFIG[params.network];
  if (!config) {
    return { success: false, error: `Red no soportada: ${params.network}` };
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return {
      success: false,
      error: `API key no configurada (${config.apiKeyEnv}). Necesitas una API key de ${config.explorer.replace("https://", "").split(".")[0]} para verificar contratos.`,
    };
  }

  // Build the standard JSON input with all dependencies
  const standardJsonInput = buildStandardJsonInput(params.sourceCode);

  // Convert solc version format: "0.8.28+commit...." → "v0.8.28+commit...."
  let compilerVersion = params.compilerVersion;
  if (compilerVersion && !compilerVersion.startsWith("v")) {
    compilerVersion = "v" + compilerVersion;
  }

  const formData = new URLSearchParams();
  formData.append("apikey", apiKey);
  formData.append("module", "contract");
  formData.append("action", "verifysourcecode");
  formData.append("contractaddress", params.contractAddress);
  formData.append("sourceCode", standardJsonInput);
  formData.append("codeformat", "solidity-standard-json-input");
  formData.append("contractname", `Contract.sol:${params.contractName}`);
  formData.append("compilerversion", compilerVersion);
  formData.append("optimizationUsed", "1");
  formData.append("runs", "200");
  if (params.constructorArgs) {
    formData.append("constructorArguements", params.constructorArgs); // Note: Etherscan API has a typo in the param name
  }

  try {
    const response = await fetch(config.explorerApi, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.status === "1") {
      return {
        success: true,
        guid: data.result,
        url: `${config.explorer}/address/${params.contractAddress}#code`,
      };
    }

    // Check if already verified
    if (data.result && data.result.toLowerCase().includes("already verified")) {
      return {
        success: true,
        alreadyVerified: true,
        url: `${config.explorer}/address/${params.contractAddress}#code`,
      };
    }

    return { success: false, error: data.result || "Error desconocido al verificar" };
  } catch (err) {
    return {
      success: false,
      error: `Error de conexion con ${config.explorer}: ${err instanceof Error ? err.message : "desconocido"}`,
    };
  }
}

// ─── Check Verification Status ───────────────────────────────────────────────

export async function checkVerifyStatus(
  guid: string,
  network: string
): Promise<VerifyStatusResult> {
  const config = TESTNET_CONFIG[network];
  if (!config) return { status: "fail", message: `Red no soportada: ${network}` };

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) return { status: "fail", message: "API key no configurada" };

  try {
    const sep = config.explorerApi.includes("?") ? "&" : "?";
    const url = `${config.explorerApi}${sep}apikey=${encodeURIComponent(apiKey)}&module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "1") {
      return { status: "pass", message: "Contrato verificado exitosamente" };
    }

    if (data.result && data.result.toLowerCase().includes("pending")) {
      return { status: "pending", message: "Verificacion en progreso..." };
    }

    return { status: "fail", message: data.result || "Verificacion fallida" };
  } catch {
    return { status: "fail", message: "Error al consultar estado de verificacion" };
  }
}

// ─── Extract Contract Name from Source ────────────────────────────────────────

export function extractContractName(sourceCode: string): string {
  const match = sourceCode.match(/contract\s+(\w+)\s+/);
  return match?.[1] || "Contract";
}
