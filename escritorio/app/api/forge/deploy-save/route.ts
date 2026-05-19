import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, updateProject } from "@/lib/forge/db-forge";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

/**
 * POST: Save a client-side (MetaMask) mainnet deployment result to DB.
 * The user deploys from their browser wallet; then we record the result.
 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const body = await req.json();
  const { project_id, address, txHash, network, chainId } = body;

  if (!project_id || !address || !txHash || !network) {
    return NextResponse.json({ error: "Faltan campos: project_id, address, txHash, network" }, { status: 400 });
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Direccion de contrato invalida" }, { status: 400 });
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Hash de transaccion invalido" }, { status: 400 });
  }

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  if (project.status !== "compiled" && project.status !== "deployed_testnet") {
    return NextResponse.json({ error: "El contrato debe estar compilado primero" }, { status: 400 });
  }

  try {
    await updateProject(project_id, userId, {
      status: "deployed_mainnet",
      contract_address: address,
      mainnet_tx_hash: txHash,
      mainnet_network: network,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forge/deploy-save] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar deploy" },
      { status: 500 }
    );
  }
}
