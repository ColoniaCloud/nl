"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MetricasTab from "@/components/admin/MetricasTab";
import SettersTab from "@/components/admin/SettersTab";
import UsuariosTab from "@/components/admin/UsuariosTab";
import CrearCuentaTab from "@/components/admin/CrearCuentaTab";
import TransferenciasTab from "@/components/admin/TransferenciasTab";
import ReferidosTab from "@/components/admin/ReferidosTab";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const ADMIN_TABS = [
  { id: "metricas",       label: "Métricas" },
  { id: "usuarios",       label: "Usuarios" },
  { id: "crear-cuenta",   label: "Crear Cuenta" },
  { id: "setters",        label: "Setters" },
  { id: "transferencias", label: "Transferencias" },
  { id: "referidos",      label: "Referidos" },
];

const SETTER_TABS = [
  { id: "mis-clientes",  label: "Mis Clientes" },
  { id: "crear-cliente", label: "Crear Cliente" },
  { id: "mi-actividad",  label: "Mi Actividad" },
];

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function PanelInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState("");
  const [userRole, setUserRole] = useState<"administrator" | "nl_setters" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;

        const roles: string[] = data?.user?.roles ?? [];
        const isAdmin = roles.includes("administrator");
        const isSetter = roles.includes("nl_setters");

        if (!isAdmin && !isSetter) {
          router.replace("/workspace");
          return;
        }

        const role = isAdmin ? "administrator" : "nl_setters";
        setUserRole(role);

        const tabs = isAdmin ? ADMIN_TABS : SETTER_TABS;
        const tabParam = searchParams.get("tab");
        const validTab = tabs.find((t) => t.id === tabParam);
        setActiveTab(validTab ? validTab.id : tabs[0].id);

        setLoading(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const tabs = userRole === "administrator" ? ADMIN_TABS : SETTER_TABS;
  const title = userRole === "administrator" ? "Administración" : "Panel de control";
  const activeTabConfig = tabs.find((t) => t.id === activeTab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/[0.10] mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              "border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-violet-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/[0.20]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-white/[0.10] bg-zinc-900/60 backdrop-blur-sm">
        {activeTab === "metricas" && <MetricasTab />}
        {activeTab === "setters" && <SettersTab />}
        {activeTab === "usuarios" && <UsuariosTab />}
        {activeTab === "crear-cuenta" && <CrearCuentaTab userRole={userRole!} />}
        {activeTab === "crear-cliente" && <CrearCuentaTab userRole={userRole!} />}
        {activeTab === "transferencias" && <TransferenciasTab />}
        {activeTab === "referidos" && <ReferidosTab />}
        {activeTab !== "metricas" && activeTab !== "setters" && activeTab !== "usuarios" && activeTab !== "crear-cuenta" && activeTab !== "crear-cliente" && activeTab !== "transferencias" && activeTab !== "referidos" && (
          <div className="py-12 text-center text-zinc-500">
            {activeTabConfig?.label} — próximamente
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AdminPanelPage() {
  return (
    <Suspense>
      <PanelInner />
    </Suspense>
  );
}
