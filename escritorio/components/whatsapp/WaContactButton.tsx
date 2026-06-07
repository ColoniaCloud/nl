"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { WaChatModal } from "./WaChatModal";

interface WaContactButtonProps {
  contactPhone: string | null;
  contactName: string;
  waConnected: boolean;
}

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Argentina: +54 + 10 digits → insert 9 after country code
  if (digits.startsWith("54") && digits.length === 12) {
    return `${digits.slice(0, 2)}9${digits.slice(2)}@s.whatsapp.net`;
  }
  return `${digits}@s.whatsapp.net`;
}

export function WaContactButton({ contactPhone, contactName, waConnected }: WaContactButtonProps) {
  const [open, setOpen] = useState(false);

  if (!contactPhone) return null;

  const jid = phoneToJid(contactPhone);

  if (!waConnected) {
    return (
      <button
        disabled
        title="Conectá tu WhatsApp en Margarita → WhatsApp"
        className="p-1.5 rounded-md text-emerald-600/40 cursor-not-allowed"
      >
        <MessageCircle className="size-3.5" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={`WhatsApp con ${contactName}`}
        className="p-1.5 rounded-md text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
      >
        <MessageCircle className="size-3.5" />
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
