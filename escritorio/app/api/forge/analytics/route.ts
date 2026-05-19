import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/forge/projects/route";
import { getProjectById } from "@/lib/forge/db-forge";
import { TESTNET_CONFIG } from "@/lib/forge/forge-deployer";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

const MAINNET_EXPLORER_API: Record<string, { api: string; chainId: number }> = {
  polygon: { api: "https://api.etherscan.io/v2/api?chainid=137", chainId: 137 },
  ethereum: { api: "https://api.etherscan.io/v2/api?chainid=1", chainId: 1 },
  base: { api: "https://api.etherscan.io/v2/api?chainid=8453", chainId: 8453 },
  arbitrum: { api: "https://api.etherscan.io/v2/api?chainid=42161", chainId: 42161 },
};

interface Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  timeStamp: string;
  blockNumber: string;
}

/**
 * GET: Fetch token transfer history and holder-like stats from Etherscan API.
 * Params: project_id, type=testnet|mainnet
 */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const projectId = Number(req.nextUrl.searchParams.get("project_id"));
  const deployType = req.nextUrl.searchParams.get("type") || "testnet";

  if (!projectId)
    return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const project = await getProjectById(projectId, userId);
  if (!project)
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const contractAddress =
    deployType === "mainnet" ? project.contract_address : project.testnet_address;
  if (!contractAddress)
    return NextResponse.json({ error: "Contrato no deployado" }, { status: 400 });

  // Pick the right explorer API
  let explorerApi: string;
  if (deployType === "mainnet") {
    const cfg = MAINNET_EXPLORER_API[project.network];
    if (!cfg) return NextResponse.json({ error: "Red no soportada" }, { status: 400 });
    explorerApi = cfg.api;
  } else {
    const cfg = TESTNET_CONFIG[project.network];
    if (!cfg) return NextResponse.json({ error: "Red no soportada" }, { status: 400 });
    explorerApi = cfg.explorerApi;
  }

  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const sep = explorerApi.includes("?") ? "&" : "?";

  try {
    // Fetch token transfers (ERC-20/721/1155)
    const action =
      project.token_standard === "ERC-721"
        ? "tokennfttx"
        : project.token_standard === "ERC-1155"
        ? "token1155tx"
        : "tokentx";

    const url =
      `${explorerApi}${sep}module=account&action=${action}` +
      `&contractaddress=${contractAddress}` +
      `&page=1&offset=50&sort=desc&apikey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    const transfers: Transfer[] = [];
    const uniqueHolders = new Set<string>();

    if (data.status === "1" && Array.isArray(data.result)) {
      for (const tx of data.result) {
        transfers.push({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value || tx.tokenValue || "1",
          tokenName: tx.tokenName || project.token_name || "",
          tokenSymbol: tx.tokenSymbol || project.token_symbol || "",
          timeStamp: tx.timeStamp,
          blockNumber: tx.blockNumber,
        });
        if (tx.to) uniqueHolders.add(tx.to.toLowerCase());
      }
    }

    // Fetch normal transactions (to get gas usage / creation info)
    const txListUrl =
      `${explorerApi}${sep}module=account&action=txlist` +
      `&address=${contractAddress}` +
      `&page=1&offset=10&sort=desc&apikey=${apiKey}`;

    const txRes = await fetch(txListUrl, { cache: "no-store" });
    const txData = await txRes.json();

    let totalTxCount = 0;
    if (txData.status === "1" && Array.isArray(txData.result)) {
      totalTxCount = txData.result.length;
    }

    return NextResponse.json({
      transfers,
      stats: {
        totalTransfers: transfers.length,
        uniqueHolders: uniqueHolders.size,
        totalTransactions: totalTxCount,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener analytics" },
      { status: 500 }
    );
  }
}
