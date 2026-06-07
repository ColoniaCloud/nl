"use client";

import { X, MessageCircle } from "lucide-react";
import { WaChatWindow } from "./WaChatWindow";

interface WaChatModalProps {
  jid: string;
  contactName: string;
  onClose: () => void;
}

export function WaChatModal({ jid, contactName, onClose }: WaChatModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full sm:w-[400px] h-[70dvh] sm:h-[540px] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <MessageCircle className="size-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{contactName}</p>
            <p className="text-xs text-muted-foreground truncate">{jid.replace("@s.whatsapp.net", "")}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 min-h-0">
          <WaChatWindow jid={jid} contactName={contactName} />
        </div>
      </div>
    </div>
  );
}
