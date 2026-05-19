import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById, updateProject, saveContract } from "@/lib/forge/db-forge";
import { generateSolidity } from "@/lib/forge/forge-ai";
import { compileSolidity } from "@/lib/forge/forge-compiler";
import type { ForgeReadyData } from "@/lib/forge/forge-ai";

export const runtime = "nodejs";
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

  try {
    // Step 1: Generate Solidity from project spec
    await updateProject(project_id, userId, { status: "generating" });

    const readyData: ForgeReadyData = {
      name: project.name || "Token",
      asset_type: project.asset_type,
      asset_description: project.asset_description || "",
      token_name: project.token_name || "Token",
      token_symbol: project.token_symbol || "TKN",
      token_standard: project.token_standard as "ERC-20" | "ERC-721",
      total_supply: project.total_supply || "1000000",
      decimals: project.decimals,
      network: project.network,
      features: project.features || {},
    };

    const sourceCode = await generateSolidity(readyData);

    // Step 2: Compile
    const result = await compileSolidity(sourceCode);

    if (!result.success) {
      await updateProject(project_id, userId, { status: "draft" });
      return NextResponse.json({
        error: "Error de compilacion",
        details: result.errors,
        sourceCode,
      }, { status: 422 });
    }

    // Step 3: Save contract
    await saveContract({
      project_id,
      source_code: sourceCode,
      abi: result.abi!,
      bytecode: result.bytecode!,
      compiler_version: result.compilerVersion!,
    });

    await updateProject(project_id, userId, { status: "compiled" });

    return NextResponse.json({
      ok: true,
      sourceCode,
      abi: result.abi,
      bytecode: result.bytecode,
      compilerVersion: result.compilerVersion,
      warnings: result.warnings,
    });
  } catch (err: unknown) {
    console.error("[forge/compile] Error:", err);
    await updateProject(project_id, userId, { status: "draft" });
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: "Error generando contrato", details: msg, stack }, { status: 500 });
  }
}
