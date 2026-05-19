import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import { getProjectById } from "@/lib/nubia/db-nubia";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const SITES_DIR = "/opt/docker-apps/sites";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const userId = await getUserId(token);
    if (!userId) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const formData = await req.formData();
    const projectIdRaw = formData.get("project_id");
    const file = formData.get("file") as File | null;

    if (!projectIdRaw || !file) {
      return NextResponse.json({ error: "Faltan parametros (project_id, file)" }, { status: 400 });
    }

    const projectId = parseInt(String(projectIdRaw), 10);
    if (isNaN(projectId)) return NextResponse.json({ error: "project_id invalido" }, { status: 400 });

    const project = await getProjectById(projectId, userId);
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Archivo demasiado grande (max 5MB)" }, { status: 400 });
    }

    // Validate extension
    const originalName = file.name || "image.jpg";
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: `Formato no soportado. Usa: ${ALLOWED_EXTS.join(", ")}` }, { status: 400 });
    }

    // Create products directory
    const productsDir = path.join(SITES_DIR, project.subdomain, "public", "products");
    await fs.mkdir(productsDir, { recursive: true });

    // Generate unique filename
    const hash = crypto.randomBytes(6).toString("hex");
    const fileName = `${hash}${ext}`;
    const filePath = path.join(productsDir, fileName);

    // Write file
    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    // Return the public URL path
    const imageUrl = `/products/${fileName}`;

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (err: any) {
    console.error("[nubia/product-image]", err);
    return NextResponse.json({ error: err?.message || "Error al subir imagen" }, { status: 500 });
  }
}
