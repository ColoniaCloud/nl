import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, getContract, updateProject } from "@/lib/forge/db-forge";
import { deployToTestnet, getDeployerBalance } from "@/lib/forge/forge-deployer";

export const runtime = "nodejs";
export const maxDuration = 120; // Deploy can take a while
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { project_id } = await req.json();
  if (!project_id) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  // Must be compiled first
  if (project.status !== "compiled" && project.status !== "deployed_testnet") {
    return NextResponse.json({ error: "El contrato debe estar compilado primero" }, { status: 400 });
  }

  const contract = await getContract(project_id);
  if (!contract?.abi || !contract.bytecode) {
    return NextResponse.json({ error: "Contrato no compilado" }, { status: 400 });
  }

  try {
    const result = await deployToTestnet(
      contract.abi as unknown[],
      contract.bytecode,
      project.network
    );

    // Update project with deploy info
    await updateProject(project_id, userId, {
      status: "deployed_testnet",
      testnet_address: result.address,
      deploy_tx_hash: result.txHash,
      testnet_network: result.network,
    });

    return NextResponse.json({
      ok: true,
      address: result.address,
      txHash: result.txHash,
      network: result.network,
      chainId: result.chainId,
      explorer: result.explorer,
      explorerTx: result.explorerTx,
      deployer: result.deployer,
      gasUsed: result.gasUsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al deployar";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[forge/deploy] Error:", message, stack);
    return NextResponse.json(
      { error: message, stack: stack?.split("\n").slice(0, 5).join("\n") },
      { status: 500 }
    );
  }
}

// GET: check deployer balance for a network
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const network = req.nextUrl.searchParams.get("network") || "polygon";

  try {
    const info = await getDeployerBalance(network);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
