import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, getContract } from "@/lib/forge/db-forge";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const projectId = Number(req.nextUrl.searchParams.get("project_id"));
  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const project = await getProjectById(projectId, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const contract = await getContract(projectId);
  if (!contract || !contract.source_code) {
    return NextResponse.json({ error: "Contrato no compilado aun" }, { status: 404 });
  }

  // Build a deploy script for the user
  const deployScript = buildDeployScript(project, contract);

  // Build the package as a JSON bundle
  const bundle = {
    project: {
      name: project.name,
      token_name: project.token_name,
      token_symbol: project.token_symbol,
      token_standard: project.token_standard,
      network: project.network,
    },
    contract: {
      source_code: contract.source_code,
      abi: contract.abi,
      bytecode: contract.bytecode,
      compiler_version: contract.compiler_version,
    },
    deploy_script: deployScript,
    readme: buildReadme(project),
  };

  return NextResponse.json(bundle);
}

function buildDeployScript(
  project: { token_name: string | null; token_symbol: string | null; network: string },
  contract: { abi: unknown[] | null; bytecode: string | null }
): string {
  const rpcUrls: Record<string, string> = {
    polygon: "https://polygon-rpc.com",
    ethereum: "https://eth.llamarpc.com",
    base: "https://mainnet.base.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
  };

  const rpc = rpcUrls[project.network] || rpcUrls.polygon;

  return `// deploy.js — Script de deploy para ${project.token_name}
// Ejecutar: node deploy.js
// Requisitos: npm install ethers

const { ethers } = require("ethers");

const ABI = ${JSON.stringify(contract.abi, null, 2)};

const BYTECODE = "${contract.bytecode}";

async function main() {
  // IMPORTANTE: Reemplaza con tu private key y RPC
  // NUNCA compartas tu private key
  const PRIVATE_KEY = "TU_PRIVATE_KEY_AQUI";
  const RPC_URL = "${rpc}";

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployando desde:", wallet.address);
  console.log("Red: ${project.network}");

  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);

  // Estimar gas
  const deployTx = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas(deployTx);
  const feeData = await provider.getFeeData();
  const estimatedCost = gasEstimate * (feeData.gasPrice || 0n);
  console.log("Gas estimado:", gasEstimate.toString());
  console.log("Costo estimado:", ethers.formatEther(estimatedCost), "ETH/MATIC");

  // Deploy
  const contract = await factory.deploy();
  console.log("TX enviada:", contract.deploymentTransaction()?.hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("Contrato deployado en:", address);
  console.log("Verificar en explorer: https://${project.network === "ethereum" ? "etherscan.io" : project.network === "polygon" ? "polygonscan.com" : project.network === "base" ? "basescan.org" : "arbiscan.io"}/address/" + address);
}

main().catch(console.error);
`;
}

function buildReadme(project: {
  name: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_standard: string;
  network: string;
}): string {
  return `# ${project.token_name} (${project.token_symbol})

## Informacion del Token
- **Nombre**: ${project.token_name}
- **Simbolo**: ${project.token_symbol}
- **Estandar**: ${project.token_standard}
- **Red**: ${project.network}

## Archivos
- \`Contract.sol\` — Codigo fuente del smart contract
- \`abi.json\` — ABI del contrato (necesario para interactuar)
- \`deploy.js\` — Script de deploy con ethers.js

## Como deployar

### Opcion 1: Remix IDE (recomendado para principiantes)
1. Ir a https://remix.ethereum.org
2. Crear un archivo nuevo y pegar el contenido de Contract.sol
3. Compilar con Solidity ^0.8.20
4. Conectar MetaMask a la red ${project.network}
5. Deploy desde la pestana "Deploy & Run"

### Opcion 2: Script con ethers.js
1. Instalar Node.js si no lo tienes
2. \`npm install ethers\`
3. Editar deploy.js con tu private key
4. \`node deploy.js\`

## Importante
- Nunca compartas tu private key
- Primero deploya en testnet para probar
- La tokenizacion de activos reales requiere asesoria legal
`;
}
