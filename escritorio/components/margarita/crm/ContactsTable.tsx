"use client";

import { cn } from "@/lib/utils";
import {
  Mail, Phone, MapPin, Pencil, Trash2, CheckCircle2, Circle,
  ChevronLeft, ChevronRight, ExternalLink, TrendingUp,
  MessageSquare, Target, XCircle, User,
} from "lucide-react";
import { WaContactButton } from "@/components/whatsapp/WaContactButton";
import { resolveWaPhone } from "@/lib/phone-normalize";

export type Contact = {
  id: number;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  optin: number;
  fecha_contactado: string | null;
  pais: string | null;
  ciudad: string | null;
  direccion: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  created_at: string;
  // Extended fields
  website?: string | null;
  rubro?: string | null;
  score?: number | null;
  status?: string | null;
};

type Props = {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
  onView?: (c: Contact) => void;
  onPageChange: (page: number) => void;
  waConnected?: boolean;
  activeWaJids?: Set<string>;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  nuevo: { label: "Nuevo", color: "text-blue-400 bg-blue-500/20", icon: <User className="size-2.5" /> },
  contactado: { label: "Contactado", color: "text-amber-400 bg-amber-500/20", icon: <MessageSquare className="size-2.5" /> },
  calificado: { label: "Calificado", color: "text-emerald-400 bg-emerald-500/20", icon: <CheckCircle2 className="size-2.5" /> },
  cerrado: { label: "Cerrado", color: "text-purple-400 bg-purple-500/20", icon: <Target className="size-2.5" /> },
  perdido: { label: "Perdido", color: "text-red-400 bg-red-500/20", icon: <XCircle className="size-2.5" /> },
};

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-semibold", color)}>
      <TrendingUp className="size-2.5" />{score}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }); }
  catch { return d; }
}

export function ContactsTable({ contacts, total, page, limit, onEdit, onDelete, onView, onPageChange, waConnected = false, activeWaJids }: Props) {
  const totalPages = Math.ceil(total / limit);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-sm">No hay leads todavía</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Creá uno manualmente o usá el buscador IA</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5rem_auto] gap-3 px-4 py-2 text-xxs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        <span>Lead</span>
        <span>Contacto</span>
        <span>Rubro / Estado</span>
        <span>Score</span>
        <span>Etiquetas</span>
        <span />
        <span />
      </div>

      {contacts.map((c) => {
        const tags: string[] = Array.isArray(c.etiquetas)
          ? c.etiquetas
          : c.etiquetas
          ? (() => { try { return JSON.parse(c.etiquetas as any); } catch { return []; } })()
          : [];
        const statusCfg = STATUS_CONFIG[c.status || "nuevo"] || STATUS_CONFIG.nuevo;

        return (
          <div
            key={c.id}
            className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5rem_auto] gap-3 px-4 py-3 items-center border-b border-border/50 hover:bg-white/[0.02] transition-colors group"
          >
            {/* Nombre + empresa */}
            <div className="min-w-0">
              <button
                onClick={() => onView?.(c)}
                className="text-sm font-medium text-foreground hover:text-emerald-400 transition-colors truncate block text-left w-full"
              >
                {c.nombre}
              </button>
              {c.empresa && <p className="text-xs text-muted-foreground truncate">{c.empresa}</p>}
              {c.fecha_contactado && <p className="text-xs text-muted-foreground/60 mt-0.5">{fmtDate(c.fecha_contactado)}</p>}
            </div>

            {/* Contacto */}
            <div className="min-w-0 space-y-0.5">
              {c.email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <Mail className="size-3 flex-shrink-0" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
              {c.telefono && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3 flex-shrink-0" />
                  <span>{c.telefono}</span>
                </div>
              )}
              {c.ciudad && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 truncate">
                  <MapPin className="size-3 flex-shrink-0" />
                  <span className="truncate">{[c.ciudad, c.pais].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {!c.email && !c.telefono && !c.ciudad && <span className="text-xs text-muted-foreground/40">—</span>}
            </div>

            {/* Rubro / Status */}
            <div className="min-w-0 space-y-1">
              {c.rubro && <p className="text-xs text-muted-foreground truncate">{c.rubro}</p>}
              <span className={cn("inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full font-medium", statusCfg.color)}>
                {statusCfg.icon}{statusCfg.label}
              </span>
            </div>

            {/* Score */}
            <div>
              <ScorePill score={c.score} />
              {c.optin ? (
                <div className="flex items-center gap-0.5 text-2xs text-emerald-400 mt-0.5">
                  <CheckCircle2 className="size-2.5" /> optin
                </div>
              ) : null}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 min-w-0">
              {tags.slice(0, 2).map((t) => (
                <span key={t} className="text-2xs px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  {t}
                </span>
              ))}
              {tags.length > 2 && <span className="text-2xs text-muted-foreground">+{tags.length - 2}</span>}
            </div>

            {/* WhatsApp — always visible */}
            <div className="flex items-center justify-center">
              <WaContactButton
                contactPhone={c.telefono}
                contactName={c.nombre}
                pais={c.pais}
                waConnected={waConnected}
                hasActiveChat={!!(activeWaJids && c.telefono && (() => {
                  const { jid } = resolveWaPhone(c.telefono, c.pais);
                  return jid ? activeWaJids.has(jid) : false;
                })())}
              />
            </div>

            {/* Actions — appear on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onView && (
                <button onClick={() => onView(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-white/[0.05] transition-colors" title="Ver detalle">
                  <ExternalLink className="size-3.5" />
                </button>
              )}
              <button onClick={() => onEdit(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors" title="Editar">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-white/[0.05] transition-colors" title="Eliminar">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}

        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-white/[0.05] transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-white/[0.05] transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
