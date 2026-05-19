import { NextResponse } from "next/server";
import { getProjectBySubdomain, getProductBySlug } from "@/lib/nubia/db-nubia";

export async function GET(
  _req: Request,
  { params: _params }: { params: Promise<{ subdomain: string; slug: string }> }
) {
  const params = await _params;
  const project = await getProjectBySubdomain(params.subdomain);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = await getProductBySlug(project.id, params.slug);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ product });
}
