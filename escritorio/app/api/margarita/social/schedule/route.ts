import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { decryptToken } from "@/lib/margarita-encrypt";
import { publishFacebookPost, publishInstagramPost, publishLinkedInPost } from "@/lib/margarita-social";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

// POST /api/margarita/social/schedule
// Body: { content_ids: number[] } — schedule approved posts
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const body = await req.json();
    const { content_ids }: { content_ids: number[] } = body;

    if (!Array.isArray(content_ids) || content_ids.length === 0) {
      return NextResponse.json({ error: "content_ids requerido" }, { status: 400 });
    }

    // Load posts with ownership check
    const placeholders = content_ids.map(() => "?").join(",");
    const [posts] = (await pool.execute(
      `SELECT c.*, b.user_id AS owner_id
       FROM mm_content c
       JOIN mm_strategies s ON s.id = c.strategy_id
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE c.id IN (${placeholders})`,
      content_ids
    )) as any;

    // Get user's social accounts
    const [accounts] = (await pool.execute(
      "SELECT * FROM mm_social_accounts WHERE user_id = ?",
      [user.id]
    )) as any;

    const accountByPlatform: Record<string, any> = {};
    for (const acc of accounts) {
      accountByPlatform[acc.platform] = acc;
    }

    const results: Array<{ content_id: number; status: string; external_id?: string; error?: string }> = [];

    for (const post of posts) {
      if (post.owner_id !== user.id) {
        results.push({ content_id: post.id, status: "error", error: "No autorizado" });
        continue;
      }

      const account = accountByPlatform[post.platform];
      if (!account) {
        results.push({ content_id: post.id, status: "error", error: `No hay cuenta conectada para ${post.platform}` });
        continue;
      }

      const accessToken = decryptToken(account.access_token);
      if (!accessToken) {
        results.push({ content_id: post.id, status: "error", error: "Token expirado o invalido" });
        continue;
      }

      try {
        const scheduledAt = post.scheduled_at ? new Date(post.scheduled_at) : undefined;
        const message = `${post.caption}${post.hashtags ? `\n\n${post.hashtags}` : ""}`;
        let externalId: string | undefined;

        if (post.platform === "facebook" && account.page_id) {
          const result = await publishFacebookPost(account.page_id, accessToken, message, scheduledAt);
          externalId = result?.id;
        } else if (post.platform === "instagram" && account.page_id && post.media_url) {
          const mediaUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://nl360.site"}${post.media_url}`;
          const result = await publishInstagramPost(account.page_id, accessToken, mediaUrl, message);
          externalId = result?.id;
        } else if (post.platform === "linkedin") {
          const authorUrn = `urn:li:person:${account.account_id}`;
          const result = await publishLinkedInPost(authorUrn, accessToken, message);
          externalId = result?.id;
        } else {
          results.push({ content_id: post.id, status: "error", error: `Publicacion para ${post.platform} no implementada aun` });
          continue;
        }

        if (externalId) {
          await pool.execute(
            "UPDATE mm_content SET status = 'scheduled', external_post_id = ? WHERE id = ?",
            [externalId, post.id]
          );
          results.push({ content_id: post.id, status: "scheduled", external_id: externalId });
        } else {
          await pool.execute(
            "UPDATE mm_content SET status = 'failed' WHERE id = ?",
            [post.id]
          );
          results.push({ content_id: post.id, status: "failed", error: "La API no devolvio un ID" });
        }
      } catch (e: any) {
        await pool.execute(
          "UPDATE mm_content SET status = 'failed' WHERE id = ?",
          [post.id]
        );
        results.push({ content_id: post.id, status: "error", error: e?.message });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
