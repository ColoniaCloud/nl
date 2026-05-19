"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Shield,
  ShieldCheck,
  Loader2,
  Wallet,
  ArrowUpRight,
  CircleDot,
  Coins,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenInfo {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  standard: string;
  ownerBalance: string;
}

interface DeployInfo {
  address: string;
  txHash: string;
  network: string;
  testnetNetwork: string;
  deployer: string;
  explorer: string;
  verified: boolean;
  verifiedUrl: string | null;
}

interface DashboardProps {
  projectId: number;
  deployInfo: DeployInfo;
  abi: unknown[];
  onVerify?: () => void;
}

// ─── Token Dashboard ──────────────────────────────────────────────────────────

export function TokenDashboard({ projectId, deployInfo, abi, onVerify }: DashboardProps) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState(deployInfo.verified);
  const [verifiedUrl, setVerifiedUrl] = useState(deployInfo.verifiedUrl);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // Load token info from the chain via our API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/forge/token-info?project_id=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setTokenInfo(data);
        }
      } catch {
        // Token info is optional — dashboard still shows deploy info
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/forge/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();

      if (data.ok) {
        if (data.alreadyVerified) {
          setVerified(true);
          setVerifiedUrl(data.url);
        } else if (data.guid) {
          // Poll for status
          pollVerifyStatus(data.guid, deployInfo.network, data.url);
        }
      } else {
        setVerifyError(data.error || "Error al verificar");
      }
    } catch {
      setVerifyError("Error de conexion");
    } finally {
      if (!verifying) setVerifying(false);
    }
  }

  async function pollVerifyStatus(guid: string, network: string, url: string) {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(
          `/api/forge/verify?guid=${encodeURIComponent(guid)}&network=${network}&project_id=${projectId}`
        );
        const data = await res.json();

        if (data.status === "pass") {
          setVerified(true);
          setVerifiedUrl(url);
          setVerifying(false);
          onVerify?.();
          return;
        }

        if (data.status === "pending" && attempts < maxAttempts) {
          setTimeout(poll, 3000);
          return;
        }

        setVerifyError(data.message || "Verificacion fallida");
        setVerifying(false);
      } catch {
        setVerifyError("Error al consultar estado");
        setVerifying(false);
      }
    };

    poll();
  }

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="bg-muted/50 rounded-xl border border-border overflow-hidden my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <CircleDot className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground">Token Dashboard</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
            Testnet
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{deployInfo.testnetNetwork}</span>
      </div>

      {/* Contract Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
        {/* Address */}
        <div className="bg-muted/30 px-4 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Direccion del contrato</div>
          <div className="flex items-center gap-1.5">
            <code className="text-xs text-foreground font-mono">{shortAddr(deployInfo.address)}</code>
            <button
              onClick={() => copy(deployInfo.address, "addr")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === "addr" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <a
              href={deployInfo.explorer}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* TX Hash */}
        <div className="bg-muted/30 px-4 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Transaccion de deploy</div>
          <div className="flex items-center gap-1.5">
            <code className="text-xs text-foreground font-mono">{shortAddr(deployInfo.txHash)}</code>
            <button
              onClick={() => copy(deployInfo.txHash, "tx")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === "tx" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Deployer */}
        <div className="bg-muted/30 px-4 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Deployer</div>
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3 h-3 text-muted-foreground" />
            <code className="text-xs text-foreground font-mono">{shortAddr(deployInfo.deployer)}</code>
          </div>
        </div>

        {/* Verification */}
        <div className="bg-muted/30 px-4 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Verificacion</div>
          {verified ? (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Verificado</span>
              {verifiedUrl && (
                <a href={verifiedUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {verifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-xs text-amber-400">Verificando...</span>
                </>
              ) : (
                <button
                  onClick={handleVerify}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Verificar contrato
                </button>
              )}
            </div>
          )}
          {verifyError && (
            <div className="text-[10px] text-red-400 mt-1">{verifyError}</div>
          )}
        </div>
      </div>

      {/* Token Info (from chain) */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Leyendo datos del contrato...</span>
        </div>
      ) : tokenInfo ? (
        <div className="border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
            <InfoCard label="Nombre" value={tokenInfo.name} />
            <InfoCard label="Simbolo" value={tokenInfo.symbol} />
            <InfoCard label="Supply total" value={formatSupply(tokenInfo.totalSupply, tokenInfo.decimals)} />
            <InfoCard label="Balance deployer" value={formatSupply(tokenInfo.ownerBalance, tokenInfo.decimals)} />
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="border-t border-border px-4 py-3 flex items-center gap-2 flex-wrap">
        <a
          href={deployInfo.explorer}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Ver en explorer
        </a>
        {!verified && !verifying && (
          <button
            onClick={handleVerify}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            Verificar en {deployInfo.testnetNetwork.split(" ")[0]}scan
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 px-4 py-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function formatSupply(raw: string, decimals: number): string {
  if (!raw || raw === "0") return "0";
  try {
    if (decimals === 0) return Number(raw).toLocaleString();
    const num = Number(raw) / Math.pow(10, decimals);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return raw;
  }
}
