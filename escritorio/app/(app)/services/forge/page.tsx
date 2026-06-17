"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faCheck,
  faBars,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { ArrowUpRight, Wallet, Layers } from "lucide-react";
import { AGENT_META } from "@/lib/agent-colors";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

// Icono representativo de Forge (fuente unica: AGENT_META)
const ForgeIcon = AGENT_META.forge.icon;
import { ChatBubble } from "@/components/chat/ChatBubble";
import AgentInput from "@/components/chat/AgentInput";
import VoiceMicButton from "@/components/chat/VoiceMicButton";
import {
  StandardPicker,
  NetworkPicker,
  FeaturePicker,
  ContractViewer,
} from "@/components/forge/ForgeVisuals";
import { TokenDashboard } from "@/components/forge/TokenDashboard";
import { WalletDeploy } from "@/components/forge/WalletDeploy";
import { TokenAnalytics } from "@/components/forge/TokenAnalytics";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  standardPicker?: string[];
  networkOptions?: Array<{ name: string; id: string; gas: string; desc: string }>;
  featureOptions?: Array<{ id: string; label: string; desc: string }>;
  forgeReady?: boolean;
}

type Step = "welcome" | "onboarding" | "generating" | "compiled" | "deployed";

interface ContractData {
  sourceCode: string;
  abi: unknown[];
  bytecode: string;
  compilerVersion: string;
  warnings?: string[];
}

interface DeployData {
  address: string;
  txHash: string;
  network: string;
  chainId: number;
  explorer: string;
  explorerTx: string;
  deployer: string;
  gasUsed: string;
  verified: boolean;
  verifiedUrl: string | null;
  testnetNetwork: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  welcome: "Inicio",
  onboarding: "Configuracion",
  generating: "Generando",
  compiled: "Compilado",
  deployed: "Deployado",
};

