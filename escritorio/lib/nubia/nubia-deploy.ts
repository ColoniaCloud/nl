/**
 * Nubia Deploy — copies a pre-built template and injects store-config.json,
 * then queues the Docker build using the same infrastructure as Manu Dev.
 */
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import getPool from "@/lib/db-manu";
import type { NbProject, NbDesign, NbPaymentConfig } from "./db-nubia";
import { NL360_BASE_URL } from "./nubia-payments";

const execAsync = promisify(exec);

const TEMPLATES_DIR = "/opt/docker-apps/nubia-templates";
const SITES_DIR = "/opt/docker-apps/sites";
const BUILD_SCRIPT = "/opt/docker-apps/scripts/manu-dev-build.sh";
const BUILD_TIMEOUT_MS = Number(process.env.NUBIA_BUILD_TIMEOUT_MS || 480000);
const UNSPLASH_TIMEOUT_MS = 8000;

// ─── Unsplash integration ─────────────────────────────────────────────────────

export async function fetchUnsplashPhotos(
  query: string,
  count = 3
): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), UNSPLASH_TIMEOUT_MS);
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        signal: abort.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const photos = await res.json();
    return photos.map((p: any) => `${p.urls.regular}&w=1600&q=80`);
  } catch {
    return [];
  }
}

// ─── Store Config shape (injected into deployed site) ─────────────────────────

export interface StoreConfig {
  storeName: string;
  tagline: string;
  apiUrl: string;
  subdomain: string;
  theme?: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  images: { hero: string; collection: string; banner: string };
  payments: {
    bankTransfer: {
      enabled: boolean;
      details?: { bank?: string; account?: string; cbu?: string; alias?: string; holder?: string };
    };
    mercadopago: {
      enabled: boolean;
      publicKey?: string;
      country?: string;
      currency?: string;
    };
    coinbase: { enabled: boolean };
  };
  contact: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    location?: string;
  };
}

// ─── Build store-config.json from DB data ─────────────────────────────────────

export function buildStoreConfig(
  project: NbProject,
  design: NbDesign,
  paymentConfig: NbPaymentConfig | null,
  tagline: string,
  images?: { hero: string; collection: string; banner: string }
): StoreConfig {
  let bankDetails: StoreConfig["payments"]["bankTransfer"]["details"] = undefined;
  if (paymentConfig?.bank_transfer_details) {
    try {
      bankDetails = JSON.parse(paymentConfig.bank_transfer_details);
    } catch {
      bankDetails = undefined;
    }
  }

  return {
    storeName: project.name,
    tagline,
    apiUrl: NL360_BASE_URL,
    subdomain: project.subdomain,
    theme: project.template || "boutique",
    colors: {
      primary: design.primary_color,
      secondary: design.secondary_color,
      accent: design.accent_color,
    },
    fonts: {
      heading: design.font_heading,
      body: design.font_body,
    },
    images: images ?? {
      hero: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80",
      collection: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80",
      banner: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&q=80",
    },
    payments: {
      bankTransfer: {
        enabled: Boolean(paymentConfig?.bank_transfer_enabled),
        details: bankDetails,
      },
      mercadopago: {
        enabled: Boolean(paymentConfig?.mercadopago_enabled),
        publicKey: paymentConfig?.mercadopago_public_key ?? undefined,
        country: paymentConfig?.mercadopago_country ?? undefined,
        currency: paymentConfig?.mercadopago_currency ?? undefined,
      },
      coinbase: {
        enabled: Boolean(paymentConfig?.coinbase_enabled),
      },
    },
    contact: {
      email: project.email ?? undefined,
      phone: project.phone ?? undefined,
      whatsapp: project.whatsapp ?? undefined,
      location: project.location ?? undefined,
    },
  };
}

// ─── Copy template to sites directory ────────────────────────────────────────

export async function copyTemplate(_template: string, subdomain: string): Promise<void> {
  // Always use unified base template; theme selection is handled via store-config.json
  const src = path.join(TEMPLATES_DIR, "base");
  const dest = path.join(SITES_DIR, subdomain);

  if (!fs.existsSync(src)) {
    throw new Error(`Base template not found at ${src}`);
  }

  // Clean destination if it exists
  if (fs.existsSync(dest)) {
    await execAsync(`rm -rf "${dest}"`);
  }

  // Copy template recursively (exclude node_modules and .next)
  await execAsync(
    `rsync -a --exclude=node_modules --exclude=.next "${src}/" "${dest}/"`
  );
}

// ─── Write store config ───────────────────────────────────────────────────────

export function writeStoreConfig(subdomain: string, config: StoreConfig): void {
  const dest = path.join(SITES_DIR, subdomain, "store-config.json");
  fs.writeFileSync(dest, JSON.stringify(config, null, 2), "utf-8");
}

// ─── Nubia build queue (separate from Manu Dev) ───────────────────────────────

let nubiaTail: Promise<unknown> = Promise.resolve();
let nubiaQueued = 0;

async function markNubiaBuildStarted(projectId: number) {
  const pool = getPool();
  await pool.execute(
    `UPDATE nb_projects SET status = 'building', build_started_at = NOW(),
       build_finished_at = NULL, last_build_error = NULL WHERE id = ?`,
    [projectId]
  );
}

async function markNubiaBuildFailed(projectId: number, error: string) {
  const pool = getPool();
  await pool.execute(
    `UPDATE nb_projects SET status = 'error', build_finished_at = NOW(),
       last_build_error = ? WHERE id = ?`,
    [error.slice(0, 4000), projectId]
  );
}

async function markNubiaBuildSuccess(projectId: number, containerId: string, siteUrl: string) {
  const pool = getPool();
  await pool.execute(
    `UPDATE nb_projects SET status = 'active', container_id = ?, site_url = ?,
       build_finished_at = NOW(), last_build_error = NULL WHERE id = ?`,
    [containerId, siteUrl, projectId]
  );
}

export function queueNubiaBuild(options: {
  subdomain: string;
  projectId: number;
  onStart?: () => void | Promise<void>;
}) {
  const { subdomain, projectId, onStart } = options;
  const queuePosition = nubiaQueued + 1;
  nubiaQueued += 1;

  const execute = async () => {
    try {
      await markNubiaBuildStarted(projectId);
      if (onStart) await onStart();

      // Nubia always uses Next.js mode (templates are full Next apps)
      const { stdout } = await execAsync(`sh ${BUILD_SCRIPT} ${subdomain} next`, {
        timeout: BUILD_TIMEOUT_MS,
      });

      const containerId = stdout.trim().split("\n").pop() || "";
      if (!containerId) throw new Error("build_no_container_id");

      const baseDomain = NL360_BASE_URL.replace(/^https?:\/\//, "");
      const siteUrl = `https://${subdomain}.${baseDomain}`;
      await markNubiaBuildSuccess(projectId, containerId, siteUrl);

      return { stdout, containerId, siteUrl };
    } catch (err: any) {
      const detail = String(err?.stderr || err?.message || "Error de build").slice(0, 1400);
      await markNubiaBuildFailed(projectId, detail);
      throw err;
    }
  };

  const run = nubiaTail.then(execute, execute);
  nubiaTail = run.catch((err) => {
    console.error(`[nubia-deploy] queue error for ${subdomain}:`, err?.message || err);
  });

  const wrapped = run.finally(() => {
    nubiaQueued = Math.max(0, nubiaQueued - 1);
  });

  return { queuePosition, run: wrapped };
}
