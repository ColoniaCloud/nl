"use client";

import React, { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  extra?: React.ReactNode;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  placeholder = "Escribe un mensaje...",
  extra,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !sending && !disabled;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-[24px] border border-border bg-card shadow-sm transition-colors focus-within:border-muted-foreground/40",
        className
      )}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        placeholder={placeholder}
        className="nl-textarea w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        {extra && <div className="flex-1 min-w-0">{extra}</div>}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "nl-send-btn ml-auto flex items-center justify-center rounded-full transition-colors focus-visible:outline-none",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          aria-label="Enviar mensaje"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
