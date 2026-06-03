"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Home,
  Megaphone,
  Handshake,
  GraduationCap,
  Code2,
  LogOut,
  BadgeCheck,
  Plus,
  Globe,
  PanelLeft,
  Users,
  Settings,
  ChevronRight,
  ShoppingBag,
  Coins,
  Layers,
  Crown,
  Eye,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useManuDevProjects } from "@/hooks/useManuDevProjects";
import type { ManuDevProject, NubiaProject, ForgeProject } from "@/hooks/useManuDevProjects";

// ─── Types ────────────────────────────────────────────────────────────────────

type MeResponse = {
  ok: boolean;
  user?: {
    id: number;
    username: string;
    displayName: string;
    roles?: string[];
  };
  plan?: { slug?: string; status?: string };
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  withHistory?: boolean;
  newLabel?: string;
  subItems?: { href: string; label: string; icon?: React.ElementType }[];
};

// ─── Nav definition ───────────────────────────────────────────────────────────

// Sub-agents under Manu Dev
type SubAgent = {
  href: string;
  label: string;
  icon: React.ElementType;
  projectsKey: "manuDev" | "nubia" | "forge";
};

const MANU_DEV_SUBAGENTS: SubAgent[] = [
  { href: "/services/manu-dev", label: "Dev", icon: Globe, projectsKey: "manuDev" },
  { href: "/services/nubia", label: "Nubia", icon: ShoppingBag, projectsKey: "nubia" },
  { href: "/services/forge", label: "Forge", icon: Coins, projectsKey: "forge" },
];

// Other top-level agents
const NAV_AGENTS: NavItem[] = [
  {
    href: "/services/margarita",
    label: "Margarita Mkt",
    icon: Megaphone,
    newLabel: "Nueva conversacion",
    subItems: [
      { href: "/services/margarita/crm", label: "CRM", icon: Users },
    ],
  },
  {
    href: "/services/grant",
    label: "Jordan",
    icon: Handshake,
    newLabel: "Nueva conversacion",
  },
  {
    href: "/services/mentoria",
    label: "MentorIA",
    icon: GraduationCap,
    newLabel: "Nueva conversacion",
    subItems: [
      { href: "/services/mentoria?agent=NAPOLEON", label: "Napoleon", icon: Crown },
      { href: "/services/mentoria?agent=NEVILLE", label: "Neville", icon: Eye },
    ],
  },
];

// ─── NavItem component ────────────────────────────────────────────────────────

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  expanded,
  rightSlot,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  expanded: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={!expanded ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors min-w-0",
        active
          ? "bg-white/[0.10] text-foreground font-medium"
          : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
        !expanded && "justify-center px-0"
      )}
    >
      <Icon className="size-4 flex-shrink-0" />
      {expanded && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {rightSlot}
        </>
      )}
    </Link>
  );
}

// ─── AppSidebar ────────────────────────────────────────────────────────────────

