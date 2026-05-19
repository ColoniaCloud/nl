/**
 * Forge DB — queries against fg_* tables (manu_dev database)
 */
import getPool from "@/lib/db-manu";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FgProject = {
  id: number;
  user_id: number;
  name: string | null;
  asset_type: string;
  asset_description: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_standard: "ERC-20" | "ERC-721" | "ERC-1155";
  total_supply: string | null;
  decimals: number;
  network: string;
  features: Record<string, boolean> | null;
  status: "draft" | "generating" | "compiled" | "deployed_testnet" | "deployed_mainnet";
  contract_address: string | null;
  testnet_address: string | null;
  deploy_tx_hash: string | null;
  mainnet_tx_hash: string | null;
  mainnet_network: string | null;
  testnet_network: string | null;
  verified: boolean;
  verified_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FgContract = {
  id: number;
  project_id: number;
  source_code: string | null;
  abi: unknown[] | null;
  bytecode: string | null;
  compiler_version: string | null;
  compiled_at: string | null;
};

export type FgChatMessage = {
  id: number;
  user_id: number;
  project_id: number | null;
  role: string;
  content: string;
  step: string | null;
  created_at: string;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectsByUser(userId: number): Promise<FgProject[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM fg_projects WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  const list = rows as FgProject[];
  return list.map((r) => ({
    ...r,
    features: typeof r.features === "string" ? JSON.parse(r.features) : r.features,
  }));
}

export async function getProjectById(id: number, userId: number): Promise<FgProject | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM fg_projects WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  const list = rows as FgProject[];
  if (!list[0]) return null;
  const r = list[0];
  return {
    ...r,
    features: typeof r.features === "string" ? JSON.parse(r.features) : r.features,
  };
}

export async function createProject(data: {
  user_id: number;
  name: string;
  asset_type?: string;
  asset_description?: string;
  token_name?: string;
  token_symbol?: string;
  token_standard?: string;
  total_supply?: string;
  decimals?: number;
  network?: string;
  features?: Record<string, boolean>;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO fg_projects
      (user_id, name, asset_type, asset_description, token_name, token_symbol, token_standard, total_supply, decimals, network, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.name,
      data.asset_type ?? "other",
      data.asset_description ?? null,
      data.token_name ?? null,
      data.token_symbol ?? null,
      data.token_standard ?? "ERC-20",
      data.total_supply ?? null,
      data.decimals ?? 18,
      data.network ?? "polygon",
      data.features ? JSON.stringify(data.features) : null,
    ]
  );
  return (result as { insertId: number }).insertId;
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<Omit<FgProject, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(k === "features" && typeof v === "object" ? JSON.stringify(v) : v);
  }
  if (fields.length === 0) return;
  values.push(id, userId);
  await pool.execute(
    `UPDATE fg_projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    values as any
  );
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export async function getAllDeployedProjects(): Promise<FgProject[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM fg_projects
     WHERE status IN ('deployed_testnet', 'deployed_mainnet')
     ORDER BY updated_at DESC`
  );
  const list = rows as FgProject[];
  return list.map((r) => ({
    ...r,
    features: typeof r.features === "string" ? JSON.parse(r.features) : r.features,
  }));
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function getContract(projectId: number): Promise<FgContract | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM fg_contracts WHERE project_id = ? ORDER BY id DESC LIMIT 1",
    [projectId]
  );
  const list = rows as FgContract[];
  if (!list[0]) return null;
  const r = list[0];
  return {
    ...r,
    abi: typeof r.abi === "string" ? JSON.parse(r.abi) : r.abi,
  };
}

export async function saveContract(data: {
  project_id: number;
  source_code: string;
  abi: unknown[];
  bytecode: string;
  compiler_version: string;
}) {
  const pool = getPool();
  // Delete old contracts for this project
  await pool.execute("DELETE FROM fg_contracts WHERE project_id = ?", [data.project_id]);
  await pool.execute(
    `INSERT INTO fg_contracts (project_id, source_code, abi, bytecode, compiler_version, compiled_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      data.project_id,
      data.source_code,
      JSON.stringify(data.abi),
      data.bytecode,
      data.compiler_version.slice(0, 100),
    ]
  );
}

// ─── Chat History ─────────────────────────────────────────────────────────────

export async function getChatHistory(
  userId: number,
  projectId: number | null,
  limit = 30
): Promise<FgChatMessage[]> {
  const pool = getPool();
  const lim = String(limit);
  if (projectId) {
    const [rows] = await pool.query(
      `SELECT * FROM fg_chat_history WHERE user_id = ? AND project_id = ? ORDER BY id DESC LIMIT ${Number(limit)}`,
      [userId, projectId]
    );
    return (rows as FgChatMessage[]).reverse();
  }
  const [rows] = await pool.query(
    `SELECT * FROM fg_chat_history WHERE user_id = ? AND project_id IS NULL ORDER BY id DESC LIMIT ${Number(limit)}`,
    [userId]
  );
  return (rows as FgChatMessage[]).reverse();
}

export async function saveChatMessage(
  userId: number,
  role: string,
  content: string,
  step: string,
  projectId?: number | null
) {
  const pool = getPool();
  await pool.execute(
    "INSERT INTO fg_chat_history (user_id, project_id, role, content, step) VALUES (?, ?, ?, ?, ?)",
    [userId, projectId ?? null, role, content, step]
  );
}
