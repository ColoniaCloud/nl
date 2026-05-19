import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectById, getOrders, getOrderById, getOrderItems, updateOrderStatus } from "@/lib/nubia/db-nubia";

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

  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("project_id"));
  const orderId = Number(url.searchParams.get("order_id"));

  if (!projectId) return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const project = await getProjectById(projectId, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  if (orderId) {
    const order = await getOrderById(orderId, projectId);
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    const items = await getOrderItems(orderId);
    return NextResponse.json({ order, items });
  }

  const orders = await getOrders(projectId, 100);
  return NextResponse.json({ orders });
}

export async function PATCH(req: NextRequest) {
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { order_id, project_id, status, admin_notes } = body;

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  await updateOrderStatus(order_id, project_id, status, admin_notes);
  return NextResponse.json({ ok: true });
}
