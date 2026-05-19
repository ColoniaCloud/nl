import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

// Rutas que NO deben requerir auth
function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/registro") ||
    pathname === "/verificar-email" ||
    pathname === "/recuperar-contrasena" ||
    pathname === "/resetear-contrasena" ||
    pathname === "/precio" ||
    pathname === "/enterprise" ||
    pathname === "/agencias" ||
    pathname === "/terminos" ||
    pathname === "/privacidad" ||
    pathname === "/cookies" ||
    pathname.startsWith("/agentes") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/api/mentoria/shared/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/agent-message" ||
    pathname.startsWith("/api/billing/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public/") ||
    pathname.startsWith("/assets/")
  );
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/agent-message")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  // Dejar pasar rutas públicas
  if (isPublicPath(pathname)) return NextResponse.next();

  // Si no hay token → para rutas API devolver JSON 401, para páginas redirect a /login
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Si hay token, dejamos pasar (validación real la hace /api/auth/me cuando se necesite)
  return NextResponse.next();
}

// Match de todo excepto estáticos comunes (extra safety)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
