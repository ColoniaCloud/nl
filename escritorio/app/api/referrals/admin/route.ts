import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserMeta, COOKIE_NAME } from "@/lib/db-billing";
import { getAdminReferralSummary } from "@/lib/db-referrals";

export const runtime = "nodejs";

const WP_BASE_URL = process.env.WP_BASE_URL!;

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const meta = await getUserMeta(token);
  if (!meta?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await getAdminReferralSummary();

  // Enrich with WP display names (batch fetch)
  const enriched = await Promise.all(
    rows.map(async (row) => {
      try {
        const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/${row.user_id}?context=edit`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const u = await res.json();
          return { ...row, username: u.slug, display_name: u.name, email: u.email };
        }
      } catch {}
      return { ...row, username: `#${row.user_id}`, display_name: null, email: null };
    })
  );

  return NextResponse.json({ ok: true, referrers: enriched });
}
