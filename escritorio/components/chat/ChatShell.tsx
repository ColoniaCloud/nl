"use client";

import { useMemo, useState } from "react";
import type { ChatMessage } from "./types";
import ChatBase, { type ChatMsg } from "./ChatBase";
import VoiceInput from "./VoiceInput";
import { Volume2, VolumeX, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

function uid() {
  return Math.random().toString(16).slice(2);
}

function convId() {
  if (typeof window === "undefined") return "ssr";
  const w = window as any;
  if (!w.__NL360_CONV__) w.__NL360_CONV__ = Math.random().toString(16).slice(2);
  return w.__NL360_CONV__ as string;
}

function agentSlug(agentName: string): "manu" | "grant" | "mentoria" {
  const v = agentName.trim().toLowerCase();
  if (v === "mentoria" || v === "mentoriaia" || v === "mentoria ia") return "mentoria";
  if (v === "manu") return "manu";
  return "grant";
}

const VOICE_ENABLED = process.env.NEXT_PUBLIC_VOICE_FALLBACK === "1";

function canTTS() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speak(text: string, lang = "es-ES") {
  if (!canTTS()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  const preferred =
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("es")) ||
    null;
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

function stopSpeak() {
  if (!canTTS()) return;
  window.speechSynthesis.cancel();
}

// Convert ChatMessage (old type) to ChatMsg (new unified type)
function toBaseMsg(m: ChatMessage): ChatMsg {
  return { id: m.id, role: m.role === "assistant" ? "assistant" : "user", text: m.text };
}

export default function ChatShell({
  agentName,
  seedMessage,
  onUserMessage,
}: {
  agentName: string;
  seedMessage: ChatMessage[];
  onUserMessage?: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessage);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-foreground">{agentName}</div>
          <div className="text-xs text-muted-foreground">Chat · /api/agent-message</div>
        </div>
        <div className="flex items-center gap-1">
          {ttsEnabled && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => stopSpeak()} title="Detener voz">
              <Square className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTtsEnabled((v) => !v)}
            title={ttsEnabled ? "Voz ON" : "Voz OFF"}
          >
            {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        </div>
      </div>
    ),
    [agentName, ttsEnabled]
  );

  async function sendText(rawText: string) {
    const text = rawText.trim();
    if (!text || isSending) return;

    onUserMessage?.(text);

    const userMsg: ChatMessage = { id: uid(), role: "user", text, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const r = await fetch("/api/agent-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId(),
          agent: agentSlug(agentName),
          message: { text },
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", text: `Error API (${r.status}): ${errText}`, createdAt: Date.now() },
        ]);
        return;
      }

      const data = (await r.json()) as { assistant: ChatMessage };
      setMessages((prev) => [...prev, data.assistant]);
      if (ttsEnabled && data?.assistant?.text) speak(data.assistant.text);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", text: `Error de red: ${e?.message ?? "unknown"}`, createdAt: Date.now() },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    await sendText(text);
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex h-full w-full md:w-[45%] min-w-0 md:min-w-[320px] flex-col">
        <ChatBase
          messages={messages.map(toBaseMsg)}
          input={input}
          onInputChange={setInput}
          onSend={onSend}
          sending={isSending}
          headerSlot={header}
          footerExtra={
            VOICE_ENABLED ? (
              <VoiceInput
                disabled={isSending}
                lang="es-ES"
                onText={(t) => { setInput(t); sendText(t); }}
              />
            ) : undefined
          }
          fullHeight
        />
      </div>
    </div>
  );
}
