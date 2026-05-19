import { NextRequest, NextResponse } from "next/server";
import { getProjectBySubdomain, getProducts, getCategories } from "@/lib/nubia/db-nubia";

export async function GET(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  const { subdomain } = params;
  const project = await getProjectBySubdomain(subdomain);
  if (!project || project.status !== "active") {
    return NextResponse.json({ products: [], categories: [] });
  }

  const url = new URL(req.url);
  const featuredOnly = url.searchParams.get("featured") === "1";
  const categorySlug = url.searchParams.get("category");

  let products = await getProducts(project.id, true);
  const categories = await getCategories(project.id);

  if (featuredOnly) {
    products = products.filter((p) => p.featured);
  }

  if (categorySlug) {
    const cat = categories.find((c) => c.slug === categorySlug);
    if (cat) {
      products = products.filter((p) => p.category_id === cat.id);
    }
  }

  return NextResponse.json({ products, categories });
}
