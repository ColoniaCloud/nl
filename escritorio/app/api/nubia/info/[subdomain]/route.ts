/**
 * Inter-agent endpoint — returns Nubia store info for a given subdomain.
 * Accessible by other agents (Manu Dev, etc.) via Bearer token or JWT cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectBySubdomain, getDesign, getPaymentConfig } from "@/lib/nubia/db-nubia";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function GET(
  req: NextRequest,
  { params: _params }: { params: Promise<{ subdomain: string }> }
) {
  const params = await _params;
  // Auth via cookie or Authorization header
  const jar = await cookies();
  const cookieToken = jar.get(COOKIE_NAME)?.value;
  const bearerToken = req.headers.get("authorization")?.replace("Bearer ", "");
  const token = cookieToken || bearerToken;

  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

  const project = await getProjectBySubdomain(params.subdomain);
  if (!project) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  // Check ownership
  if (project.user_id !== userId) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const design = await getDesign(project.id);
  const payConfig = await getPaymentConfig(project.id);

  return NextResponse.json({
    id: project.id,
    subdomain: project.subdomain,
    name: project.name,
    description: project.description,
    industry: project.industry,
    template: project.template,
    status: project.status,
    site_url: project.site_url,
    manu_dev_project_id: project.manu_dev_project_id,
    design: design ? {
      primary_color: design.primary_color,
      secondary_color: design.secondary_color,
      accent_color: design.accent_color,
      font_heading: design.font_heading,
      font_body: design.font_body,
      tagline: design.tagline,
    } : null,
    payments: {
      bank_transfer: Boolean(payConfig?.bank_transfer_enabled),
      mercadopago: Boolean(payConfig?.mercadopago_enabled),
      coinbase: Boolean(payConfig?.coinbase_enabled),
    },
    contact: {
      email: project.email,
      phone: project.phone,
      whatsapp: project.whatsapp,
      location: project.location,
    },
  });
}
