"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ContactForm, ContactData } from "./ContactForm";

type Props = {
  open: boolean;
  onClose: () => void;
  contact?: (ContactData & { id?: number }) | null;
  onSave: (data: ContactData) => Promise<void>;
};

export function ContactSheet({ open, onClose, contact, onSave }: Props) {
  const isEdit = Boolean(contact?.id);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-full max-w-[520px] bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col outline-none"
          style={{ animation: "slideInRight 0.2s ease" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              {isEdit ? "Editar contacto" : "Nuevo contacto"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-zinc-100 transition-colors rounded-md p-1 hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <ContactForm
              initial={contact || undefined}
              onSubmit={async (data) => {
                await onSave(data);
                onClose();
              }}
              onCancel={onClose}
              submitLabel={isEdit ? "Actualizar" : "Crear contacto"}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
