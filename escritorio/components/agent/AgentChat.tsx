"use client";

import React, { useEffect, useState } from "react";
import ChatBase, { type ChatMsg } from "@/components/chat/ChatBase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type UIBlock =
  | { type: "choices"; id: string; label?: string; choices: { id: string; label: string }[] }
  | {
      type: "color_picker";
      id: string;
      label?: string;
      suggested: { id: string; hex: string; name?: string }[];
      allow_custom?: boolean;
      mode?: "primary_then_secondary" | "any";
    }
  | { type: "image"; id: string; url: string; alt?: string; caption?: string }
  | { type: "text_hint"; id: string; text: string };

type AgentResponse = {
  ok: boolean;
  reply_text: string;
  ui?: UIBlock[];
  state?: any;
  status?: "collecting" | "ready" | "creating" | "done";
  action?: null | { type: "navigate"; href: string } | { type: "toast"; message: string };
};

type AgentMessage =
  | { role: "agent"; text: string; ui?: UIBlock[] }
  | { role: "user"; text: string };

function uid() {
  return Math.random().toString(16).slice(2);
}

function isHexColor(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

// ─── UIRenderer ───────────────────────────────────────────────────────────────

function UIRenderer({
  block,
  onChoice,
  onPickColor,
}: {
  block: UIBlock;
  onChoice: (id: string, label: string) => void;
  onPickColor: (blockId: string, hex: string) => void;
}) {
  if (block.type === "text_hint") {
    return <p className="text-xs text-muted-foreground">{block.text}</p>;
  }

  if (block.type === "image") {
    return (
      <div className="space-y-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.url} alt={block.alt || "imagen"} className="w-full max-w-sm rounded-lg border border-border" />
        {block.caption && <p className="text-xs text-muted-foreground">{block.caption}</p>}
      </div>
    );
  }

  if (block.type === "choices") {
    return (
      <div className="space-y-2">
        {block.label && <p className="text-xs font-medium text-muted-foreground">{block.label}</p>}
        <div className="flex flex-wrap gap-2">
          {block.choices.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              size="sm"
              onClick={() => onChoice(c.id, c.label)}
              className="h-auto py-1.5 text-xs"
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "color_picker") {
    return (
      <div className="space-y-2">
        {block.label && <p className="text-xs font-medium text-muted-foreground">{block.label}</p>}
        <div className="flex flex-wrap gap-2">
          {block.suggested.map((c) => (
            <button
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => onPickColor(block.id, c.hex)}
              title={c.name || c.hex}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: c.hex }} />
              <span>{c.name || c.hex}</span>
            </button>
          ))}
        </div>
        {block.allow_custom && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Otro:</span>
            <input
              type="color"
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
              onChange={(e) => onPickColor(block.id, e.target.value)}
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── AgentChat ────────────────────────────────────────────────────────────────

export default function AgentChat({
  agent,
  endpoint = "/api/agent-message",
  conversationId,
}: {
  agent: string;
  endpoint?: string;
  conversationId: string;
}) {
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<any>({});

  async function sendPayload(payload: { message?: string; choice_id?: string; ui_value?: any }) {
    try {
      setSending(true);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          agent,
          message: payload.message ?? null,
          choice_id: payload.choice_id ?? null,
          ui_value: payload.ui_value ?? null,
          state,
        }),
      });

      const data = (await res.json()) as AgentResponse;
      if (!data?.ok) {
        setAgentMessages((prev) => [...prev, { role: "agent", text: "Tuve un problema con el servidor. Probá de nuevo." }]);
        return;
      }

      if (typeof data.state !== "undefined") setState(data.state);
      setAgentMessages((prev) => [...prev, { role: "agent", text: data.reply_text || "...", ui: data.ui || [] }]);

      if (data.action?.type === "navigate" && data.action.href) {
        window.location.href = data.action.href;
      }
    } catch {
      setAgentMessages((prev) => [...prev, { role: "agent", text: "Error de red. Revisá tu conexión." }]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (agentMessages.length > 0) return;
    sendPayload({ message: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setAgentMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    await sendPayload({ message: text });
  }

  async function onChoice(choiceId: string, label: string) {
    if (sending) return;
    setAgentMessages((prev) => [...prev, { role: "user", text: label }]);
    await sendPayload({ choice_id: choiceId });
  }

  async function onPickColor(blockId: string, hex: string) {
    if (!isHexColor(hex) || sending) return;
    setAgentMessages((prev) => [...prev, { role: "user", text: `Color: ${hex}` }]);
    await sendPayload({ ui_value: { type: "color", block_id: blockId, hex } });
  }

  // Convert internal AgentMessage to ChatMsg, attaching UI blocks as extra
  const msgs: ChatMsg[] = agentMessages.map((m, i) => ({
    id: String(i),
    role: m.role === "agent" ? "agent" : "user",
    text: m.text,
    extra:
      m.role === "agent" && m.ui && m.ui.length > 0 ? (
        <div className="space-y-3 pt-1">
          {m.ui.map((block) => (
            <UIRenderer key={block.id} block={block} onChoice={onChoice} onPickColor={onPickColor} />
          ))}
        </div>
      ) : undefined,
  }));

  return (
    <div className="flex h-[calc(100vh-64px)] w-full items-start justify-center">
      <div className="flex h-full w-full md:w-[45%] min-w-0 md:min-w-[320px] flex-col">
        <ChatBase
          messages={msgs}
          input={input}
          onInputChange={setInput}
          onSend={onSend}
          sending={sending}
          placeholder="Escribi tu mensaje..."
          footerExtra={
            <p className="text-xs text-muted-foreground">
              Tip: si el agente te da botones, podes tocar una opcion sin escribir.
            </p>
          }
          fullHeight
        />
      </div>
    </div>
  );
}
