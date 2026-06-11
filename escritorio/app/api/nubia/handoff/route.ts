import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/app/api/nubia/projects/route";
import { getHandoff } from "@/lib/shared-project";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const handoffId = Number(new URL(req.url).searchParams.get("id"));
  if (!handoffId) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const data = await getHandoff(handoffId, user.id);
  if (!data) return NextResponse.json({ error: "Handoff no encontrado" }, { status: 404 });

  return NextResponse.json({ data });
}
