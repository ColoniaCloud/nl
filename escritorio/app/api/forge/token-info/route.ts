import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ethers } from "ethers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, getContract } from "@/lib/forge/db-forge";
import { TESTNET_CONFIG } from "@/lib/forge/forge-deployer";

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

  if (!project.testnet_address) {
    return NextResponse.json({ error: "Contrato no deployado" }, { status: 400 });
  }

  const contract = await getContract(projectId);
  if (!contract?.abi) {
    return NextResponse.json({ error: "ABI no encontrado" }, { status: 400 });
  }

  const config = TESTNET_CONFIG[project.network];
  if (!config) {
    return NextResponse.json({ error: "Red no soportada" }, { status: 400 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.rpc, {
      chainId: config.chainId,
      name: config.name,
    }, { staticNetwork: true });

    const deployerAddr = process.env.FORGE_DEPLOYER_ADDRESS || "";
    const contractInstance = new ethers.Contract(
      project.testnet_address,
      contract.abi as ethers.InterfaceAbi,
      provider
    );

    // Try to read standard token info
    const info: Record<string, string | number> = {
      standard: project.token_standard,
    };

    // ERC-20 / ERC-721 common methods
    try { info.name = await contractInstance.name(); } catch { info.name = project.token_name || ""; }
    try { info.symbol = await contractInstance.symbol(); } catch { info.symbol = project.token_symbol || ""; }

    if (project.token_standard === "ERC-20") {
      try { info.totalSupply = (await contractInstance.totalSupply()).toString(); } catch { info.totalSupply = "0"; }
      try { info.decimals = Number(await contractInstance.decimals()); } catch { info.decimals = 18; }
      try { info.ownerBalance = (await contractInstance.balanceOf(deployerAddr)).toString(); } catch { info.ownerBalance = "0"; }
    } else if (project.token_standard === "ERC-721") {
      try { info.totalSupply = (await contractInstance.totalSupply?.()).toString() || "0"; } catch { info.totalSupply = "0"; }
      info.decimals = 0;
      try { info.ownerBalance = (await contractInstance.balanceOf(deployerAddr)).toString(); } catch { info.ownerBalance = "0"; }
    } else if (project.token_standard === "ERC-1155") {
      info.totalSupply = project.total_supply || "0";
      info.decimals = 0;
      // ERC-1155: try to get balance of token ID 0 for the deployer
      try { info.ownerBalance = (await contractInstance.balanceOf(deployerAddr, 0)).toString(); } catch { info.ownerBalance = "0"; }
    }

    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json(
      { error: `Error leyendo contrato: ${err instanceof Error ? err.message : "desconocido"}` },
      { status: 500 }
    );
  }
}
