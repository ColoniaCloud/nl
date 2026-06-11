"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import AgentInput from "./AgentInput";

export type ChatRole = "user" | "assistant" | "agent";

export interface ChatMsg {
  id: string;
  role: ChatRole;
  text: string;
  extra?: React.ReactNode;
}

interface ChatBaseProps {
  messages: ChatMsg[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
  headerSlot?: React.ReactNode;
  footerExtra?: React.ReactNode;
  fullHeight?: boolean;
  className?: string;
}

export default function ChatBase({
  messages,
  input,
  onInputChange,
  onSend,
  sending,
  placeholder = "Escribe un mensaje...",
  headerSlot,
  footerExtra,
  fullHeight = true,
  className,
}: ChatBaseProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        fullHeight && "h-full",
        className
      )}
    >
      {/* Header */}
      {headerSlot && (
        <div className="flex-shrink-0 border-b border-border px-4 py-3">
          {headerSlot}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 px-4 py-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "nl-bubble rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground border border-border"
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.extra && <div className="mt-3">{m.extra}</div>}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-muted border border-border px-4 py-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-3">
        <AgentInput
          value={input}
          onChange={onInputChange}
          onSend={onSend}
          sending={sending}
          disabled={sending}
          placeholder={placeholder}
          extra={footerExtra}
        />
      </div>
    </div>
  );
}
