import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const WP_BASE_URL = process.env.WP_BASE_URL!;
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

async function fetchWithBearer(url: string, token: string) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  // 1) Try NL360 custom /me (recommended: includes capabilities)
  const nl360Url = `${WP_BASE_URL}/wp-json/nl360/v1/me`;
  const nl360Res = await fetchWithBearer(nl360Url, token);

  if (nl360Res.ok) {
    const data = await nl360Res.json();
    // expected: { user: {...}, roles: [...], capabilities: {...} }
    return NextResponse.json({ ok: true, ...data });
  }

  // 2) Fallback to core WP users/me
  const wpRes = await fetchWithBearer(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, token);

  if (!wpRes.ok) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const me = await wpRes.json();

  return NextResponse.json({
    ok: true,
    user: {
      id: me.id,
      username: me.slug,
      displayName: me.name,
    },
    roles: [],
    capabilities: {},
    warning: "nl360/v1/me not available; returning limited user data",
  });
}
