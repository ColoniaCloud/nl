import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectById, getDesign, upsertDesign } from "@/lib/nubia/db-nubia";

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

  const design = await getDesign(projectId);
  return NextResponse.json({ design });
}

export async function PATCH(req: NextRequest) {
  const userId = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { project_id, ...data } = body;

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  await upsertDesign(project_id, data);
  return NextResponse.json({ ok: true });
}
