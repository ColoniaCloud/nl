"use client";

import { useMemo, type ReactNode } from "react";
import { marked } from "marked";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BaseBubbleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  options?: string[];
}

interface ChatBubbleProps {
  /** The message to render */
  msg: BaseBubbleMessage;
  /** Whether to parse markdown for assistant messages (default: true) */
  markdown?: boolean;
  /** Handler for option buttons */
  onOption?: (opt: string) => void;
  /** Agent-specific content rendered after main text (assistant only) */
  children?: ReactNode;
}

// ─── Prose classes (shared) ───────────────────────────────────────────────────

const PROSE_CLASSES = [
  "prose prose-sm prose-invert max-w-none",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_ul]:list-disc [&_ul]:pl-4",
  "[&_ol]:list-decimal [&_ol]:pl-4",
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm",
].join(" ");

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatBubble({ msg, markdown = true, onOption, children }: ChatBubbleProps) {
  const isUser = msg.role === "user";

  const renderedHtml = useMemo(() => {
    if (isUser || !markdown || !msg.content) return "";
    return marked.parse(msg.content) as string;
  }, [msg.content, isUser, markdown]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={[
          "max-w-[95%] sm:max-w-[80%] text-xs sm:text-sm leading-relaxed",
          isUser
            ? "bg-emerald-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 sm:px-4 py-2.5 sm:py-3 whitespace-pre-wrap"
            : "text-foreground px-1 flex flex-col gap-1",
        ].join(" ")}
      >
        {isUser ? (
          msg.content
        ) : markdown ? (
          <div
            className={PROSE_CLASSES}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        )}

        {/* Streaming cursor */}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-current opacity-60 animate-pulse ml-0.5 rounded-sm" />
        )}

        {/* Option buttons (shared pattern across agents) */}
        {msg.options && msg.options.length > 0 && !msg.streaming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.options.map((opt) => (
              <button
                key={opt}
                onClick={() => onOption?.(opt)}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Agent-specific slot */}
        {!isUser && children}
      </div>
    </div>
  );
}
