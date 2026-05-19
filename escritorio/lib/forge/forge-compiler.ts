/**
 * Forge Compiler — compiles Solidity source using solc-js
 *
 * We inline OpenZeppelin sources needed for compilation since solc-js
 * runs in an isolated environment without filesystem access to node_modules.
 * Instead, we use solc's import callback to resolve @openzeppelin imports
 * from the installed npm package.
 */
import path from "path";
import fs from "fs";

// Dynamic import for solc (CommonJS module)
let solcModule: typeof import("solc") | null = null;

async function getSolc() {
  if (!solcModule) {
    solcModule = await import("solc");
  }
  return (solcModule as any).default || solcModule;
}

export interface CompileResult {
  success: boolean;
  abi?: unknown[];
  bytecode?: string;
  compilerVersion?: string;
  errors?: string[];
  warnings?: string[];
}

export async function compileSolidity(sourceCode: string, contractName?: string): Promise<CompileResult> {
  const solc = await getSolc();
  const compilerVersion = solc.version ? solc.version() : "unknown";

  // Resolve the OpenZeppelin contracts path
  const ozBasePath = resolveOzPath();

  const input = {
    language: "Solidity",
    sources: {
      "Contract.sol": { content: sourceCode },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  // Import callback to resolve @openzeppelin imports from node_modules
  function findImports(importPath: string) {
    if (importPath.startsWith("@openzeppelin/")) {
      const filePath = path.join(ozBasePath, importPath.replace("@openzeppelin/contracts/", ""));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        return { contents: content };
      } catch {
        return { error: `File not found: ${importPath}` };
      }
    }
    return { error: `Import not found: ${importPath}` };
  }

  const outputStr = solc.compile(JSON.stringify(input), { import: findImports });
  const output = JSON.parse(outputStr);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === "error") {
        errors.push(err.formattedMessage || err.message);
      } else {
        warnings.push(err.formattedMessage || err.message);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, compilerVersion };
  }

  // Find the contract in output
  const contracts = output.contracts?.["Contract.sol"];
  if (!contracts) {
    return { success: false, errors: ["No contracts found in compilation output"], compilerVersion };
  }

  // Pick the right contract (by name or first one)
  const name = contractName || Object.keys(contracts)[0];
  const compiled = contracts[name];
  if (!compiled) {
    return {
      success: false,
      errors: [`Contract "${name}" not found. Available: ${Object.keys(contracts).join(", ")}`],
      compilerVersion,
    };
  }

  return {
    success: true,
    abi: compiled.abi,
    bytecode: "0x" + compiled.evm.bytecode.object,
    compilerVersion,
    warnings,
  };
}

function resolveOzPath(): string {
  // In Docker, node_modules is at /app/node_modules
  const candidates = [
    path.join(process.cwd(), "node_modules", "@openzeppelin", "contracts"),
    "/app/node_modules/@openzeppelin/contracts",
    path.join(__dirname, "..", "..", "node_modules", "@openzeppelin", "contracts"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback — let it fail with a clear error
  return candidates[0];
}
