import { useEffect, useRef, useState } from "react";
import type { Message, SessionMeta, ToolDef, Step } from "./types";
import {
  genId,
  toStored,
  fromStored,
  apiFetchSessions,
  apiUpsertSession,
  beaconUpsertSession,
  apiDeleteSession,
  apiAppendMessages,
  downloadSummaryPDF,
} from "./api";

export type ActiveProgress = {
  currentLessonId: number;
  completed: number[];
  totalLessons: number;
  isComplete: boolean;
};

export function useMentoriaSession({
  step,
  setStep,
}: {
  step: Step;
  setStep: (step: Step) => void;
}) {
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(genId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probingTool, setProbingTool] = useState<string | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [sizeWarnDismissed, setSizeWarnDismissed] = useState<boolean>(false);
  // Progress state for the active tool (lesson id + completed lessons).
  const [progress, setProgress] = useState<ActiveProgress | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Sessions quick-access modal (chat header)
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [sessionsModalData, setSessionsModalData] = useState<SessionMeta[]>([]);
  const [sessionsModalLoading, setSessionsModalLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputBtnPressed = useRef(false);
  // Track last serialized messages to skip redundant saves
  const lastSavedRef = useRef<string>("");
  // Number of messages already synced to the server (seq in mt_messages).
  // Used for incremental append — if this matches server count we only send
  // the tail. On mismatch (409) we fall back to a full upsert.
  const syncedSeqRef = useRef<number>(0);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Reset the "chat muy largo" dismissal whenever we change session.
  useEffect(() => {
    setSizeWarnDismissed(false);
  }, [currentSessionId]);

  // ── Autosave: debounced save on every message change ─────────────────────────
  // Strategy: when messages only grew at the tail (and server's syncedSeq
  // matches what we think it has), send just the tail via the incremental
  // append endpoint. Otherwise fall back to a full upsert.
  useEffect(() => {
    if (!activeTool || step !== "chat") return;
    if (messages.filter((m) => m.role === "user").length === 0) return;

    const serialized = JSON.stringify(toStored(messages));
    if (serialized === lastSavedRef.current) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      const base = syncedSeqRef.current;
      const canAppend =
        base > 0 &&
        messages.length > base &&
        // Prefix must be unchanged — an append can't rewrite history.
        // We detect that by checking the serialized length prefix is stable;
        // if any earlier message was edited, we fall back to full upsert.
        lastSavedRef.current.length > 0 &&
        serialized.startsWith(lastSavedRef.current.slice(0, -1)); // strip trailing ']'

      if (canAppend) {
        const tail = messages.slice(base);
        const r = await apiAppendMessages(currentSessionId, base, tail);
        if (typeof r === "number") {
          syncedSeqRef.current = r;
          lastSavedRef.current = serialized;
          setSaveStatus("saved");
          setSavedAt(new Date());
          return;
        }
        if (r === "too_large") {
          setSaveStatus("error");
          setError("La sesion es demasiado grande. Inicia un chat nuevo para continuar.");
          return;
        }
        // "mismatch" or null → fall through to full upsert
      }

      const res = await apiUpsertSession(currentSessionId, activeTool.id, messages);
      if (res.ok) {
        lastSavedRef.current = serialized;
        syncedSeqRef.current = messages.length;
        setSaveStatus("saved");
        setSavedAt(new Date());
      } else {
        setSaveStatus("error");
        if (res.tooLarge) {
          setError("La sesion es demasiado grande. Inicia un chat nuevo para continuar.");
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [messages, activeTool, step, currentSessionId]);

  // ── Best-effort save on page unload ──────────────────────────────────────────
  useEffect(() => {
    if (!activeTool || step !== "chat") return;
    const handler = () => {
      const serialized = JSON.stringify(toStored(messages));
      if (serialized === lastSavedRef.current) return;
      beaconUpsertSession(currentSessionId, activeTool.id, messages);
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [messages, activeTool, step, currentSessionId]);

  // Reset save state when switching session
  useEffect(() => {
    lastSavedRef.current = "";
    syncedSeqRef.current = 0;
    setSaveStatus("idle");
    setSavedAt(null);
  }, [currentSessionId]);

  // ── Session helpers ───────────────────────────────────────────────────────────

  async function saveCurrentSession(tool: ToolDef, msgs: Message[], sessionId: string) {
    if (msgs.filter((m) => m.role === "user").length === 0) return;
    const res = await apiUpsertSession(sessionId, tool.id, msgs);
    if (res.ok) {
      lastSavedRef.current = JSON.stringify(toStored(msgs));
      syncedSeqRef.current = msgs.length;
      setSaveStatus("saved");
      setSavedAt(new Date());
    } else {
      setSaveStatus("error");
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  async function goBack() {
    if (activeTool) await saveCurrentSession(activeTool, messages, currentSessionId);
    setStep("dashboard");
    setActiveTool(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function startNewChat() {
    if (!activeTool) return;
    await saveCurrentSession(activeTool, messages, currentSessionId);
    setCurrentSessionId(genId());
    setMessages([
      {
        id: "init",
        role: "agent",
        content: activeTool.initialContent,
        options: activeTool.initialOptions,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setError(null);
  }

  async function openSessionsModal() {
    if (!activeTool) return;
    setSessionsModalOpen(true);
    setSessionsModalLoading(true);
    const { sessions } = await apiFetchSessions(activeTool.id);
    setSessionsModalData(sessions);
    setSessionsModalLoading(false);
  }

  async function loadSessionFromModal(session: SessionMeta) {
    if (!activeTool) return;
    // Save current session first
    await saveCurrentSession(activeTool, messages, currentSessionId);
    // Load the selected session
    try {
      const res = await fetch(`/api/mentoria/sessions/${session.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentSessionId(session.id);
      const loaded = fromStored(data.messages);
      setMessages(loaded);
      syncedSeqRef.current = typeof data.seq === "number" ? data.seq : loaded.length;
      lastSavedRef.current = JSON.stringify(toStored(loaded));
      setSessionsModalOpen(false);
      setError(null);
    } catch {
      setError("No se pudo cargar la sesion.");
    }
  }

  async function deleteSessionFromModal(id: string) {
    await apiDeleteSession(id);
    setSessionsModalData((prev) => prev.filter((s) => s.id !== id));
  }

  async function probe(): Promise<boolean> {
    try {
      const res = await fetch("/api/mentoria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (res.status === 401) throw new Error("Sesion expirada. Recarga la pagina.");
      if (!res.ok) throw new Error("No se pudo conectar con MentorIA.");
      return true;
    } catch (e: any) {
      setProbeError(e.message || "Error al conectar. Intenta de nuevo.");
      return false;
    }
  }

  async function selectTool(tool: ToolDef) {
    setProbeError(null);
    setProbingTool(tool.id);
    const ok = await probe();
    setProbingTool(null);
    if (!ok) return;
    setCurrentSessionId(genId());
    setActiveTool(tool);
    setStep("chat");
    setMessages([
      {
        id: "init",
        role: "agent",
        content: tool.initialContent,
        options: tool.initialOptions,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    // Fetch current progress for this subagent (fire-and-forget).
    (async () => {
      try {
        const r = await fetch(`/api/mentoria/progress?tool=${tool.id}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d?.ok && d.progress) {
          setProgress({
            currentLessonId: d.progress.currentLessonId,
            completed: d.progress.completed ?? [],
            totalLessons: d.progress.totalLessons,
            isComplete: !!d.progress.isComplete,
          });
        }
      } catch {}
    })();
  }

  async function loadSession(session: SessionMeta, tool: ToolDef) {
    setProbeError(null);
    setProbingTool(tool.id);
    const ok = await probe();
    setProbingTool(null);
    if (!ok) return;
    try {
      const res = await fetch(`/api/mentoria/sessions/${session.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveTool(tool);
      setCurrentSessionId(session.id);
      const loaded = fromStored(data.messages);
      setMessages(loaded);
      syncedSeqRef.current = typeof data.seq === "number" ? data.seq : loaded.length;
      lastSavedRef.current = JSON.stringify(toStored(loaded));
      setStep("chat");
      setError(null);
    } catch {
      setProbeError("No se pudo cargar la sesion. Intenta de nuevo.");
    }
  }

  // ── Summary PDF ───────────────────────────────────────────────────────────────

  async function handleSummary() {
    if (!activeTool || summaryLoading) return;
    setSummaryLoading(true);
    setError(null);

    try {
      // Ensure the latest messages are persisted so the server reads fresh data.
      // Falls back to sending the messages inline if the save fails (offline, etc).
      const persisted = await apiUpsertSession(
        currentSessionId,
        activeTool.id,
        messages
      );
      if (persisted.ok) {
        lastSavedRef.current = JSON.stringify(toStored(messages));
        syncedSeqRef.current = messages.length;
        setSaveStatus("saved");
        setSavedAt(new Date());
      }

      const body = persisted.ok
        ? { sessionId: currentSessionId }
        : { tool: activeTool.id, messages: toStored(messages) };

      const res = await fetch("/api/mentoria/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo generar el resumen.");
      }
      await downloadSummaryPDF(activeTool.title, data.reply);
    } catch (e: any) {
      setError(e.message || "No se pudo generar el resumen.");
    } finally {
      setSummaryLoading(false);
    }
  }

  // ── handleSend ───────────────────────────────────────────────────────────────

  async function handleSend(text?: string) {
    const content = (text || input).trim();
    if (!content || !activeTool || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    // Pre-seed the agent bubble so tokens can stream into it
    const agentMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: agentMsgId,
        role: "agent",
        content: "",
        options: [],
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setLoading(true);
    setShowWarmup(false);
    setError(null);
    const warmupTimer = activeTool.provider === "nvidia_nim"
      ? setTimeout(() => setShowWarmup(true), 8_000)
      : null;

    const history = messages
      .filter((m) => m.id !== "init")
      .map((m) => ({
        role: m.role === "agent" ? ("model" as const) : ("user" as const),
        parts: m.content,
      }));

    try {
      const res = await fetch("/api/mentoria/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: activeTool.id, history, message: content }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const secs = data.retryAfter || 10;
        throw new Error(
          data.message || `Estas enviando mensajes muy rapido. Espera ${secs}s.`
        );
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error desconocido del servidor.");
      }

      // ── SSE consumer ──────────────────────────────────────────────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let currentEvent = "";
      let accumulatedReply = "";
      let finalOptions: string[] = [];
      let streamError: string | null = null;

      const applyLine = (line: string) => {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          try {
            const data = JSON.parse(payload);
            if (currentEvent === "delta" && typeof data.text === "string") {
              accumulatedReply += data.text;
              // Live update of the agent bubble
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: accumulatedReply } : m
                )
              );
            } else if (currentEvent === "done") {
              if (typeof data.reply === "string") accumulatedReply = data.reply;
              if (Array.isArray(data.options))
                finalOptions = data.options.map(String);
              // If the backend detected [AVANZAR] and advanced the progress,
              // update local state so the UI reflects the new lesson.
              if (data.advanced && typeof data.advanced === "object") {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentLessonId: Number(data.advanced.currentLessonId) || prev.currentLessonId,
                        completed: Array.isArray(data.advanced.completed)
                          ? data.advanced.completed
                          : prev.completed,
                        isComplete: !!data.advanced.isComplete,
                      }
                    : prev
                );
              }
            } else if (currentEvent === "error") {
              streamError = String(data.message || "Error de MentorIA.");
            }
          } catch {
            // ignore malformed chunks
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line (\n\n)
        let idx;
        while ((idx = sseBuffer.indexOf("\n\n")) !== -1) {
          const frame = sseBuffer.slice(0, idx);
          sseBuffer = sseBuffer.slice(idx + 2);
          frame.split("\n").forEach(applyLine);
          currentEvent = "";
        }
      }

      if (streamError) throw new Error(streamError);

      // Final apply with options + canonical reply
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content: accumulatedReply || m.content,
                options: finalOptions,
              }
            : m
        )
      );
    } catch (e: any) {
      // Roll back the empty agent bubble on error
      setMessages((prev) => prev.filter((m) => m.id !== agentMsgId));
      setError(e.message || "Error de conexion. Intenta de nuevo.");
    } finally {
      if (warmupTimer) clearTimeout(warmupTimer);
      setShowWarmup(false);
      setLoading(false);
    }
  }

  return {
    // state
    activeTool,
    messages,
    currentSessionId,
    input,
    loading,
    showWarmup,
    summaryLoading,
    error,
    probingTool,
    probeError,
    sizeWarnDismissed,
    progress,
    saveStatus,
    savedAt,
    sessionsModalOpen,
    sessionsModalData,
    sessionsModalLoading,
    // refs
    chatEndRef,
    textareaRef,
    inputBtnPressed,
    // setters consumed by the view
    setInput,
    setError,
    setProbeError,
    setSizeWarnDismissed,
    setSessionsModalOpen,
    // actions
    goBack,
    startNewChat,
    openSessionsModal,
    loadSessionFromModal,
    deleteSessionFromModal,
    selectTool,
    loadSession,
    handleSummary,
    handleSend,
  };
}
