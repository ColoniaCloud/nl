"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/agentes", label: "Agentes" },
  { href: "/precio", label: "Precio" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/agencias", label: "Agencias" },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90vw] sm:w-[70vw]">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-zinc-950/80 backdrop-blur-xl px-5 py-3 shadow-[var(--shadow-lg)]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
            alt="NL360"
            className="h-7 w-7 invert"
          />
          <span className="text-sm font-semibold text-white tracking-tight hidden sm:block">
            NL360
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm transition-colors",
                  active
                    ? "text-white bg-white/[0.08]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {authed === null ? null : authed ? (
            <Link
              href="/workspace"
              className="px-4 py-1.5 rounded-lg text-sm bg-white text-zinc-950 font-medium hover:bg-zinc-100 transition-colors"
            >
              Ir al escritorio
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Iniciar sesion
              </Link>
              <Link
                href="/registro"
                className="px-4 py-1.5 rounded-lg text-sm bg-white text-zinc-950 font-medium hover:bg-zinc-100 transition-colors"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mt-2 rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl px-3 py-3 shadow-[var(--shadow-lg)]">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "text-white bg-white/[0.08]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-col gap-2">
            {authed === null ? null : authed ? (
              <Link
                href="/workspace"
                onClick={() => setMobileOpen(false)}
                className="px-3.5 py-2 rounded-lg text-sm bg-white text-zinc-950 font-medium hover:bg-zinc-100 transition-colors text-center"
              >
                Ir al escritorio
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors text-center"
                >
                  Iniciar sesion
                </Link>
                <Link
                  href="/registro"
                  onClick={() => setMobileOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-sm bg-white text-zinc-950 font-medium hover:bg-zinc-100 transition-colors text-center"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
