"use client";

import { useState } from "react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { WaChatModal } from "./WaChatModal";
import { resolveWaPhone } from "@/lib/phone-normalize";
import { cn } from "@/lib/utils";

interface WaContactButtonProps {
  contactPhone: string | null;
  contactName: string;
  pais: string | null;
  waConnected: boolean;
  hasActiveChat: boolean;
}

export function WaContactButton({
  contactPhone,
  contactName,
  pais,
  waConnected,
  hasActiveChat,
}: WaContactButtonProps) {
  const [open, setOpen] = useState(false);

  const { jid, compatible } = resolveWaPhone(contactPhone, pais);

  // No phone at all — render placeholder so column width is stable
  if (!contactPhone) {
    return <span className="w-6 h-6 inline-block" />;
  }

  // Incompatible number (landline, too short, etc.)
  if (!compatible || !jid) {
    return (
      <span
        title="Número no compatible con WhatsApp (fijo o formato inválido)"
        className="p-1 rounded-full text-zinc-600 cursor-default inline-flex items-center justify-center"
      >
        <WhatsAppIcon className="size-3.5" />
      </span>
    );
  }

  // Compatible but WA not connected
  if (!waConnected) {
    return (
      <span
        title="Conectá tu WhatsApp en el tab WhatsApp"
        className="p-1 rounded-full text-green-600/40 cursor-default inline-flex items-center justify-center"
      >
        <WhatsAppIcon className="size-3.5" />
      </span>
    );
  }

  // Compatible + connected, with or without active chat
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={hasActiveChat ? `Chat activo con ${contactName}` : `WhatsApp con ${contactName}`}
        className={cn(
          "p-1 rounded-full inline-flex items-center justify-center transition-colors hover:bg-green-500/10",
          hasActiveChat
            ? "text-green-500 ring-1 ring-green-500"
            : "text-green-500"
        )}
      >
        <WhatsAppIcon className="size-3.5" />
      </button>

      {open && (
        <WaChatModal
          jid={jid}
          contactName={contactName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
