import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    return data.user?.id ? { id: data.user.id } : null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id } : null;
}

// POST /api/margarita/content/image
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    await ensureTables();
    const pool = getPool();

    const body = await req.json();
    const { content_id, visual_description } = body;

    if (!content_id || !visual_description) {
      return NextResponse.json({ error: "content_id y visual_description requeridos" }, { status: 400 });
    }

    // Verify ownership
    const [cRows] = (await pool.execute(
      `SELECT c.id FROM mm_content c
       JOIN mm_strategies s ON s.id = c.strategy_id
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE c.id = ? AND b.user_id = ?`,
      [content_id, user.id]
    )) as any;
    if (!cRows[0]) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const hfToken = process.env.HUGGING_FACE_TOKEN;
    if (!hfToken) return NextResponse.json({ error: "HUGGING_FACE_TOKEN no configurado" }, { status: 500 });

    // Generate image with FLUX.1-schnell
    const prompt = `${visual_description}, professional social media post, high quality, 4k, clean composition`;

    const res = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `HuggingFace error: ${errText}` }, { status: 500 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "margarita-content");
    fs.mkdirSync(dir, { recursive: true });

    const filename = `post-${content_id}-${Date.now()}.png`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    const mediaUrl = `/margarita-content/${filename}`;

    // Update content record
    await pool.execute(
      "UPDATE mm_content SET media_url = ? WHERE id = ?",
      [mediaUrl, content_id]
    );

    return NextResponse.json({ media_url: mediaUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
