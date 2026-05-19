"use client";

import { useState, useCallback } from "react";
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ArrowUpRight,
  ChevronDown,
  X,
  Fuel,
  CircleDot,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MainnetConfig {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  currency: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

interface WalletDeployProps {
  projectId: number;
  abi: unknown[];
  bytecode: string;
  network: string;
  onDeployed: (data: {
    address: string;
    txHash: string;
    network: string;
    chainId: number;
    explorer: string;
  }) => void;
  onClose: () => void;
}

type DeployStep =
  | "connect"
  | "chain-switch"
  | "gas-estimate"
  | "confirm"
  | "deploying"
  | "success"
  | "error";

const MAINNET_CONFIGS: Record<string, MainnetConfig> = {
  polygon: {
    chainId: 137,
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    currency: "MATIC",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    currency: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  base: {
    chainId: 8453,
    name: "Base",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    currency: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    currency: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHexChainId(chainId: number) {
  return "0x" + chainId.toString(16);
}

function getConstructorArgs(abi: unknown[], deployerAddress: string): unknown[] {
  const abiArray = abi as Array<{
    type?: string;
    inputs?: Array<{ name: string; type: string }>;
  }>;
  const constructor = abiArray.find((item) => item.type === "constructor");
  if (!constructor?.inputs || constructor.inputs.length === 0) return [];

  return constructor.inputs.map((input) => {
    if (input.type === "address") return deployerAddress;
    if (input.type === "string") return "";
    if (input.type.startsWith("uint") || input.type.startsWith("int")) return 0;
    if (input.type === "bool") return false;
    if (input.type.startsWith("bytes")) return "0x";
    return deployerAddress;
  });
}

// ─── Step Display ─────────────────────────────────────────────────────────────

function StepRow({
  icon,
  label,
  active,
  done,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          done
            ? "bg-emerald-500/20 text-emerald-400"
            : active
            ? "bg-foreground/10 text-foreground"
            : "bg-muted text-muted-foreground/40"
        }`}
      >
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : icon}
      </div>
      <span
        className={`text-xs ${
          done
            ? "text-emerald-400"
            : active
            ? "text-foreground font-medium"
            : "text-muted-foreground/50"
        }`}
      >
        {label}
      </span>
      {active && !done && (
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
      )}
    </div>
  );
}

// ─── WalletDeploy Component ───────────────────────────────────────────────────

export function WalletDeploy({
  projectId,
  abi,
  bytecode,
  network,
  onDeployed,
  onClose,
}: WalletDeployProps) {
  const [step, setStep] = useState<DeployStep>("connect");
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState(network);

  const config = MAINNET_CONFIGS[selectedNetwork] || MAINNET_CONFIGS.polygon;

  // ── Check MetaMask ────────────────────────────────────────────────

  const hasMetaMask =
    typeof window !== "undefined" &&
    typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";

  // ── Connect Wallet ────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    setError(null);
    const eth = (window as unknown as { ethereum: EthereumProvider }).ethereum;
    if (!eth) {
      setError("MetaMask no detectado. Instalalo desde metamask.io");
      return;
    }

    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        setError("No se obtuvo ninguna cuenta de MetaMask");
        return;
      }
      setWalletAddress(accounts[0]);
      setStep("chain-switch");

      // Auto-proceed to chain switch
      await switchChain(eth, accounts[0]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar wallet"
      );
    }
  }, [selectedNetwork]);

  // ── Switch Chain ──────────────────────────────────────────────────

  async function switchChain(eth: EthereumProvider, account: string) {
    setError(null);
    const targetChainHex = toHexChainId(config.chainId);

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainHex }],
      });
    } catch (switchErr: unknown) {
      // Chain not added — try to add it
      if ((switchErr as { code?: number }).code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainHex,
                chainName: config.name,
                rpcUrls: [config.rpc],
                nativeCurrency: config.nativeCurrency,
                blockExplorerUrls: [config.explorer],
              },
            ],
          });
        } catch (addErr) {
          setError(
            `No se pudo agregar ${config.name} a MetaMask: ${
              addErr instanceof Error ? addErr.message : "Error"
            }`
          );
          setStep("error");
          return;
        }
      } else {
        setError(
          `No se pudo cambiar a ${config.name}: ${
            switchErr instanceof Error ? switchErr.message : "Error"
          }`
        );
        setStep("error");
        return;
      }
    }

    // Get balance
    try {
      const balHex = (await eth.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      })) as string;
      const balWei = BigInt(balHex);
      const balEth =
        Number(balWei) / 1e18;
      setBalance(balEth.toFixed(6) + " " + config.currency);
    } catch {
      setBalance("desconocido");
    }

    setStep("gas-estimate");
    await estimateGas(eth, account);
  }

  // ── Estimate Gas ──────────────────────────────────────────────────

  async function estimateGas(eth: EthereumProvider, account: string) {
    setError(null);

    try {
      // Build the deploy transaction data
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const factory = new ethers.ContractFactory(
        abi as any,
        bytecode,
        signer
      );

      const constructorArgs = getConstructorArgs(abi, account);
      const deployTx = await factory.getDeployTransaction(...constructorArgs);
      const gasLimit = await provider.estimateGas({
        ...deployTx,
        from: account,
      });

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const totalCost = gasLimit * gasPrice;
      const costEth = Number(totalCost) / 1e18;

      setGasEstimate(
        `~${costEth.toFixed(6)} ${config.currency} (${gasLimit.toString()} gas)`
      );
      setStep("confirm");
    } catch (err) {
      setError(
        `Error estimando gas: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
      setStep("error");
    }
  }

  // ── Deploy ────────────────────────────────────────────────────────

  async function executeDeploy() {
    setStep("deploying");
    setError(null);

    const eth = (window as unknown as { ethereum: EthereumProvider }).ethereum;

    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const signerAddr = await signer.getAddress();

      const factory = new ethers.ContractFactory(
        abi as any,
        bytecode,
        signer
      );

      const constructorArgs = getConstructorArgs(abi, signerAddr);
      const contract = await factory.deploy(...constructorArgs);

      const deployTx = contract.deploymentTransaction()!;
      setTxHash(deployTx.hash);

      // Wait for confirmation
      await deployTx.wait(1);

      const addr = await contract.getAddress();
      setContractAddress(addr);
      setStep("success");

      // Save to server
      try {
        await fetch("/api/forge/deploy-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            address: addr,
            txHash: deployTx.hash,
            network: config.name,
            chainId: config.chainId,
          }),
        });
      } catch {
        // Non-critical — deploy succeeded on-chain
      }

      onDeployed({
        address: addr,
        txHash: deployTx.hash,
        network: config.name,
        chainId: config.chainId,
        explorer: `${config.explorer}/address/${addr}`,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("rejected") || err.message.includes("denied"))
      ) {
        setError("Transaccion rechazada por el usuario");
      } else {
        setError(
          err instanceof Error ? err.message : "Error al deployar contrato"
        );
      }
      setStep("error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  const stepIndex = ["connect", "chain-switch", "gas-estimate", "confirm", "deploying", "success"].indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Deploy a Mainnet</h2>
              <p className="text-[11px] text-muted-foreground">Con tu wallet de MetaMask</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Selector */}
        <div className="px-5 py-3 border-b border-border/50 bg-muted/30">
          <label className="text-[10px] text-muted-foreground block mb-1.5">Red de destino</label>
          <div className="relative">
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              disabled={step !== "connect"}
              className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground pr-8 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            >
              {Object.entries(MAINNET_CONFIGS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.name} ({cfg.currency})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Steps Progress */}
        <div className="px-5 py-3 border-b border-border/50 space-y-0.5">
          <StepRow
            icon={<Wallet className="w-3 h-3" />}
            label="Conectar wallet"
            active={step === "connect"}
            done={stepIndex > 0}
          />
          <StepRow
            icon={<CircleDot className="w-3 h-3" />}
            label={`Cambiar red a ${config.name}`}
            active={step === "chain-switch"}
            done={stepIndex > 1}
          />
          <StepRow
            icon={<Fuel className="w-3 h-3" />}
            label="Estimar gas"
            active={step === "gas-estimate"}
            done={stepIndex > 2}
          />
          <StepRow
            icon={<ArrowUpRight className="w-3 h-3" />}
            label="Deploy"
            active={step === "deploying"}
            done={step === "success"}
          />
        </div>

        {/* Info / Status Area */}
        <div className="px-5 py-4 min-h-[100px]">
          {/* Wallet info */}
          {walletAddress && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Wallet:</span>
              <code className="text-foreground font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </code>
            </div>
          )}
          {balance && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Balance:</span>
              <span className="text-foreground font-medium">{balance}</span>
            </div>
          )}
          {gasEstimate && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Costo estimado:</span>
              <span className="text-amber-400 font-medium">{gasEstimate}</span>
            </div>
          )}
          {txHash && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">TX:</span>
              <a
                href={`${config.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-mono hover:text-emerald-300 flex items-center gap-1"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {contractAddress && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Contrato:</span>
              <a
                href={`${config.explorer}/address/${contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-mono hover:text-emerald-300 flex items-center gap-1"
              >
                {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Warning for mainnet */}
          {step === "confirm" && (
            <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300/90">
                  <p className="font-semibold mb-1">Atencion: Deploy a mainnet</p>
                  <p>
                    Esta transaccion usa fondos reales de tu wallet. Verifica que el contrato sea correcto antes de
                    confirmar. Esta accion no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-300/90">
                  <p className="font-semibold">Contrato deployado en {config.name}!</p>
                  <p className="mt-1">Tu token esta ahora en mainnet y visible para todo el mundo.</p>
                </div>
              </div>
            </div>
          )}

          {/* Deploying message */}
          {step === "deploying" && !error && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Esperando confirmacion en MetaMask y en la red...
            </div>
          )}

          {/* No MetaMask */}
          {!hasMetaMask && step === "connect" && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300/90">
                  <p className="font-semibold mb-1">MetaMask no detectado</p>
                  <p>
                    Necesitas MetaMask instalado en tu navegador para deployar a mainnet.{" "}
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-amber-200"
                    >
                      Descargar MetaMask
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/30">
          {step === "connect" && (
            <button
              onClick={connectWallet}
              disabled={!hasMetaMask}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Conectar MetaMask
            </button>
          )}

          {step === "confirm" && (
            <button
              onClick={executeDeploy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Confirmar Deploy
            </button>
          )}

          {step === "error" && (
            <button
              onClick={() => {
                setError(null);
                setStep("connect");
                setWalletAddress(null);
                setBalance(null);
                setGasEstimate(null);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-amber-500 transition-colors"
            >
              Reintentar
            </button>
          )}

          {step === "success" && (
            <button
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Cerrar
            </button>
          )}

          {step !== "success" && (
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Type for window.ethereum ─────────────────────────────────────────────────

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
}
