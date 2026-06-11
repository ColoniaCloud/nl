import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectById, getPaymentConfig, upsertPaymentConfig } from "@/lib/nubia/db-nubia";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserId(token);
}

export async function GET(req: NextRequest) {
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const projectId = Number(new URL(req.url).searchParams.get("project_id"));
  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const project = await getProjectById(projectId, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const config = await getPaymentConfig(projectId);
  // Mask sensitive keys before returning
  if (config) {
    if (config.mercadopago_access_token) {
      (config as any).mercadopago_access_token = "***" + config.mercadopago_access_token.slice(-6);
    }
    if (config.mercadopago_webhook_secret) {
      (config as any).mercadopago_webhook_secret = "***" + config.mercadopago_webhook_secret.slice(-6);
    }
    if (config.coinbase_api_key) {
      (config as any).coinbase_api_key = "***" + config.coinbase_api_key.slice(-6);
    }
    if (config.coinbase_webhook_secret) {
      (config as any).coinbase_webhook_secret = "***" + config.coinbase_webhook_secret.slice(-6);
    }
  }
  return NextResponse.json({ config: config ?? null });
}

export async function PATCH(req: NextRequest) {
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { project_id, ...data } = body;

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  // Don't overwrite masked tokens — strip any masked or empty secret fields
  const safeData = { ...data };
  for (const field of ["mercadopago_access_token", "mercadopago_webhook_secret", "coinbase_api_key", "coinbase_webhook_secret"] as const) {
    if (!safeData[field] || String(safeData[field]).startsWith("***")) delete safeData[field];
  }

  await upsertPaymentConfig(project_id, safeData);
  return NextResponse.json({ ok: true });
}
