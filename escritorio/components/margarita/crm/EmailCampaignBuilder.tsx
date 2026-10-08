"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Rocket, Info, Tag as TagIcon, ListChecks, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmailMessageEditor } from "./EmailMessageEditor";
import { ContactPicker } from "./ContactPicker";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface PickedContact {
  id: number;
  nombre: string;
  telefono: string | null;
}

type SegmentMode = "tags" | "manual";

interface MessageVariant {
  subject: string;
  body: string;
}

const EMPTY_VARIANT: MessageVariant = { subject: "", body: "" };

interface EmailCampaignBuilderProps {
  onLaunched: () => void;
}

export function EmailCampaignBuilder({ onLaunched }: EmailCampaignBuilderProps) {
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [segmentMode, setSegmentMode] = useState<SegmentMode>("tags");

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<PickedContact[]>([]);

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [activeVariant, setActiveVariant] = useState(0);
  const [messages, setMessages] = useState<MessageVariant[]>([EMPTY_VARIANT, EMPTY_VARIANT, EMPTY_VARIANT]);

  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email/status")
      .then((r) => r.json())
      .then((d) => setEmailConnected(d?.status === "connected"))
      .catch(() => setEmailConnected(false));
  }, []);

  useEffect(() => {
    fetch("/api/margarita/crm/tags")
      .then((r) => r.json())
      .then((d) => setTags(d.tags ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hasSelection = segmentMode === "tags" ? selectedTags.length > 0 : selectedContacts.length > 0;
    if (!hasSelection) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      const body = segmentMode === "manual"
        ? { mode: "manual", contactIds: selectedContacts.map((c) => c.id) }
        : { mode: "tags", tagNames: selectedTags };
      fetch("/api/margarita/crm/campaigns-email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((d) => setPreviewCount(d.count ?? 0))
        .catch(() => setPreviewCount(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [segmentMode, selectedTags, selectedContacts]);

  function toggleTag(tagName: string) {
    setSelectedTags((prev) => (prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]));
  }

  function switchMode(mode: SegmentMode) {
    setSegmentMode(mode);
    setPreviewCount(null);
  }

  function updateVariant(index: number, patch: Partial<MessageVariant>) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  const messagesReady = messages.every((m) => m.subject.trim() && m.body.trim());
  const hasSegment = segmentMode === "tags" ? selectedTags.length > 0 : selectedContacts.length > 0;
  const canLaunch = emailConnected && name.trim().length > 0 && hasSegment && (previewCount ?? 0) > 0 && messagesReady;

  async function handleLaunch() {
    setLaunching(true);
    setError(null);
    try {
      const body = segmentMode === "manual"
        ? { name: name.trim(), mode: "manual", contactIds: selectedContacts.map((c) => c.id), messages }
        : { name: name.trim(), mode: "tags", tagNames: selectedTags, messages };
      const res = await fetch("/api/margarita/crm/campaigns-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo lanzar la campaña");
      onLaunched();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  }

  if (emailConnected === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2 px-6">
        <Mail className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Todavía no conectaste tu email. Andá a Emails → Configuración para vincular tu cuenta antes de crear una campaña.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6 max-w-3xl mx-auto">
      {/* Segmentación */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="size-4" /> Segmentación
        </h3>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la campaña"
          className="bg-muted border-border"
        />

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => switchMode("tags")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              segmentMode === "tags"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent"
            )}
          >
            <TagIcon className="size-3.5" /> Por etiquetas
          </button>
          <button
            type="button"
            onClick={() => switchMode("manual")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              segmentMode === "manual"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent"
            )}
          >
            <ListChecks className="size-3.5" /> Manual
          </button>
        </div>

        {segmentMode === "tags" ? (
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && <p className="text-xs text-muted-foreground">No hay etiquetas creadas todavía.</p>}
            {tags.map((t) => {
              const active = selectedTags.includes(t.name);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.name)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    active ? "text-white" : "text-muted-foreground border-border hover:text-foreground"
                  )}
                  style={active ? { backgroundColor: t.color, borderColor: t.color } : undefined}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        ) : (
          <ContactPicker selected={selectedContacts} onChange={setSelectedContacts} maxContacts={10} />
        )}

        {hasSegment && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {previewLoading ? <Loader2 className="size-3 animate-spin" /> : <Users className="size-3" />}
            {previewLoading
              ? "Calculando destinatarios..."
              : previewCount === 0
              ? "Ningún contacto con email válido para esa selección"
              : `${previewCount} contacto${previewCount === 1 ? "" : "s"} recibirán esta campaña`}
          </p>
        )}
      </div>

      {/* Mensajes */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Mensajes</h3>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveVariant(i)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeVariant === i
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent"
              )}
            >
              Mensaje {i + 1}
              {messages[i].subject.trim() && messages[i].body.trim() && (
                <span className="ml-1.5 size-1.5 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>
          ))}
        </div>

        <EmailMessageEditor
          subject={messages[activeVariant].subject}
          onSubjectChange={(subject) => updateVariant(activeVariant, { subject })}
          body={messages[activeVariant].body}
          onBodyChange={(body) => updateVariant(activeVariant, { body })}
          placeholder={`variante ${activeVariant + 1}`}
        />

        <div className="flex gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          <p>
            Diseñá 3 variantes de asunto y contenido que comuniquen lo mismo. Al enviar, la campaña rota entre las 3
            de forma aleatoria (nunca se repite la misma dos veces seguidas) y espera entre 3 y 15 segundos, también
            al azar, antes de cada envío.
          </p>
        </div>
      </div>

      {/* Revisión y lanzamiento */}
      <div className="space-y-3 pt-2 border-t border-border">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button onClick={handleLaunch} disabled={!canLaunch || launching} className="w-full gap-2">
          {launching ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {launching ? "Lanzando..." : "Lanzar campaña"}
        </Button>
      </div>
    </div>
  );
}
