import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, getContract, updateProject } from "@/lib/forge/db-forge";
import { verifyContract, checkVerifyStatus, extractContractName } from "@/lib/forge/forge-verifier";
import { TESTNET_CONFIG } from "@/lib/forge/forge-deployer";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

// POST: submit contract for verification
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

  if (!project.testnet_address) {
    return NextResponse.json({ error: "El contrato debe estar deployado primero" }, { status: 400 });
  }

  const contract = await getContract(project_id);
  if (!contract?.source_code) {
    return NextResponse.json({ error: "Codigo fuente no encontrado" }, { status: 400 });
  }

  const contractName = extractContractName(contract.source_code);

  const result = await verifyContract({
    contractAddress: project.testnet_address,
    sourceCode: contract.source_code,
    contractName,
    compilerVersion: contract.compiler_version || "v0.8.28",
    network: project.network,
  });

  if (result.success) {
    const config = TESTNET_CONFIG[project.network];
    const verifiedUrl = result.url || `${config?.explorer}/address/${project.testnet_address}#code`;

    if (result.alreadyVerified) {
      await updateProject(project_id, userId, {
        verified: true,
        verified_url: verifiedUrl,
      } as any);
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        url: verifiedUrl,
      });
    }

    // Verification submitted — return guid for status polling
    return NextResponse.json({
      ok: true,
      guid: result.guid,
      url: verifiedUrl,
      message: "Verificacion enviada. Puede tardar unos segundos.",
    });
  }

  return NextResponse.json({ error: result.error }, { status: 422 });
}

// GET: check verification status by guid
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const guid = req.nextUrl.searchParams.get("guid");
  const network = req.nextUrl.searchParams.get("network");
  const projectId = req.nextUrl.searchParams.get("project_id");

  if (guid && network) {
    const result = await checkVerifyStatus(guid, network);

    if (result.status === "pass" && projectId) {
      const pid = Number(projectId);
      const config = TESTNET_CONFIG[network];
      const project = await getProjectById(pid, userId);
      if (project?.testnet_address) {
        await updateProject(pid, userId, {
          verified: true,
          verified_url: `${config?.explorer}/address/${project.testnet_address}#code`,
        } as any);
      }
    }

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "guid y network requeridos" }, { status: 400 });
}
