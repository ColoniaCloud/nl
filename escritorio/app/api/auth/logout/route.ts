import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Expira cookie
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}