export default function AppSidebar() {
  const { open, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get("project");

  const { projects: subAgentProjects, refetch: refetchProjects } = useManuDevProjects();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [openAgents, setOpenAgents] = useState<Record<string, boolean>>({});
  const [openSubHistory, setOpenSubHistory] = useState<Record<string, boolean>>({});

  // Load user
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: MeResponse) => { if (alive) { setMe(d?.ok ? d : null); setMeLoading(false); } })
      .catch(() => { if (alive) setMeLoading(false); });
    return () => { alive = false; };
  }, []);

  // Refetch projects on navigation
  useEffect(() => {
    refetchProjects();
  }, [pathname, refetchProjects]);

  // Auto-expand the active agent on mount / pathname change
  useEffect(() => {
    // Check if we're on a Manu Dev sub-agent page
    const activeSub = MANU_DEV_SUBAGENTS.find((s) => pathname?.startsWith(s.href));
    if (activeSub) {
      setOpenAgents((prev) => ({ ...prev, "/services/manu-dev-group": true }));
    }
    // Check other agents
    const active = NAV_AGENTS.find((a) => pathname?.startsWith(a.href));
    if (active) setOpenAgents((prev) => ({ ...prev, [active.href]: true }));
  }, [pathname]);

  function toggleAgent(href: string) {
    setOpenAgents((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  function toggleSubHistory(href: string) {
    setOpenSubHistory((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  function getSubProjects(key: "manuDev" | "nubia" | "forge") {
    return subAgentProjects[key];
  }

  function projectLabel(key: "manuDev" | "nubia" | "forge", p: ManuDevProject | NubiaProject | ForgeProject) {
    if (key === "forge") {
      const fp = p as ForgeProject;
      return fp.token_name || fp.name || "Contrato";
    }
    if (key === "nubia") {
      const np = p as NubiaProject;
      return np.name || np.subdomain || "Tienda";
    }
    const mp = p as ManuDevProject;
    return mp.name || mp.subdomain || "Proyecto";
  }

  const isAuthed = Boolean(me?.ok);
  const displayName = me?.user?.displayName || "Cuenta";
  const username = me?.user?.username ? `@${me.user.username}` : "";
  const membership = useMemo(() => {
    if (me?.plan?.slug) return me.plan.slug;
    const nlRole = (me?.user?.roles || []).find((r) => r.startsWith("nl360_"));
    return nlRole || "free";
  }, [me]);

  async function onLogout() {
    setLogoutLoading(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { window.location.assign("/login"); }
  }

  const isOpen = isMobile ? openMobile : open;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && openMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpenMobile(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-9 bottom-0 left-0 z-30 flex flex-col",
          "bg-sidebar border-r border-sidebar-border",
          "overflow-hidden",
          // Desktop: width transition
          !isMobile && "transition-[width] duration-200 ease-linear",
          !isMobile && (open ? "w-[280px]" : "w-[56px]"),
          // Mobile: slide in/out
          isMobile && "w-[280px] transition-transform duration-200 ease-linear",
          isMobile && (openMobile ? "translate-x-0" : "-translate-x-full")
        )}
      >

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className={cn(
          "flex h-12 items-center flex-shrink-0 px-2 border-b border-sidebar-border",
          isOpen ? "justify-between" : "justify-center"
        )}>
          {isOpen && (
            <Link href="/workspace" className="flex items-center overflow-hidden ml-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
                alt="NL360"
                className="h-6 w-auto invert"
              />
            </Link>
          )}
          <button
            onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar}
            title="Toggle sidebar"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
          >
            <PanelLeft className="size-4" />
          </button>
        </div>

        {/* ── User card (expanded only) ────────────────────────────── */}
        {isOpen && isAuthed && (
          <div className="mx-2 mt-2 rounded-lg border border-white/[0.10] bg-white/[0.05] p-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {meLoading ? "Cargando..." : displayName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {meLoading ? "" : username}
                </div>
              </div>
              <button
                onClick={onLogout}
                disabled={logoutLoading}
                title="Salir"
                className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <LogOut className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BadgeCheck className="size-3 flex-shrink-0 text-violet-400" />
              <span className="truncate capitalize">{meLoading ? "..." : membership}</span>
            </div>
          </div>
        )}

        {/* User avatar (collapsed only) */}
        {!isOpen && isAuthed && (
          <div className="flex justify-center mt-2 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* ── Nav ─────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">

          {/* Home */}
          <NavLink
            href="/workspace"
            icon={Home}
            label="Home"
            active={pathname === "/workspace"}
            expanded={isOpen}
          />

          {/* Divider */}
          <div className="my-2 h-px bg-sidebar-border mx-1" />

          {/* Agents label */}
          {isOpen && (
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Agentes
            </p>
          )}

          {/* ── Manu Dev group ──────────────────────────────────── */}
          {(() => {
            const groupKey = "/services/manu-dev-group";
            const isAnySubActive = MANU_DEV_SUBAGENTS.some((s) => pathname?.startsWith(s.href));
            const groupExpanded = openAgents[groupKey] ?? false;

            return (
              <div>
                {/* Manu Dev group header — navigates to hub */}
                {isOpen ? (
                  <div className="flex items-center gap-0">
                    <Link
                      href="/services/manu-dev"
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors min-w-0",
                        isAnySubActive
                          ? "bg-white/[0.10] text-foreground font-medium"
                          : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                      )}
                    >
                      <Code2 className="size-4 flex-shrink-0" />
                      <span className="flex-1 truncate">Manu Dev</span>
                    </Link>
                    <button
                      onClick={() => toggleAgent(groupKey)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
                      title="Desplegar agentes"
                    >
                      <ChevronRight
                        className={cn(
                          "size-3.5 transition-transform duration-150",
                          groupExpanded && "rotate-90"
                        )}
                      />
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/services/manu-dev"
                    title="Manu Dev"
                    className={cn(
                      "flex items-center justify-center rounded-lg px-0 py-2 text-sm transition-colors min-w-0",
                      isAnySubActive
                        ? "bg-white/[0.10] text-foreground font-medium"
                        : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                    )}
                  >
                    <Code2 className="size-4 flex-shrink-0" />
                  </Link>
                )}

                {/* Sub-agents */}
                {isOpen && groupExpanded && (
                  <div className="ml-4 mt-0.5 mb-1 border-l border-border pl-2 space-y-0.5">
                    {MANU_DEV_SUBAGENTS.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = pathname?.startsWith(sub.href) ?? false;
                      const historyOpen = openSubHistory[sub.href] ?? false;
                      const projects = getSubProjects(sub.projectsKey);

                      return (
                        <div key={sub.href}>
                          {/* Sub-agent row: name, [+], [▾] */}
                          <div className="flex items-center gap-0">
                            <Link
                              href={sub.href}
                              className={cn(
                                "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors min-w-0",
                                isSubActive
                                  ? "text-foreground bg-white/[0.07] font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                              )}
                            >
                              <SubIcon className="size-3 flex-shrink-0" />
                              <span className="truncate">{sub.label}</span>
                            </Link>
                            <Link
                              href={sub.href}
                              title="Nuevo"
                              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
                            >
                              <Plus className="size-3" />
                            </Link>
                            {projects.length > 0 && (
                              <button
                                onClick={() => toggleSubHistory(sub.href)}
                                title="Historial"
                                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
                              >
                                <ChevronRight
                                  className={cn(
                                    "size-3 transition-transform duration-150",
                                    historyOpen && "rotate-90"
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {/* Project history */}
                          {historyOpen && projects.length > 0 && (
                            <div className="ml-3 mt-0.5 border-l border-border pl-2 space-y-0.5">
                              {projects.slice(0, 6).map((p) => (
                                <Link
                                  key={p.id}
                                  href={`${sub.href}?project=${p.id}`}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors min-w-0",
                                    activeProjectId === String(p.id) && pathname?.startsWith(sub.href)
                                      ? "text-foreground bg-white/[0.07]"
                                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                                      p.status === "active" || p.status === "live"
                                        ? "bg-emerald-400"
                                        : p.status === "building" || p.status === "generating"
                                        ? "bg-amber-400"
                                        : "bg-zinc-500"
                                    )}
                                  />
                                  <span className="truncate">
                                    {projectLabel(sub.projectsKey, p)}
                                  </span>
                                </Link>
                              ))}
                              {/* Marketplace link (Forge only) */}
                              {sub.projectsKey === "forge" && (
                                <Link
                                  href="/services/forge/marketplace"
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors min-w-0",
                                    pathname === "/services/forge/marketplace"
                                      ? "text-foreground bg-white/[0.07]"
                                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                                  )}
                                >
                                  <Layers className="size-3 flex-shrink-0" />
                                  <span className="truncate">Marketplace</span>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Other agents ───────────────────────────────────── */}
          {NAV_AGENTS.map((item) => {
            const active = Boolean(pathname?.startsWith(item.href));
            const isExpanded = openAgents[item.href] ?? false;

            return (
              <div key={item.href}>
                {isOpen ? (
                  <button
                    onClick={() => toggleAgent(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors min-w-0 text-left",
                      active
                        ? "bg-white/[0.10] text-foreground font-medium"
                        : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <ChevronRight
                      className={cn(
                        "size-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-150",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "flex items-center justify-center rounded-lg px-0 py-2 text-sm transition-colors min-w-0",
                      active
                        ? "bg-white/[0.10] text-foreground font-medium"
                        : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 flex-shrink-0" />
                  </Link>
                )}

                {isOpen && isExpanded && (
                  <div className="ml-4 mt-0.5 mb-1 border-l border-border pl-2 space-y-0.5">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors min-w-0",
                        "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                      )}
                    >
                      <Plus className="size-3 flex-shrink-0" />
                      <span className="truncate">{item.newLabel || "Nuevo"}</span>
                    </Link>

                    {item.subItems?.map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors min-w-0",
                            pathname?.startsWith(sub.href)
                              ? "text-foreground bg-white/[0.07]"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                          )}
                        >
                          {SubIcon && <SubIcon className="size-3 flex-shrink-0" />}
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-2 pt-2 border-t border-sidebar-border">
          <NavLink
            href="/cuenta"
            icon={Settings}
            label="Configuracion"
            active={pathname === "/cuenta"}
            expanded={isOpen}
          />
        </div>

        {isOpen && (
          <div className="flex-shrink-0 p-2">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-foreground">Membresia</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Mejora, renueva o cancela tu membresia.
              </p>
              <a
                href="https://nl360.site/niveles-de-membembresia/"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <Globe className="size-3" />
                Membresias
              </a>
            </div>
          </div>
        )}

      </aside>
    </>
  );
}
