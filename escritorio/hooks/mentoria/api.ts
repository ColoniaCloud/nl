// Pure helpers and fetch wrappers for the MentorIA feature. No React state here
// — these are shared by the session / history / progress hooks and the page.

import type { Message, StoredMessage, SessionMeta, SearchHit } from "./types";

export function genId() {
  // Prefer crypto.randomUUID (CHAR(36) compatible); fallback for old browsers
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toStored(messages: Message[]): StoredMessage[] {
  return messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
}

export function fromStored(stored: StoredMessage[]): Message[] {
  return stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

export async function apiFetchSessions(
  tool: string,
  opts: { before?: string | null; limit?: number; q?: string; trashed?: boolean } = {}
): Promise<{ sessions: SessionMeta[]; hasMore: boolean; nextCursor: string | null }> {
  try {
    const params = new URLSearchParams({ tool });
    if (opts.before) params.set("before", opts.before);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    if (opts.trashed) params.set("trashed", "1");
    const res = await fetch(`/api/mentoria/sessions?${params.toString()}`);
    if (!res.ok) return { sessions: [], hasMore: false, nextCursor: null };
    const data = await res.json();
    return {
      sessions: data.sessions ?? [],
      hasMore: !!data.hasMore,
      nextCursor: data.nextCursor ?? null,
    };
  } catch {
    return { sessions: [], hasMore: false, nextCursor: null };
  }
}

export async function apiRenameSession(id: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetchNotes(tool: string): Promise<string> {
  try {
    const res = await fetch(`/api/mentoria/notes?tool=${tool}`);
    if (!res.ok) return "";
    const data = await res.json();
    return typeof data.content === "string" ? data.content : "";
  } catch {
    return "";
  }
}

export async function apiSaveNotes(tool: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiUpsertSession(
  id: string,
  tool: string,
  messages: Message[]
): Promise<{ ok: boolean; tooLarge?: boolean }> {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return { ok: true };
  const title =
    userMsgs[0].content.slice(0, 100) + (userMsgs[0].content.length > 100 ? "..." : "");

  const body = JSON.stringify({ id, tool, title, messages: toStored(messages) });

  // Retry up to 3 times with exponential backoff (300ms, 800ms)
  const delays = [0, 300, 800];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const res = await fetch("/api/mentoria/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return { ok: true };
      if (res.status === 413) return { ok: false, tooLarge: true };
      // 4xx: don't retry (client error — payload invalid, auth, etc.)
      if (res.status >= 400 && res.status < 500) return { ok: false };
    } catch {
      // network error — retry
    }
  }
  return { ok: false };
}

/** Fire-and-forget save using sendBeacon for page-unload path. */
export function beaconUpsertSession(id: string, tool: string, messages: Message[]): void {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const title =
    userMsgs[0].content.slice(0, 100) + (userMsgs[0].content.length > 100 ? "..." : "");
  const body = JSON.stringify({ id, tool, title, messages: toStored(messages) });
  try {
    navigator.sendBeacon(
      "/api/mentoria/sessions",
      new Blob([body], { type: "application/json" })
    );
  } catch {
    // ignore — best-effort path on unload
  }
}

export async function apiDeleteSession(id: string, permanent = false): Promise<boolean> {
  try {
    const qs = permanent ? "?permanent=1" : "";
    const res = await fetch(`/api/mentoria/sessions/${id}${qs}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiRestoreSession(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Incremental append — returns the new server seq on success,
 *  "mismatch" if the seqs got out of sync (caller should full-upsert),
 *  "too_large" if the server rejected the payload,
 *  or null on other failures. */
export async function apiAppendMessages(
  sessionId: string,
  baseSeq: number,
  tail: Message[]
): Promise<number | "mismatch" | "too_large" | null> {
  if (tail.length === 0) return baseSeq;
  try {
    const res = await fetch(`/api/mentoria/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSeq, messages: toStored(tail) }),
    });
    if (res.ok) {
      const d = await res.json();
      return typeof d.newSeq === "number" ? d.newSeq : baseSeq + tail.length;
    }
    if (res.status === 409) return "mismatch";
    if (res.status === 413) return "too_large";
    return null;
  } catch {
    return null;
  }
}

export async function apiSearch(q: string, tool?: string): Promise<SearchHit[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const params = new URLSearchParams({ q: q.trim() });
    if (tool) params.set("tool", tool);
    const res = await fetch(`/api/mentoria/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export function downloadSessionExport(sessionId: string, format: "md" | "json") {
  const url = `/api/mentoria/sessions/${sessionId}/export?format=${format}`;
  // Use a hidden anchor to trigger browser download with cookies.
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function createShareLink(
  sessionId: string
): Promise<{ url: string; token: string; ttlDays: number } | { error: string }> {
  try {
    const res = await fetch(`/api/mentoria/sessions/${sessionId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.error || `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data.ok || !data.token) return { error: "invalid_response" };
    const absolute =
      typeof window !== "undefined"
        ? `${window.location.origin}/share/${data.token}`
        : `/share/${data.token}`;
    return { url: absolute, token: data.token, ttlDays: Number(data.ttlDays) || 30 };
  } catch {
    return { error: "network" };
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function downloadSummaryPDF(
  toolTitle: string,
  summaryText: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Header
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MentorIA — Resumen de Progreso", margin, 12);

  // Subheader
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const now = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`${toolTitle}  ·  Generado el ${now}`, margin, 17);

  // Divider
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.3);
  doc.line(margin, 23, pageW - margin, 23);

  // Body
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(summaryText, contentW);
  let y = 30;
  const lineH = 5.5;
  const pageH = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Pagina ${i} de ${totalPages}  ·  MentorIA by NL360`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  doc.save(`mentoria-resumen-${Date.now()}.pdf`);
}
