"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { X, Plus } from "lucide-react";

export type ContactData = {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  optin: boolean;
  fecha_contactado: string;
  pais: string;
  ciudad: string;
  direccion: string;
  etiquetas: string[];
  notas: string;
  website?: string;
  rubro?: string;
  status?: string;
};

const EMPTY: ContactData = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  optin: false,
  fecha_contactado: "",
  pais: "",
  ciudad: "",
  direccion: "",
  etiquetas: [],
  notas: "",
  website: "",
  rubro: "",
  status: "nuevo",
};

type Props = {
  initial?: Partial<ContactData>;
  onSubmit: (data: ContactData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
};

export function ContactForm({ initial, onSubmit, onCancel, submitLabel = "Guardar" }: Props) {
  const [form, setForm] = useState<ContactData>({ ...EMPTY, ...initial });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof ContactData, value: string | boolean | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || form.etiquetas.includes(tag)) { setTagInput(""); return; }
    set("etiquetas", [...form.etiquetas, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    set("etiquetas", form.etiquetas.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Nombre + Empresa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Nombre *</label>
          <Input
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Juan Perez"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Empresa</label>
          <Input
            value={form.empresa}
            onChange={(e) => set("empresa", e.target.value)}
            placeholder="Empresa S.A."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Email + Telefono */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="juan@empresa.com"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Telefono</label>
          <Input
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="+54 11 1234-5678"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Website + Rubro */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Sitio web</label>
          <Input
            value={form.website || ""}
            onChange={(e) => set("website" as keyof ContactData, e.target.value)}
            placeholder="https://..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Rubro</label>
          <Input
            value={form.rubro || ""}
            onChange={(e) => set("rubro" as keyof ContactData, e.target.value)}
            placeholder="Gastronomía, Tecnología..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Pais + Ciudad */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Pais</label>
          <Input
            value={form.pais}
            onChange={(e) => set("pais", e.target.value)}
            placeholder="Argentina"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Ciudad</label>
          <Input
            value={form.ciudad}
            onChange={(e) => set("ciudad", e.target.value)}
            placeholder="Buenos Aires"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Direccion */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 font-medium">Direccion</label>
        <Input
          value={form.direccion}
          onChange={(e) => set("direccion", e.target.value)}
          placeholder="Av. Corrientes 1234, Piso 3"
          className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      {/* Fecha contactado + Optin */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Fecha contactado</label>
          <Input
            type="date"
            value={form.fecha_contactado}
            onChange={(e) => set("fecha_contactado", e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400 font-medium">Optin</label>
          <label className="flex items-center gap-3 h-9 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.optin}
                onChange={(e) => set("optin", e.target.checked)}
              />
              <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm text-zinc-300">{form.optin ? "Si" : "No"}</span>
          </label>
        </div>
      </div>

      {/* Etiquetas */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 font-medium">Etiquetas</label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Agregar etiqueta..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
          <Button type="button" variant="outline" size="icon" onClick={addTag}
            className="border-zinc-700 hover:bg-zinc-700 flex-shrink-0">
            <Plus className="size-4" />
          </Button>
        </div>
        {form.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {form.etiquetas.map((tag) => (
              <Badge key={tag} variant="secondary"
                className="bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 gap-1 pr-1">
                {tag}
                <button type="button" onClick={() => removeTag(tag)}
                  className="hover:text-white transition-colors">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 font-medium">Notas</label>
        <textarea
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
          placeholder="Notas internas sobre este contacto..."
          rows={3}
          className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel}
          className="border-zinc-700 hover:bg-zinc-800">
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white">
          {saving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