const STEPS_FLOW: Step[] = ["welcome", "onboarding", "generating", "compiled", "deployed"];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS_FLOW.indexOf(current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {STEPS_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div
              className={[
                "flex items-center gap-1 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-xxs font-medium whitespace-nowrap",
                done
                  ? "bg-muted text-muted-foreground"
                  : active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground/40",
              ].join(" ")}
            >
              {done && <FontAwesomeIcon icon={faCheck} className="text-[9px]" />}
              {STEP_LABELS[s]}
            </div>
            {i < STEPS_FLOW.length - 1 && (
              <div className={`w-3 h-px mx-0.5 flex-shrink-0 ${done ? "bg-muted-foreground/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Explorer URL helpers ─────────────────────────────────────────────────────

const TESTNET_EXPLORERS: Record<string, string> = {
  polygon: "https://amoy.polygonscan.com",
  ethereum: "https://sepolia.etherscan.io",
  base: "https://sepolia.basescan.org",
  arbitrum: "https://sepolia.arbiscan.io",
};

function getExplorerUrl(network: string, address: string) {
  const base = TESTNET_EXPLORERS[network] || TESTNET_EXPLORERS.polygon;
  return `${base}/address/${address}`;
}

function getExplorerTxUrl(network: string, txHash: string) {
  const base = TESTNET_EXPLORERS[network] || TESTNET_EXPLORERS.polygon;
  return `${base}/tx/${txHash}`;
}

// ─── Inner Page ───────────────────────────────────────────────────────────────

function ForgePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const { isMobile, setOpenMobile } = useSidebar();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendBtnPressed, setSendBtnPressed] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [projectId, setProjectId] = useState<number | null>(
    projectParam ? Number(projectParam) : null
  );
  const [compiling, setCompiling] = useState(false);
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [pendingCompile, setPendingCompile] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployData, setDeployData] = useState<DeployData | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [showWalletDeploy, setShowWalletDeploy] = useState(false);
  const [mainnetData, setMainnetData] = useState<{ address: string; txHash: string; network: string; chainId: number; explorer: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const isBlocked = sending || compiling || deploying;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing project if URL has ?project=N
  useEffect(() => {
    if (!projectParam) return;
    const pid = Number(projectParam);
    if (!pid) return;
    setProjectId(pid);

    // Try to load compiled contract first
    fetch(`/api/forge/download?project_id=${pid}`)
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          if (data?.contract?.source_code) {
            setContractData({
              sourceCode: data.contract.source_code,
              abi: data.contract.abi,
              bytecode: data.contract.bytecode,
              compilerVersion: data.contract.compiler_version || "unknown",
            });

            // Check if already deployed
            const projRes = await fetch(`/api/forge/projects`);
            if (projRes.ok) {
              const projData = await projRes.json();
              const proj = (projData.projects || projData)?.find?.((p: any) => p.id === pid);
              if (proj?.testnet_address) {
                setDeployData({
                  address: proj.testnet_address,
                  txHash: proj.deploy_tx_hash || "",
                  network: proj.network,
                  chainId: 0,
                  explorer: getExplorerUrl(proj.network, proj.testnet_address),
                  explorerTx: proj.deploy_tx_hash ? getExplorerTxUrl(proj.network, proj.deploy_tx_hash) : "",
                  deployer: process.env.NEXT_PUBLIC_FORGE_DEPLOYER || "",
                  gasUsed: "",
                  verified: !!proj.verified,
                  verifiedUrl: proj.verified_url,
                  testnetNetwork: proj.testnet_network || proj.network,
                });
                setStep("deployed");

                // Check for mainnet deploy
                if (proj.contract_address) {
                  const mnExplorer = {
                    polygon: "https://polygonscan.com",
                    ethereum: "https://etherscan.io",
                    base: "https://basescan.org",
                    arbitrum: "https://arbiscan.io",
                  }[proj.network as string] || "https://polygonscan.com";
                  setMainnetData({
                    address: proj.contract_address,
                    txHash: proj.mainnet_tx_hash || "",
                    network: proj.mainnet_network || proj.network,
                    chainId: 0,
                    explorer: `${mnExplorer}/address/${proj.contract_address}`,
                  });
                }

                setMessages([
                  {
                    id: uid(),
                    role: "assistant",
                    content: `**${data.project.token_name} (${data.project.token_symbol})** — deployado${proj.contract_address ? " en testnet y mainnet" : " en testnet"}.\n\nPodes ver el dashboard del token abajo.`,
                  },
                ]);
                return;
              }
            }

            setStep("compiled");
            setMessages([
              {
                id: uid(),
                role: "assistant",
                content: `**${data.project.token_name} (${data.project.token_symbol})** — contrato compilado.\n\nPodes revisar el codigo, deployarlo a testnet, o descargarlo abajo.`,
              },
            ]);
            return;
          }
        }
        // No contract yet — show retry/compile button
        setPendingCompile(true);
        setStep("generating");
        setMessages([
          {
            id: uid(),
            role: "assistant",
            content: "Retomando tu proyecto. El contrato aun no fue compilado. Presiona el boton de abajo para generarlo.",
          },
        ]);
      })
      .catch(() => {
        setPendingCompile(true);
        setStep("generating");
        setMessages([
          {
            id: uid(),
            role: "assistant",
            content: "Retomando tu proyecto. Presiona el boton para compilar el contrato.",
          },
        ]);
      });
  }, [projectParam]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0 && step === "welcome" && !projectParam) {
      setMessages([
        {
          id: uid(),
          role: "assistant",
          content:
            "Bienvenido a **Forge**, el constructor de tokens en blockchain.\n\nAca podes tokenizar cualquier activo real — un terreno, un vehiculo, una obra de arte, acciones de una empresa, o lo que necesites.\n\nTe voy a guiar paso a paso para crear tu smart contract, compilarlo y dejarlo listo para deployar.\n\nContame, **que activo queres tokenizar?**",
        },
      ]);
      setStep("onboarding");
    }
  }, [messages.length, step, projectParam]);

  // ─── Send message ───────────────────────────────────────────────────

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: uid(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/forge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, project_id: projectId, step }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.error || "Error en el servidor", streaming: false }
              : m
          )
        );
        setSending(false);
        return;
      }

      // Update project ID if new
      if (data.project_id && !projectId) {
        setProjectId(data.project_id);
        router.replace(`/services/forge?project=${data.project_id}`, { scroll: false });
      }

      // Build the message with visuals
      const updatedMsg: Partial<Message> = {
        content: data.response,
        streaming: false,
      };

      if (data.visuals?.standardPicker) updatedMsg.standardPicker = data.visuals.standardPicker;
      if (data.visuals?.networkOptions) updatedMsg.networkOptions = data.visuals.networkOptions;
      if (data.visuals?.featureOptions) updatedMsg.featureOptions = data.visuals.featureOptions;

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...updatedMsg } : m))
      );

      // If ready, trigger compilation
      if (data.visuals?.forgeReady) {
        const pid = data.visuals.projectId || data.project_id;
        setProjectId(pid);
        setStep("generating");
        triggerCompile(pid);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Error de conexion. Intenta de nuevo.", streaming: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  // ─── Compile ────────────────────────────────────────────────────────

  async function triggerCompile(pid: number) {
    setCompiling(true);
    setCompileError(null);
    setPendingCompile(false);

    const compilingId = uid();
    setMessages((prev) => [
      ...prev,
      {
        id: compilingId,
        role: "assistant",
        content: "Generando el smart contract con Claude y compilando con Solidity...",
        streaming: true,
      },
    ]);

    try {
      const res = await fetch("/api/forge/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: pid }),
      });
      const data = await res.json();

      if (!res.ok) {
        let errorMsg = "**Error generando el contrato**\n\n";
        if (data.details && Array.isArray(data.details)) {
          errorMsg += "Errores de compilacion Solidity:\n\n```\n" + data.details.join("\n") + "\n```";
        } else if (data.details && typeof data.details === "string") {
          errorMsg += "Detalle: `" + data.details + "`";
        } else {
          errorMsg += (data.error || "Error desconocido");
        }
        if (data.stack) {
          errorMsg += "\n\n<details>\n<summary>Stack trace</summary>\n\n```\n" + data.stack + "\n```\n</details>";
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === compilingId ? { ...m, content: errorMsg, streaming: false } : m
          )
        );
        setCompileError(errorMsg);
        setStep("generating");
      } else {
        setContractData({
          sourceCode: data.sourceCode,
          abi: data.abi,
          bytecode: data.bytecode,
          compilerVersion: data.compilerVersion,
          warnings: data.warnings,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === compilingId
              ? {
                  ...m,
                  content:
                    "**Contrato generado y compilado exitosamente.**\n\nEl codigo Solidity, el ABI y el bytecode estan listos. Podes revisarlos abajo, copiarlos, o descargar el paquete completo con instrucciones de deploy.",
                  streaming: false,
                }
              : m
          )
        );
        setStep("compiled");
      }
    } catch (err) {
      const catchMsg = "**Error de conexion al compilar**\n\n" +
        (err instanceof Error ? "`" + err.message + "`" : "Error desconocido");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === compilingId
            ? { ...m, content: catchMsg, streaming: false }
            : m
        )
      );
      setCompileError(catchMsg);
      setStep("generating");
    } finally {
      setCompiling(false);
    }
  }

  // ─── Visual picker handlers ─────────────────────────────────────────

  function handleStandardSelect(standard: string) {
    send(`Elijo ${standard}`);
  }

  function handleNetworkSelect(networkId: string) {
    send(`Elijo la red ${networkId}`);
  }

  function handleFeaturesSelect(features: string[]) {
    send(`Quiero estas features: ${features.join(", ")}`);
  }

  // ─── Deploy to testnet ──────────────────────────────────────────────

  async function triggerDeploy(pid: number) {
    setDeploying(true);
    setDeployError(null);

    const deployingId = uid();
    setMessages((prev) => [
      ...prev,
      {
        id: deployingId,
        role: "assistant",
        content: "Deployando contrato a testnet... Esto puede tardar unos segundos.",
        streaming: true,
      },
    ]);

    try {
      const res = await fetch("/api/forge/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: pid }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        const errMsg = `HTTP ${res.status}: ${text || res.statusText}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === deployingId
              ? { ...m, content: `**Error en deploy**\n\n\`\`\`\n${errMsg}\n\`\`\``, streaming: false }
              : m
          )
        );
        setDeployError(errMsg);
        return;
      }

      if (!res.ok) {
        const errDetail = typeof data === "object"
          ? JSON.stringify(data, null, 2)
          : String(data);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === deployingId
              ? { ...m, content: `**Error en deploy (${res.status})**\n\n\`\`\`\n${errDetail}\n\`\`\``, streaming: false }
              : m
          )
        );
        setDeployError(data?.error || errDetail);
        return;
      }

      const dd: DeployData = {
        address: data.address,
        txHash: data.txHash,
        network: data.network,
        chainId: data.chainId,
        explorer: data.explorer,
        explorerTx: data.explorerTx,
        deployer: data.deployer,
        gasUsed: data.gasUsed,
        verified: false,
        verifiedUrl: null,
        testnetNetwork: data.network,
      };
      setDeployData(dd);
      setStep("deployed");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === deployingId
            ? {
                ...m,
                content:
                  `**Contrato deployado exitosamente en ${data.network}!**\n\n` +
                  `Direccion: \`${data.address}\`\n\n` +
                  `Podes ver el dashboard del token abajo, verificarlo en el explorador, o interactuar con el.`,
                streaming: false,
              }
            : m
        )
      );
    } catch (err) {
      const errMsg = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === deployingId
            ? { ...m, content: `**Error de conexion al deployar**\n\n\`\`\`\n${errMsg}\n\`\`\``, streaming: false }
            : m
        )
      );
      setDeployError(errMsg);
    } finally {
      setDeploying(false);
    }
  }

  // ─── Key + submit handlers ──────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSendBtnPressed(true);
    setTimeout(() => setSendBtnPressed(false), 150);
    send();
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-3 sm:px-4 py-2.5 flex-shrink-0">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setOpenMobile(true)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  title="Abrir menu"
                >
                  <FontAwesomeIcon icon={faBars} className="text-sm" />
                </button>
              )}
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                <ForgeIcon className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">Forge</span>
            </div>
            <Link
              href="/services/forge/marketplace"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marketplace</span>
            </Link>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="pointer-events-none sticky top-0 z-10 h-10 bg-gradient-to-b from-background to-transparent" />
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 pb-6 space-y-5 -mt-10 pt-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg}>
              {msg.standardPicker && (
                <StandardPicker options={msg.standardPicker} onSelect={handleStandardSelect} />
              )}
              {msg.networkOptions && (
                <NetworkPicker options={msg.networkOptions} onSelect={handleNetworkSelect} />
              )}
              {msg.featureOptions && (
                <FeaturePicker options={msg.featureOptions} onSelect={handleFeaturesSelect} />
              )}
            </ChatBubble>
          ))}

          {/* Contract viewer */}
          {contractData && projectId && (
            <ContractViewer
              sourceCode={contractData.sourceCode}
              abi={contractData.abi}
              bytecode={contractData.bytecode}
              compilerVersion={contractData.compilerVersion}
              warnings={contractData.warnings}
              projectId={projectId}
              network="polygon"
            />
          )}

          {/* Deploy buttons (after compiled, before deployed) */}
          {step === "compiled" && contractData && projectId && !deploying && (
            <div className="flex items-center justify-center gap-3 py-2 flex-wrap">
              <button
                onClick={() => triggerDeploy(projectId)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <ArrowUpRight className="w-4 h-4" />
                Deploy a Testnet
              </button>
              <button
                onClick={() => setShowWalletDeploy(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 text-emerald-400 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500/10 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                Deploy a Mainnet
              </button>
            </div>
          )}

          {/* Deploy error retry */}
          {deployError && projectId && !deploying && step === "compiled" && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => {
                  setDeployError(null);
                  triggerDeploy(projectId);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-amber-500 transition-colors"
              >
                <FontAwesomeIcon icon={faRotateRight} />
                Reintentar deploy
              </button>
            </div>
          )}

          {/* Token Dashboard (after deployed) */}
          {deployData && projectId && contractData && (
            <>
              <TokenDashboard
                projectId={projectId}
                deployInfo={deployData}
                abi={contractData.abi}
              />

              {/* Analytics */}
              <TokenAnalytics
                projectId={projectId}
                deployType={deployData.testnetNetwork ? "testnet" : "mainnet"}
                explorer={deployData.explorer.replace(/\/address\/.*/, "")}
                decimals={18}
                contractAddress={deployData.address}
              />

              {/* Deploy to mainnet button (if only on testnet) */}
              {step === "deployed" && !mainnetData && contractData && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => setShowWalletDeploy(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 text-emerald-400 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500/10 transition-colors"
                  >
                    <Wallet className="w-4 h-4" />
                    Deploy a Mainnet con MetaMask
                  </button>
                </div>
              )}

              {/* Mainnet info */}
              {mainnetData && (
                <div className="bg-muted/50 rounded-xl border border-emerald-500/20 overflow-hidden my-3">
                  <div className="px-4 py-3 border-b border-border bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-foreground">Mainnet Deploy</span>
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                        {mainnetData.network}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
                    <div className="bg-muted/30 px-4 py-3">
                      <div className="text-2xs text-muted-foreground mb-1">Contrato</div>
                      <a href={mainnetData.explorer} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 font-mono">
                        {mainnetData.address.slice(0, 10)}...{mainnetData.address.slice(-8)}
                      </a>
                    </div>
                    <div className="bg-muted/30 px-4 py-3">
                      <div className="text-2xs text-muted-foreground mb-1">TX Hash</div>
                      <code className="text-xs text-foreground font-mono">
                        {mainnetData.txHash.slice(0, 10)}...{mainnetData.txHash.slice(-8)}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Thinking indicator */}
          {sending && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <div className="flex justify-start">
              <div className="flex gap-1 px-1 py-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          {/* Compile / Retry button */}
          {(compileError || pendingCompile) && projectId && !compiling && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => {
                  setPendingCompile(false);
                  setCompileError(null);
                  triggerCompile(projectId);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors"
              >
                <FontAwesomeIcon icon={faRotateRight} />
                {compileError ? "Reintentar compilacion" : "Compilar contrato"}
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-background px-2 sm:px-4 pt-2 sm:pt-3 pb-5 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <AgentInput
            accent="emerald"
            value={input}
            onChange={setInput}
            onSend={send}
            sending={isBlocked}
            disabled={isBlocked}
            placeholder={
              step === "generating"
                ? "Generando contrato..."
                : step === "compiled"
                ? "Pedi cambios al contrato o pregunta lo que necesites..."
                : step === "deployed"
                ? "Pregunta sobre tu token deployado..."
                : "Describe tu activo o responde la pregunta..."
            }
            leftSlot={<VoiceMicButton accent="emerald" onText={setInput} disabled={isBlocked} />}
          />
        </div>
      </div>

      {/* MetaMask Deploy Modal */}
      {showWalletDeploy && projectId && contractData && (
        <WalletDeploy
          projectId={projectId}
          abi={contractData.abi}
          bytecode={contractData.bytecode}
          network="polygon"
          onDeployed={(data) => {
            setMainnetData(data);
            setShowWalletDeploy(false);
            const mid = Math.random().toString(36).slice(2);
            setMessages((prev) => [
              ...prev,
              {
                id: mid,
                role: "assistant",
                content:
                  `**Contrato deployado en ${data.network} (mainnet)!**\n\n` +
                  `Direccion: \`${data.address}\`\n\n` +
                  `[Ver en explorer](${data.explorer})`,
              },
            ]);
          }}
          onClose={() => setShowWalletDeploy(false)}
        />
      )}
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function ForgePage() {
  return (
    <Suspense>
      <ForgePageInner />
    </Suspense>
  );
}
