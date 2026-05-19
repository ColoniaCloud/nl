import { NextResponse } from "next/server";
import { recordReferral } from "@/lib/db-referrals";

const WP_BASE_URL = process.env.WP_BASE_URL!;
const INTERNAL_SECRET = process.env.NL360_INTERNAL_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, email, password, plan = "free", referralCode } = body ?? {};

    if (!username || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos." },
        { status: 400 }
      );
    }

    const wpRes = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NL360-Internal": INTERNAL_SECRET,
      },
      body: JSON.stringify({ username, email, password, plan }),
      cache: "no-store",
    });

    const data = await wpRes.json().catch(() => ({}));

    if (!wpRes.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message || "Error al crear la cuenta." },
        { status: wpRes.status }
      );
    }

    // Record referral if code was provided
    if (referralCode && data?.user_id) {
      await recordReferral(referralCode, Number(data.user_id), username).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error inesperado." },
      { status: 500 }
    );
  }
}
