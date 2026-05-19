import { NextResponse } from "next/server";

const WP_BASE_URL = process.env.WP_BASE_URL!;
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Missing username/password" },
        { status: 400 }
      );
    }

    // WP JWT login (simple-jwt-login plugin)
    const wpRes = await fetch(`${WP_BASE_URL}/wp-json/simple-jwt-login/v1/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // IMPORTANT: do not forward user cookies to WP here
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    const data = await wpRes.json();

    if (!wpRes.ok || !data?.data?.jwt) {
      return NextResponse.json(
        { ok: false, error: data?.data?.message || data?.message || "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = data.data.jwt as string;

    // Verificar que el email esté confirmado antes de dejar pasar
    const meRes = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData?.user?.emailVerified === false) {
        return NextResponse.json(
          {
            ok: false,
            error: "Debes verificar tu email antes de iniciar sesion. Revisa tu bandeja de entrada.",
            unverified: true,
          },
          { status: 403 }
        );
      }
    }

    const res = NextResponse.json({ ok: true });

    // Cookie httpOnly: WP is source of truth, Next stores JWT
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // 7 días (ajustable). Si preferís atarte al exp del JWT, lo hacemos después.
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
