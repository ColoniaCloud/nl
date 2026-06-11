"use client";

import React, { useLayoutEffect, useRef, useImperativeHandle } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentAccent = "primary" | "emerald" | "sky" | "violet" | "amber" | "rose";

const ACCENT: Record<AgentAccent, { btn: string; ring: string }> = {
  primary: {
    btn: "bg-primary text-primary-foreground hover:bg-primary/80",
    ring: "focus-within:border-primary/50",
  },
  emerald: {
    btn: "bg-emerald-600 text-white hover:bg-emerald-500",
    ring: "focus-within:border-emerald-500/40",
  },
  sky: {
    btn: "bg-sky-600 text-white hover:bg-sky-500",
    ring: "focus-within:border-sky-500/40",
  },
  violet: {
    btn: "bg-violet-600 text-white hover:bg-violet-500",
    ring: "focus-within:border-violet-500/40",
  },
  amber: {
    btn: "bg-amber-600 text-white hover:bg-amber-500",
    ring: "focus-within:border-amber-500/40",
  },
  rose: {
    btn: "bg-rose-600 text-white hover:bg-rose-500",
    ring: "focus-within:border-rose-500/40",
  },
};

export interface AgentInputHandle {
  focus(): void;
}

interface AgentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  accent?: AgentAccent;
  leftSlot?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

const AgentInput = React.forwardRef<AgentInputHandle, AgentInputProps>(
  function AgentInput(
    {
      value,
      onChange,
      onSend,
      disabled = false,
      sending = false,
      placeholder = "Escribe un mensaje…",
      accent = "primary",
      leftSlot,
      extra,
      className,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { btn, ring } = ACCENT[accent];

    useImperativeHandle(ref, () => ({
      focus() {
        textareaRef.current?.focus();
      },
    }));

    useLayoutEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [value]);

    function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !sending && value.trim()) onSend();
      }
    }

    const canSend = !disabled && !sending && value.trim().length > 0;

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "flex flex-col rounded-[24px] border border-border bg-card transition-colors duration-150",
            ring
          )}
        >
          {/* Top row: leftSlot + textarea */}
          <div className="flex items-end gap-2 px-3 pt-3 pb-2">
            {leftSlot && (
              <div className="flex-shrink-0 pb-0.5">{leftSlot}</div>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKey}
              disabled={disabled || sending}
              placeholder={placeholder}
              rows={1}
              className="nl-textarea w-full resize-none bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            {/* Send button */}
            <button
              onClick={onSend}
              disabled={!canSend}
              aria-label="Enviar"
              className={cn(
                "nl-send-btn flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-150",
                canSend
                  ? cn(btn, "shadow-[var(--btn-shadow)] hover:shadow-[var(--btn-shadow-hover)] active:shadow-[var(--btn-shadow-active)]")
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>

          {/* Extra footer slot */}
          {extra && (
            <div className="px-4 pb-3">{extra}</div>
          )}
        </div>
      </div>
    );
  }
);

export default AgentInput;
