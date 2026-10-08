"use client";

import { useRef } from "react";
import { Bold, Italic, Strikethrough, Code } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

const TOOLS = [
  { icon: Bold, marker: "*", label: "Negrita" },
  { icon: Italic, marker: "_", label: "Cursiva" },
  { icon: Strikethrough, marker: "~", label: "Tachado" },
  { icon: Code, marker: "```", label: "Monoespaciado" },
] as const;

// Renderiza el markdown de WhatsApp (*negrita*, _cursiva_, ~tachado~, ```mono```)
// como una vista previa aproximada de cómo se ve el mensaje ya enviado.
export function renderWaMarkdownPreview(text: string): string {
  return text
    .replace(/```([^`]+)```/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<del>$1</del>");
}

export function WaMessageEditor({ value, onChange, placeholder, maxLength = 1000 }: WaMessageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = selected ? end + marker.length * 2 : start + marker.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/40">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onClick={() => wrapSelection(t.marker)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <t.icon className="size-3.5" />
          </button>
        ))}
        <span className={cn("ml-auto text-2xs", value.length > maxLength ? "text-red-400" : "text-muted-foreground")}>
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
