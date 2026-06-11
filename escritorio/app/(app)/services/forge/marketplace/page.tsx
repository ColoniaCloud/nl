"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  Coins,
  ShieldCheck,
  ExternalLink,
  Search,
  ArrowUpRight,
  Layers,
  Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketToken {
  id: number;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenStandard: string;
  totalSupply: string;
  decimals: number;
  network: string;
  status: string;
  testnetAddress: string | null;
  mainnetAddress: string | null;
  testnetNetwork: string | null;
  mainnetNetwork: string | null;
  verified: boolean;
  verifiedUrl: string | null;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORK_META: Record<string, { label: string; color: string; explorer: string; mainnetExplorer: string }> = {
  polygon: {
    label: "Polygon",
    color: "text-purple-400 bg-purple-500/10",
    explorer: "https://amoy.polygonscan.com",
    mainnetExplorer: "https://polygonscan.com",
  },
  ethereum: {
    label: "Ethereum",
    color: "text-blue-400 bg-blue-500/10",
    explorer: "https://sepolia.etherscan.io",
    mainnetExplorer: "https://etherscan.io",
  },
  base: {
    label: "Base",
    color: "text-sky-400 bg-sky-500/10",
    explorer: "https://sepolia.basescan.org",
    mainnetExplorer: "https://basescan.org",
  },
  arbitrum: {
    label: "Arbitrum",
    color: "text-orange-400 bg-orange-500/10",
    explorer: "https://sepolia.arbiscan.io",
    mainnetExplorer: "https://arbiscan.io",
  },
};

const STANDARD_META: Record<string, { label: string; color: string }> = {
  "ERC-20": { label: "ERC-20", color: "text-emerald-400 bg-emerald-500/10" },
  "ERC-721": { label: "ERC-721", color: "text-amber-400 bg-amber-500/10" },
  "ERC-1155": { label: "ERC-1155", color: "text-violet-400 bg-violet-500/10" },
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatSupply(raw: string | null, decimals: number): string {
  if (!raw || raw === "0") return "0";
  try {
    if (decimals === 0) return Number(raw).toLocaleString();
    const num = Number(raw) / Math.pow(10, decimals);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return raw;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── Token Card ───────────────────────────────────────────────────────────────

function TokenCard({ token }: { token: MarketToken }) {
  const net = NETWORK_META[token.network] || NETWORK_META.polygon;
  const std = STANDARD_META[token.tokenStandard] || STANDARD_META["ERC-20"];
  const isMainnet = token.status === "deployed_mainnet";
  const address = isMainnet ? token.mainnetAddress : token.testnetAddress;
  const explorerBase = isMainnet ? net.mainnetExplorer : net.explorer;
  const explorerUrl = address ? `${explorerBase}/address/${address}` : "#";

  return (
    <div className="group rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {token.tokenName || token.name || "Token"}
              </h3>
              <span className="text-xs text-muted-foreground">{token.tokenSymbol}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {token.verified && (
              <span title="Verificado">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            )}
            <span
              className={`text-2xs px-1.5 py-0.5 rounded-full font-medium ${
                isMainnet
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {isMainnet ? "Mainnet" : "Testnet"}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-2xs px-1.5 py-0.5 rounded-full font-medium ${std.color}`}>
            {std.label}
          </span>
          <span className={`text-2xs px-1.5 py-0.5 rounded-full font-medium ${net.color}`}>
            {net.label}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-2xs text-muted-foreground">Supply</div>
            <div className="text-xs font-medium text-foreground">
              {formatSupply(token.totalSupply, token.decimals)}
            </div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground">Contrato</div>
            <div className="text-xs font-mono text-foreground">
              {address ? shortAddr(address) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">
          {timeAgo(token.updatedAt)} ago
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/services/forge?project=${token.id}`}
            className="text-xxs text-emerald-400 hover:text-emerald-300 font-medium transition-colors flex items-center gap-1"
          >
            Detalles
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          {address && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Ver en explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Marketplace Page ─────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { isMobile, setOpenMobile } = useSidebar();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [filterStandard, setFilterStandard] = useState<string>("all");

  useEffect(() => {
    fetch("/api/forge/marketplace", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.tokens)) setTokens(d.tokens);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tokens.filter((t) => {
    if (filterNetwork !== "all" && t.network !== filterNetwork) return false;
    if (filterStandard !== "all" && t.tokenStandard !== filterStandard) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.tokenName || "").toLowerCase().includes(q) ||
        (t.tokenSymbol || "").toLowerCase().includes(q) ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.testnetAddress || "").toLowerCase().includes(q) ||
        (t.mainnetAddress || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const mainnetCount = tokens.filter((t) => t.status === "deployed_mainnet").length;
  const testnetCount = tokens.filter((t) => t.status === "deployed_testnet").length;
  const verifiedCount = tokens.filter((t) => t.verified).length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-4 py-3 flex-shrink-0">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isMobile && (
                <button
                  onClick={() => setOpenMobile(true)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <FontAwesomeIcon icon={faBars} className="text-sm" />
                </button>
              )}
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">Forge Marketplace</h1>
                <p className="text-xxs text-muted-foreground">Tokens deployados en blockchain</p>
              </div>
            </div>
            <Link
              href="/services/forge"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              Crear token
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex-shrink-0">
        <div className="mx-auto w-full max-w-5xl flex items-center gap-4 text-xs text-muted-foreground">
          <span>{tokens.length} tokens</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-emerald-400" />
            {mainnetCount} mainnet
          </span>
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-amber-400" />
            {testnetCount} testnet
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            {verifiedCount} verificados
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-background px-4 py-2 flex-shrink-0">
        <div className="mx-auto w-full max-w-5xl flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, simbolo o direccion..."
              className="w-full rounded-lg border border-border bg-muted px-3 py-1.5 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Network filter */}
          <select
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
            className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Todas las redes</option>
            <option value="polygon">Polygon</option>
            <option value="ethereum">Ethereum</option>
            <option value="base">Base</option>
            <option value="arbitrum">Arbitrum</option>
          </select>

          {/* Standard filter */}
          <select
            value={filterStandard}
            onChange={(e) => setFilterStandard(e.target.value)}
            className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Todos los estandares</option>
            <option value="ERC-20">ERC-20</option>
            <option value="ERC-721">ERC-721</option>
            <option value="ERC-1155">ERC-1155</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-5xl">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
              Cargando tokens...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Coins className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {tokens.length === 0
                  ? "No hay tokens deployados todavia."
                  : "No se encontraron tokens con esos filtros."}
              </p>
              {tokens.length === 0 && (
                <Link
                  href="/services/forge"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Crea tu primer token
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
