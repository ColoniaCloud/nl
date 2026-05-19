import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectById, updateProduct } from "@/lib/nubia/db-nubia";
import { enhanceProductDescription } from "@/lib/nubia/nubia-ai";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const { project_id, product_id, product_name, description, industry } = await req.json();

  const project = await getProjectById(project_id, userId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const enhanced = await enhanceProductDescription(
    product_name,
    description || "",
    industry || project.industry || "productos"
  );

  if (product_id) {
    await updateProduct(product_id, project_id, { description_enhanced: enhanced });
  }

  return NextResponse.json({ description_enhanced: enhanced });
}
