import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getAllDeployedProjects } from "@/lib/forge/db-forge";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  try {
    const projects = await getAllDeployedProjects();

    // Return only public-safe data (no user_id, no internal fields)
    const tokens = projects.map((p) => ({
      id: p.id,
      name: p.name,
      tokenName: p.token_name,
      tokenSymbol: p.token_symbol,
      tokenStandard: p.token_standard,
      totalSupply: p.total_supply,
      decimals: p.decimals,
      network: p.network,
      status: p.status,
      testnetAddress: p.testnet_address,
      mainnetAddress: p.contract_address,
      testnetNetwork: p.testnet_network,
      mainnetNetwork: p.mainnet_network,
      verified: !!p.verified,
      verifiedUrl: p.verified_url,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
