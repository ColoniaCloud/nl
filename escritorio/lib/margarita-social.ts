/**
 * Social media platform helpers for Margarita Mkt.
 * OAuth + API calls per platform.
 * Phase 4 — Meta + LinkedIn implemented first.
 */

export type Platform = "facebook" | "instagram" | "x" | "linkedin" | "gmb" | "clickup";

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nl360.site";

export function getOAuthConfig(platform: Platform): OAuthConfig | null {
  switch (platform) {
    case "facebook":
    case "instagram":
      return {
        authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
        clientId: process.env.META_APP_ID || "",
        clientSecret: process.env.META_APP_SECRET || "",
        scopes: [
          "pages_manage_posts",
          "pages_read_engagement",
          "instagram_content_publish",
          "instagram_basic",
        ],
        redirectUri: `${BASE_URL}/api/margarita/social/callback/facebook`,
      };

    case "linkedin":
      return {
        authUrl: "https://www.linkedin.com/oauth/v2/authorization",
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
        clientId: process.env.LINKEDIN_CLIENT_ID || "",
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
        scopes: ["w_member_social", "w_organization_social", "r_organization_social"],
        redirectUri: `${BASE_URL}/api/margarita/social/callback/linkedin`,
      };

    case "x":
      return {
        authUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        clientId: process.env.X_CLIENT_ID || "",
        clientSecret: process.env.X_CLIENT_SECRET || "",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        redirectUri: `${BASE_URL}/api/margarita/social/callback/x`,
      };

    case "gmb":
      return {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        scopes: ["https://www.googleapis.com/auth/business.manage"],
        redirectUri: `${BASE_URL}/api/margarita/social/callback/gmb`,
      };

    case "clickup":
      return {
        authUrl: "https://app.clickup.com/api",
        tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
        clientId: process.env.CLICKUP_CLIENT_ID || "",
        clientSecret: process.env.CLICKUP_CLIENT_SECRET || "",
        scopes: [],
        redirectUri: `${BASE_URL}/api/margarita/social/callback/clickup`,
      };

    default:
      return null;
  }
}

export function buildAuthUrl(platform: Platform, state: string): string | null {
  const config = getOAuthConfig(platform);
  if (!config || !config.clientId) return null;

  // ClickUp uses different auth URL structure
  if (platform === "clickup") {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  platform: Platform,
  code: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  const config = getOAuthConfig(platform);
  if (!config) return null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

// ─── Meta Graph API ────────────────────────────────────────────────────────

export async function getMetaPages(accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function getMetaInsights(pageId: string, pageToken: string) {
  const metrics = "page_fans,page_post_engagements,page_impressions_unique";
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/insights?metric=${metrics}&period=month&access_token=${pageToken}`
  );
  if (!res.ok) return null;
  return res.json();
}

export async function publishFacebookPost(
  pageId: string,
  pageToken: string,
  message: string,
  scheduledTime?: Date
) {
  const body: Record<string, any> = { message, access_token: pageToken };
  if (scheduledTime) {
    body.published = false;
    body.scheduled_publish_time = Math.floor(scheduledTime.getTime() / 1000);
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function publishInstagramPost(
  igUserId: string,
  pageToken: string,
  imageUrl: string,
  caption: string
) {
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: pageToken,
      }),
    }
  );
  if (!containerRes.ok) return null;
  const container = await containerRes.json();

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: pageToken,
      }),
    }
  );
  if (!publishRes.ok) return null;
  return publishRes.json();
}

// ─── LinkedIn Marketing API ───────────────────────────────────────────────

export async function getLinkedInProfile(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── ClickUp API ──────────────────────────────────────────────────────────

export async function getClickUpUser(accessToken: string) {
  const res = await fetch("https://api.clickup.com/api/v2/user", {
    headers: { Authorization: accessToken },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}

export async function publishLinkedInPost(
  authorUrn: string,
  accessToken: string,
  text: string
) {
  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}
