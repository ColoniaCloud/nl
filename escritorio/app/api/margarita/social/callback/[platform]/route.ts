import { NextRequest, NextResponse } from "next/server";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { exchangeCodeForToken, getMetaPages, getLinkedInProfile, getClickUpUser, type Platform } from "@/lib/margarita-social";
import { encryptToken } from "@/lib/margarita-encrypt";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nl360.site";

// GET /api/margarita/social/callback/[platform]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const { platform: platformParam } = await params;
    const platform = platformParam as Platform;

    if (error) {
      return NextResponse.redirect(
        `${BASE_URL}/services/margarita?social_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(`${BASE_URL}/services/margarita?social_error=invalid_callback`);
    }

    // Parse state: user_id:platform:random
    const [userIdStr] = state.split(":");
    const userId = parseInt(userIdStr, 10);
    if (!userId) {
      return NextResponse.redirect(`${BASE_URL}/services/margarita?social_error=invalid_state`);
    }

    await ensureTables();
    const pool = getPool();

    // Exchange code for token
    let tokenData: { access_token: string; refresh_token?: string; expires_in?: number } | null = null;

    if (platformParam === "clickup") {
      // ClickUp requires JSON body, not form-encoded
      const config = { client_id: process.env.CLICKUP_CLIENT_ID || "", client_secret: process.env.CLICKUP_CLIENT_SECRET || "" };
      const res = await fetch("https://api.clickup.com/api/v2/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: config.client_id, client_secret: config.client_secret, code }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.access_token) tokenData = { access_token: json.access_token };
      }
    } else {
      tokenData = await exchangeCodeForToken(platform, code);
    }

    if (!tokenData?.access_token) {
      return NextResponse.redirect(
        `${BASE_URL}/services/margarita?social_error=token_exchange_failed`
      );
    }

    const encryptedAccess = encryptToken(tokenData.access_token);
    const encryptedRefresh = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Get account info based on platform
    let accountName = "";
    let accountId = "";
    let pageId = "";

    if (platform === "facebook" || platform === "instagram") {
      const pages = await getMetaPages(tokenData.access_token);
      if (pages.length > 0) {
        accountName = pages[0].name;
        accountId = pages[0].id;
        pageId = pages[0].id;
      }
    } else if (platform === "linkedin") {
      const profile = await getLinkedInProfile(tokenData.access_token);
      if (profile) {
        accountName = `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim();
        accountId = profile.id;
      }
    } else if (platform === "clickup") {
      const cuUser = await getClickUpUser(tokenData.access_token);
      if (cuUser) {
        accountName = cuUser.username || cuUser.email || "";
        accountId = String(cuUser.id || "");
      }
    }

    // Upsert social account
    await pool.execute(
      `INSERT INTO mm_social_accounts (user_id, platform, account_id, account_name, page_id, access_token, refresh_token, token_expires_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         account_id = VALUES(account_id),
         account_name = VALUES(account_name),
         page_id = VALUES(page_id),
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         token_expires_at = VALUES(token_expires_at),
         connected_at = CURRENT_TIMESTAMP`,
      [
        userId, platform, accountId || null, accountName || null,
        pageId || null, encryptedAccess, encryptedRefresh || null,
        expiresAt ? expiresAt.toISOString().slice(0, 19).replace("T", " ") : null,
      ]
    );

    return NextResponse.redirect(
      `${BASE_URL}/services/margarita?social_connected=${platform}`
    );
  } catch (err: any) {
    console.error("[margarita oauth callback]", err);
    return NextResponse.redirect(
      `${BASE_URL}/services/margarita?social_error=${encodeURIComponent(err?.message || "unknown")}`
    );
  }
}
