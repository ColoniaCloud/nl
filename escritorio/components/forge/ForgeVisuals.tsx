"use client";

import { useState } from "react";
import { Check, Copy, Download, FileCode2, ExternalLink, AlertTriangle } from "lucide-react";

// ─── Standard Picker ──────────────────────────────────────────────────────────

export function StandardPicker({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (standard: string) => void;
}) {
  const info: Record<string, { title: string; desc: string; icon: string }> = {
    "ERC-20": {
      title: "ERC-20 — Token Fungible",
      desc: "Divisible en fracciones. Ideal para representar participaciones o fraccionar un activo entre inversores.",
      icon: "coins",
    },
    "ERC-721": {
      title: "ERC-721 — NFT Unico",
      desc: "Indivisible, una pieza unica. Ideal para representar un activo completo como certificado de propiedad.",
      icon: "gem",
    },
    "ERC-1155": {
      title: "ERC-1155 — Multi-Token",
      desc: "Multiples tipos de tokens en un contrato. Ideal para colecciones, membresias con niveles, o activos con categorias.",
      icon: "layers",
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
      {options.map((std) => {
        const i = info[std];
        return (
          <button
            key={std}
            onClick={() => onSelect(std)}
            className={`text-left p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted hover:border-emerald-500/40 transition-colors`}
          >
            <div className="font-medium text-sm text-foreground">{i?.title || std}</div>
            <div className="text-xs text-muted-foreground mt-1">{i?.desc || ""}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Network Picker ───────────────────────────────────────────────────────────

export function NetworkPicker({
  options,
  onSelect,
}: {
  options: Array<{ name: string; id: string; gas: string; desc: string }>;
  onSelect: (networkId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
      {options.map((net) => (
        <button
          key={net.id}
          onClick={() => onSelect(net.id)}
          className="text-left p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted hover:border-emerald-500/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-foreground">{net.name}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{net.gas}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{net.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Feature Picker ───────────────────────────────────────────────────────────

export function FeaturePicker({
  options,
  onSelect,
}: {
  options: Array<{ id: string; label: string; desc: string }>;
  onSelect: (selected: string[]) => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(["ownable"]));

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2 my-2">
      <div className="grid grid-cols-1 gap-1.5">
        {options.map((f) => (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            className={`text-left p-2.5 rounded-lg border transition-colors ${
              chosen.has(f.id)
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-border bg-muted/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                  chosen.has(f.id) ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40"
                }`}
              >
                {chosen.has(f.id) && <Check className="w-3 h-3" />}
              </div>
              <span className="font-medium text-sm text-foreground">{f.label}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 ml-6">{f.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => onSelect(Array.from(chosen))}
        className="w-full py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
      >
        Confirmar features seleccionadas
      </button>
    </div>
  );
}

// ─── Contract Viewer ──────────────────────────────────────────────────────────

export function ContractViewer({
  sourceCode,
  abi,
  bytecode,
  compilerVersion,
  warnings,
  projectId,
  network,
}: {
  sourceCode: string;
  abi: unknown[];
  bytecode: string;
  compilerVersion: string;
  warnings?: string[];
  projectId: number;
  network: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"source" | "abi" | "deploy">("source");

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const explorerUrls: Record<string, string> = {
    polygon: "https://remix.ethereum.org",
    ethereum: "https://remix.ethereum.org",
    base: "https://remix.ethereum.org",
    arbitrum: "https://remix.ethereum.org",
  };

  return (
    <div className="bg-muted/50 rounded-xl border border-border overflow-hidden my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-foreground">Contrato compilado</span>
          <span className="text-[10px] text-muted-foreground">solc {compilerVersion}</span>
        </div>
        <a
          href={`/api/forge/download?project_id=${projectId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar paquete
        </a>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {warnings.length} advertencia(s) del compilador
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["source", "abi", "deploy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium ${
              tab === t ? "text-foreground border-b-2 border-emerald-500" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "source" ? "Solidity" : t === "abi" ? "ABI" : "Deploy"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative">
        <button
          onClick={() =>
            copyToClipboard(
              tab === "source" ? sourceCode : tab === "abi" ? JSON.stringify(abi, null, 2) : bytecode,
              tab
            )
          }
          className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground z-10"
        >
          {copied === tab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <pre className="p-4 text-xs text-foreground/80 overflow-auto max-h-[400px] font-mono leading-relaxed">
          {tab === "source"
            ? sourceCode
            : tab === "abi"
            ? JSON.stringify(abi, null, 2)
            : bytecode}
        </pre>
      </div>

      {/* Footer — deploy instructions */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">Como deployar:</strong> Copia el codigo Solidity y pegalo en{" "}
          <a
            href="https://remix.ethereum.org"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
          >
            Remix IDE <ExternalLink className="w-3 h-3" />
          </a>
          , compila con Solidity ^0.8.20, conecta MetaMask a{" "}
          <span className="text-foreground capitalize">{network}</span>, y deploya.
        </div>
      </div>
    </div>
  );
}
