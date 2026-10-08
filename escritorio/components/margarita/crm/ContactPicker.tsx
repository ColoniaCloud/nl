"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickedContact {
  id: number;
  nombre: string;
  telefono: string | null;
}

interface ContactPickerProps {
  selected: PickedContact[];
  onChange: (contacts: PickedContact[]) => void;
  maxContacts?: number;
}

export function ContactPicker({ selected, onChange, maxContacts = 10 }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/margarita/crm/contacts?search=${encodeURIComponent(query)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setResults(d.contacts ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectedIds = new Set(selected.map((c) => c.id));
  const atLimit = selected.length >= maxContacts;

  function addContact(c: PickedContact) {
    if (selectedIds.has(c.id) || atLimit) return;
    onChange([...selected, { id: c.id, nombre: c.nombre, telefono: c.telefono }]);
    setQuery("");
    setResults([]);
  }

  function removeContact(id: number) {
    onChange(selected.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={atLimit}
          placeholder={atLimit ? `Máximo ${maxContacts} contactos` : "Buscar contacto por nombre..."}
          className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-muted text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />}

        {open && query.trim() && !atLimit && (
          <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {results.length === 0 && !loading && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
            )}
            {results.map((c) => {
              const already = selectedIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={already}
                  onClick={() => addContact(c)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06] transition-colors",
                    already && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="truncate">{c.nombre}</span>
                  <span className="text-2xs text-muted-foreground shrink-0">{c.telefono || "sin teléfono"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            >
              {c.nombre}
              <button type="button" onClick={() => removeContact(c.id)} className="p-0.5 hover:text-red-400">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">{selected.length}/{maxContacts} contactos seleccionados</p>
    </div>
  );
}
