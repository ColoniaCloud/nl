"use client";

import { Suspense, useEffect } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from "./Sidebar";
import WorkspaceBar from "./WorkspaceBar";

// Syncs --sidebar-w CSS variable for fixed elements
function SidebarWidthSync() {
  const { open, isMobile } = useSidebar();
  useEffect(() => {
    const w = isMobile ? 0 : open ? 280 : 56;
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    document.documentElement.style.setProperty("--sidebar-pl", `${w}px`);
  }, [open, isMobile]);
  return null;
}

// Main content area — shifts margin-left with the sidebar width
function MainContent({ children }: { children: React.ReactNode }) {
  const { open, isMobile } = useSidebar();
  const pl = isMobile ? 0 : open ? 280 : 56;
  return (
    <main
      className="nl-main nl-workspace-offset bg-background min-h-svh flex-1 transition-[padding-left] duration-200 ease-linear"
      style={{ paddingLeft: `${pl}px` }}
    >
      {children}
    </main>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Global workspace top bar */}
      <WorkspaceBar />
      <SidebarWidthSync />
      <Suspense>
        <AppSidebar />
      </Suspense>
      <MainContent>{children}</MainContent>
    </SidebarProvider>
  );
}
