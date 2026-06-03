import { useEffect, useState } from "react";
import type { SessionMeta, ToolDef, SearchHit, Step } from "./types";
import {
  apiFetchSessions,
  apiRenameSession,
  apiDeleteSession,
  apiRestoreSession,
  apiSearch,
} from "./api";

export type { SearchHit } from "./types";

export type ShareModalState =
  | { status: "loading"; sessionId: string; title: string }
  | { status: "ready"; sessionId: string; title: string; url: string; copied: boolean; ttlDays: number }
  | { status: "error"; sessionId: string; title: string; message: string }
  | null;

export function useMentoriaHistory({
  setStep,
  onCountChange,
}: {
  setStep: (step: Step) => void;
  onCountChange: (toolId: string, delta: number) => void;
}) {
  const [historyTool, setHistoryTool] = useState<ToolDef | null>(null);
  const [historySessions, setHistorySessions] = useState<SessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState<boolean>(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  // Papelera
  const [historyView, setHistoryView] = useState<"active" | "trash">("active");
  const [trashSessions, setTrashSessions] = useState<SessionMeta[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashCursor, setTrashCursor] = useState<string | null>(null);
  const [trashHasMore, setTrashHasMore] = useState<boolean>(false);
  const [trashLoadingMore, setTrashLoadingMore] = useState<boolean>(false);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | null>(null);
  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  // Share modal
  const [shareModal, setShareModal] = useState<ShareModalState>(null);

  // Debounced search: runs when user types in the history search box.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const hits = await apiSearch(q, historyTool?.id);
      setSearchResults(hits);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, historyTool]);

  async function openHistory(tool: ToolDef) {
    setHistoryTool(tool);
    setHistorySessions([]);
    setHistoryCursor(null);
    setHistoryHasMore(false);
    setHistoryLoading(true);
    setStep("history");
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(tool.id);
    setHistorySessions(sessions);
    setHistoryHasMore(hasMore);
    setHistoryCursor(nextCursor);
    setHistoryLoading(false);
  }

  async function loadMoreHistory() {
    if (!historyTool || !historyCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(historyTool.id, {
      before: historyCursor,
    });
    setHistorySessions((prev) => [...prev, ...sessions]);
    setHistoryHasMore(hasMore);
    setHistoryCursor(nextCursor);
    setHistoryLoadingMore(false);
  }

  async function renameHistorySession(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = await apiRenameSession(id, trimmed.slice(0, 200));
    if (ok) {
      setHistorySessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed.slice(0, 200) } : s))
      );
    }
  }

  async function deleteSession(id: string) {
    // Soft-delete: goes to trash, reversible.
    const ok = await apiDeleteSession(id, false);
    if (!ok) return;
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    if (historyTool) onCountChange(historyTool.id, -1);
  }

  async function loadTrash(tool: ToolDef) {
    setTrashLoading(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(tool.id, {
      trashed: true,
    });
    setTrashSessions(sessions);
    setTrashHasMore(hasMore);
    setTrashCursor(nextCursor);
    setTrashLoading(false);
  }

  async function loadMoreTrash() {
    if (!historyTool || !trashCursor || trashLoadingMore) return;
    setTrashLoadingMore(true);
    const { sessions, hasMore, nextCursor } = await apiFetchSessions(historyTool.id, {
      before: trashCursor,
      trashed: true,
    });
    setTrashSessions((prev) => [...prev, ...sessions]);
    setTrashHasMore(hasMore);
    setTrashCursor(nextCursor);
    setTrashLoadingMore(false);
  }

  async function restoreFromTrash(id: string) {
    const ok = await apiRestoreSession(id);
    if (!ok) return;
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    if (historyTool) onCountChange(historyTool.id, 1);
  }

  async function permanentDelete(id: string) {
    const ok = await apiDeleteSession(id, true);
    if (!ok) return;
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    setConfirmPermanentId(null);
  }

  return {
    // state
    historyTool,
    historySessions,
    historyLoading,
    historyHasMore,
    historyLoadingMore,
    renamingId,
    renameValue,
    historyView,
    trashSessions,
    trashLoading,
    trashHasMore,
    trashLoadingMore,
    confirmPermanentId,
    searchQuery,
    searchResults,
    searchLoading,
    shareModal,
    // setters consumed by the view
    setRenamingId,
    setRenameValue,
    setHistoryView,
    setConfirmPermanentId,
    setSearchQuery,
    setShareModal,
    // actions
    openHistory,
    loadMoreHistory,
    renameHistorySession,
    deleteSession,
    loadTrash,
    loadMoreTrash,
    restoreFromTrash,
    permanentDelete,
  };
}
