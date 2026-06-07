"use client";

import { cn } from "@/lib/utils";

interface WaMessageBubbleProps {
  body: string;
  direction: "inbound" | "outbound";
  ts: string;
}

export function WaMessageBubble({ body, direction, ts }: WaMessageBubbleProps) {
  const isOut = direction === "outbound";
  const time = (() => {
    try { return new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  })();

  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isOut
            ? "bg-emerald-600 text-white rounded-br-sm"
            : "bg-muted text-foreground border border-border rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        {time && (
          <p className={cn("text-2xs mt-1 text-right", isOut ? "text-white/60" : "text-muted-foreground")}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
}
