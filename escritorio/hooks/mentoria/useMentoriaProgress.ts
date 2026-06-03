import { useCallback, useState } from "react";
import type { ToolDef } from "./types";
import { apiFetchSessions } from "./api";

// Per-tool lesson progress as shown on the dashboard cards.
export type DashboardProgressEntry = {
  completed: number;
  totalLessons: number;
  isComplete: boolean;
};

export type DashboardProgressMap = Record<string, DashboardProgressEntry | null>;

export function useMentoriaProgress({ availableTools }: { availableTools: ToolDef[] }) {
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [sessionHasMore, setSessionHasMore] = useState<Record<string, boolean>>({});
  const [dashboardProgress, setDashboardProgress] = useState<DashboardProgressMap>({});
  const [progressLoading, setProgressLoading] = useState(false);

  // Refresh lesson progress for all tools when dashboard shown
  const refreshProgress = useCallback(async () => {
    const tools = availableTools;
    if (tools.length === 0) return;
    setProgressLoading(true);
    const results = await Promise.allSettled(
      tools.map((t) =>
        fetch(`/api/mentoria/progress?tool=${encodeURIComponent(t.id)}`, { cache: "no-store" })
          .then((r) => r.json())
      )
    );
    const next: DashboardProgressMap = {};
    tools.forEach((t, i) => {
      const r = results[i];
      if (r.status === "fulfilled" && r.value?.ok && r.value.progress) {
        const p = r.value.progress;
        next[t.id] = {
          completed: Array.isArray(p.completed) ? p.completed.length : 0,
          totalLessons: p.totalLessons ?? 0,
          isComplete: !!p.isComplete,
        };
      } else {
        next[t.id] = null;
      }
    });
    setDashboardProgress(next);
    setProgressLoading(false);
  }, [availableTools]);

  // Refresh session counts when dashboard shown
  const refreshCounts = useCallback(async () => {
    const tools = availableTools;
    if (tools.length === 0) return;
    const results = await Promise.all(tools.map((t) => apiFetchSessions(t.id)));
    const counts: Record<string, number> = {};
    const more: Record<string, boolean> = {};
    tools.forEach((t, i) => {
      counts[t.id] = results[i].sessions.length;
      more[t.id] = results[i].hasMore;
    });
    setSessionCounts(counts);
    setSessionHasMore(more);
  }, [availableTools]);

  // Optimistic +/- adjustment of a tool's session count (used by history
  // delete/restore so the dashboard badge stays in sync without a refetch).
  const adjustSessionCount = useCallback((toolId: string, delta: number) => {
    setSessionCounts((prev) => ({
      ...prev,
      [toolId]: Math.max(0, (prev[toolId] ?? (delta > 0 ? 0 : 1)) + delta),
    }));
  }, []);

  return {
    sessionCounts,
    sessionHasMore,
    dashboardProgress,
    progressLoading,
    refreshCounts,
    refreshProgress,
    adjustSessionCount,
  };
}
