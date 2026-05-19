/**
 * Forge Deployer — deploys compiled contracts to testnets using ethers.js
 */
import { ethers } from "ethers";

// ─── Testnet Configuration ───────────────────────────────────────────────────

export interface TestnetConfig {
  rpc: string;
  chainId: number;
  name: string;
  explorer: string;
  explorerApi: string;
  apiKeyEnv: string;
  currency: string;
}

export const TESTNET_CONFIG: Record<string, TestnetConfig> = {
  polygon: {
    rpc: "https://polygon-amoy-bor-rpc.publicnode.com",
    chainId: 80002,
    name: "Polygon Amoy",
    explorer: "https://amoy.polygonscan.com",
    explorerApi: "https://api.etherscan.io/v2/api?chainid=80002",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    currency: "MATIC",
  },
  ethereum: {
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    chainId: 11155111,
    name: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
    explorerApi: "https://api.etherscan.io/v2/api?chainid=11155111",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    currency: "ETH",
  },
  base: {
    rpc: "https://sepolia.base.org",
    chainId: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    explorerApi: "https://api.etherscan.io/v2/api?chainid=84532",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    currency: "ETH",
  },
  arbitrum: {
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    explorer: "https://sepolia.arbiscan.io",
    explorerApi: "https://api.etherscan.io/v2/api?chainid=421614",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    currency: "ETH",
  },
};

// ─── Mainnet Configuration ────────────────────────────────────────────────────

export interface MainnetConfig {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  currency: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const MAINNET_CONFIG: Record<string, MainnetConfig> = {
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

// ─── Deploy Result ────────────────────────────────────────────────────────────

export interface DeployResult {
  address: string;
  txHash: string;
  network: string;
  chainId: number;
  explorer: string;
  explorerTx: string;
  deployer: string;
  gasUsed: string;
}

// ─── Deploy to Testnet ────────────────────────────────────────────────────────

export async function deployToTestnet(
  abi: unknown[],
  bytecode: string,
  network: string
): Promise<DeployResult> {
  const config = TESTNET_CONFIG[network];
  if (!config) {
    throw new Error(`Red no soportada para testnet: ${network}. Disponibles: ${Object.keys(TESTNET_CONFIG).join(", ")}`);
  }

  const privateKey = process.env.FORGE_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FORGE_DEPLOYER_PRIVATE_KEY no configurada. Contacta al administrador.");
  }

  const provider = new ethers.JsonRpcProvider(config.rpc, {
    chainId: config.chainId,
    name: config.name,
  }, { staticNetwork: true });

  const wallet = new ethers.Wallet(privateKey, provider);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  if (balance === BigInt(0)) {
    throw new Error(
      `La wallet deployer (${wallet.address}) no tiene fondos en ${config.name}. ` +
      `Necesita ${config.currency} de testnet. Usa un faucet para obtenerlos.`
    );
  }

  // Deploy
  const factory = new ethers.ContractFactory(abi as ethers.InterfaceAbi, bytecode, wallet);

  // Detect constructor arguments from ABI and provide defaults
  const constructorArgs = getConstructorArgs(abi, wallet.address);

  const contract = await factory.deploy(...constructorArgs);
  const receipt = await contract.deploymentTransaction()!.wait(1);

  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()!.hash;

  return {
    address,
    txHash,
    network: config.name,
    chainId: config.chainId,
    explorer: `${config.explorer}/address/${address}`,
    explorerTx: `${config.explorer}/tx/${txHash}`,
    deployer: wallet.address,
    gasUsed: (receipt?.gasUsed ?? BigInt(0)).toString(),
  };
}

// ─── Constructor Argument Detection ───────────────────────────────────────────

function getConstructorArgs(abi: unknown[], deployerAddress: string): unknown[] {
  const abiArray = abi as Array<{ type?: string; inputs?: Array<{ name: string; type: string }> }>;
  const constructor = abiArray.find((item) => item.type === "constructor");
  if (!constructor?.inputs || constructor.inputs.length === 0) return [];

  return constructor.inputs.map((input) => {
    // address params (initialOwner, owner, admin, etc.) → deployer address
    if (input.type === "address") return deployerAddress;
    // string params → empty string
    if (input.type === "string") return "";
    // uint/int params → 0
    if (input.type.startsWith("uint") || input.type.startsWith("int")) return 0;
    // bool → false
    if (input.type === "bool") return false;
    // bytes → empty
    if (input.type.startsWith("bytes")) return "0x";
    // fallback
    return deployerAddress;
  });
}

// ─── Check Deployer Balance ───────────────────────────────────────────────────

export async function getDeployerBalance(network: string): Promise<{ address: string; balance: string; currency: string }> {
  const config = TESTNET_CONFIG[network];
  if (!config) throw new Error(`Red no soportada: ${network}`);

  const privateKey = process.env.FORGE_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("FORGE_DEPLOYER_PRIVATE_KEY no configurada");

  const provider = new ethers.JsonRpcProvider(config.rpc, {
    chainId: config.chainId,
    name: config.name,
  }, { staticNetwork: true });
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  return {
    address: wallet.address,
    balance: ethers.formatEther(balance),
    currency: config.currency,
  };
}
