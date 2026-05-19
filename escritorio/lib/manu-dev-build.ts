import { exec } from "child_process";
import { promisify } from "util";
import getPool from "@/lib/db-manu";

const execAsync = promisify(exec);
const BUILD_SCRIPT = "/opt/docker-apps/scripts/manu-dev-build.sh";

const BUILD_TIMEOUT_MS = Number(process.env.MANU_DEV_BUILD_TIMEOUT_MS || 480000);
const STUCK_BUILD_MINUTES = Number(process.env.MANU_DEV_STUCK_BUILD_MINUTES || 45);

let buildColumnsEnsured = false;
let lastReconcileAt = 0;
let queueTail: Promise<unknown> = Promise.resolve();
let queuedJobs = 0;

export function getBuildTimeoutMs(): number {
  return Number.isFinite(BUILD_TIMEOUT_MS) && BUILD_TIMEOUT_MS > 0
    ? BUILD_TIMEOUT_MS
    : 480000;
}

async function ensureBuildColumns() {
  if (buildColumnsEnsured) return;

  const pool = getPool();
  const statements = [
    "ALTER TABLE md_projects ADD COLUMN build_started_at DATETIME DEFAULT NULL",
    "ALTER TABLE md_projects ADD COLUMN build_finished_at DATETIME DEFAULT NULL",
    "ALTER TABLE md_projects ADD COLUMN last_build_error TEXT DEFAULT NULL",
    "ALTER TABLE md_projects ADD COLUMN last_build_stage VARCHAR(80) DEFAULT NULL",
  ];

  for (const sql of statements) {
    try {
      await pool.execute(sql);
    } catch {
      // Column may already exist.
    }
  }

  buildColumnsEnsured = true;
}

export async function reconcileStuckBuilds() {
  const now = Date.now();
  if (now - lastReconcileAt < 30000) return;

  const minutes = Number.isFinite(STUCK_BUILD_MINUTES) && STUCK_BUILD_MINUTES > 5
    ? Math.floor(STUCK_BUILD_MINUTES)
    : 45;

  const pool = getPool();
  await pool.execute(
    `UPDATE md_projects
       SET status = 'error',
           last_build_stage = 'reconciled-timeout',
           build_finished_at = NOW(),
           last_build_error = COALESCE(last_build_error, 'Build reconciliado por timeout operativo')
     WHERE status = 'building'
       AND build_started_at IS NOT NULL
       AND TIMESTAMPDIFF(MINUTE, build_started_at, NOW()) >= ?`,
    [minutes]
  );

  lastReconcileAt = now;
}

export async function prepareBuildInfra() {
  await ensureBuildColumns();
  await reconcileStuckBuilds();
}

export async function markBuildQueued(projectId: number, stage = "queued") {
  const pool = getPool();
  await pool.execute(
    "UPDATE md_projects SET status = 'building', last_build_stage = ?, build_finished_at = NULL, last_build_error = NULL WHERE id = ?",
    [stage, projectId]
  );
}

export async function markBuildStarted(projectId: number) {
  const pool = getPool();
  await pool.execute(
    "UPDATE md_projects SET status = 'building', last_build_stage = 'building', build_started_at = NOW(), build_finished_at = NULL, last_build_error = NULL WHERE id = ?",
    [projectId]
  );
}

export async function markBuildFailed(projectId: number, stage: string, errorMessage: string) {
  const pool = getPool();
  await pool.execute(
    "UPDATE md_projects SET status = 'error', last_build_stage = ?, build_finished_at = NOW(), last_build_error = ? WHERE id = ?",
    [stage, errorMessage.slice(0, 4000), projectId]
  );
}

export async function markBuildSuccess(
  projectId: number,
  containerId: string,
  siteUrl?: string
) {
  const pool = getPool();
  if (siteUrl) {
    await pool.execute(
      "UPDATE md_projects SET status = 'active', container_id = ?, site_url = ?, last_build_stage = 'active', build_finished_at = NOW(), last_build_error = NULL WHERE id = ?",
      [containerId, siteUrl, projectId]
    );
    return;
  }

  await pool.execute(
    "UPDATE md_projects SET status = 'active', container_id = ?, last_build_stage = 'active', build_finished_at = NOW(), last_build_error = NULL WHERE id = ?",
    [containerId, projectId]
  );
}

export function queueBuild(options: {
  subdomain: string;
  projectId: number;
  mode?: "next" | "lite";
  onStart?: () => void | Promise<void>;
}) {
  const { subdomain, projectId, mode = "next", onStart } = options;
  const queuePosition = queuedJobs + 1;
  queuedJobs += 1;

  const execute = async () => {
    try {
      await markBuildStarted(projectId);
      if (onStart) await onStart();
      const { stdout } = await execAsync(`sh ${BUILD_SCRIPT} ${subdomain} ${mode}`, {
        timeout: getBuildTimeoutMs(),
      });
      const containerId = stdout.trim().split("\n").pop() || "";
      if (!containerId) {
        throw new Error("build_no_container_id");
      }
      return { stdout, containerId };
    } catch (err: any) {
      const stage = String(err?.message || "").toLowerCase().includes("timeout")
        ? "build-timeout"
        : "build-failed";
      const detail = String(err?.stderr || err?.message || "Error de build").slice(0, 1400);
      await markBuildFailed(projectId, stage, detail);
      throw err;
    }
  };

  const run = queueTail.then(execute, execute);
  queueTail = run.catch((err) => {
    console.error(`[manu-dev-build] queue error for ${subdomain}:`, err?.message || err);
  });

  const wrapped = run.finally(() => {
    queuedJobs = Math.max(0, queuedJobs - 1);
  });

  return {
    queuePosition,
    run: wrapped,
  };
}
