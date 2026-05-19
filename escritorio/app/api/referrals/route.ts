import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, COOKIE_NAME } from "@/lib/db-billing";
import { getUserReferralStats } from "@/lib/db-referrals";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nl360.site";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stats = await getUserReferralStats(userId);

  return NextResponse.json({
    ok: true,
    referralUrl: `${APP_URL}/registro?ref=${stats.code}`,
    ...stats,
  });
}
