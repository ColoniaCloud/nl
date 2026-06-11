"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, ChevronRight, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

// Map pathname → human-readable label for the breadcrumb
function usePageLabel(pathname: string): string {
  if (pathname === "/workspace") return "Inicio";
  if (pathname.startsWith("/services/manu-dev")) return "Manu Dev";
  if (pathname.startsWith("/services/lander")) return "Lander";
  if (pathname.startsWith("/services/margarita")) return "Margarita";
  if (pathname.startsWith("/services/grant")) return "Jordan";
  if (pathname.startsWith("/services/mentoria")) return "MentorIA";
  return "Backoffice";
}

export default function WorkspaceBar() {
  const pathname = usePathname();
  const label = usePageLabel(pathname);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-9 flex items-center justify-between px-3 gap-3
        bg-zinc-950 border-b border-white/[0.07]"
    >
      {/* Left: brand + mobile sidebar toggle */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {isMobile && (
          <button
            onClick={() => setOpenMobile(true)}
            className="flex items-center justify-center h-7 w-7 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors -ml-1"
            title="Abrir menú"
          >
            <Menu className="size-4" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
          alt="NL360"
          className="h-4 w-4 invert opacity-60"
        />
        <span className="text-xxs font-semibold text-zinc-500 tracking-wide hidden sm:block">
          Backoffice 360
        </span>
        {label !== "Backoffice" && (
          <>
            <ChevronRight className="size-3 text-zinc-700 flex-shrink-0" />
            <span className="text-xxs text-zinc-400 truncate">{label}</span>
          </>
        )}
      </div>

      {/* Center: workspace indicator */}
      <div className="hidden md:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="text-2xs font-medium text-zinc-500 uppercase tracking-widest">
          Workspace
        </span>
      </div>

      {/* Right: back to site */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-xxs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
      >
        <Globe className="size-3" />
        <span className="hidden sm:block">Sitio web</span>
      </Link>
    </div>
  );
}
