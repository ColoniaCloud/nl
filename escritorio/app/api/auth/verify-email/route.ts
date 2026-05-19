import { NextResponse } from "next/server";

const WP_BASE_URL = process.env.WP_BASE_URL!;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const uid = url.searchParams.get("uid") ?? "";

    if (!token || !uid) {
      return NextResponse.json(
        { ok: false, error: "Token o uid faltante." },
        { status: 400 }
      );
    }

    const wpRes = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, uid }),
      cache: "no-store",
    });

    const data = await wpRes.json().catch(() => ({}));

    if (!wpRes.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message || "Token invalido o expirado." },
        { status: wpRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      username: data.username,
      pendingPlan: data.pending_plan,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error inesperado." },
      { status: 500 }
    );
  }
}
