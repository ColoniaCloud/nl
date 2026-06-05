"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X, Search, Download, Loader2, MapPin, Building2,
  Globe, MessageCircle, ShoppingBag, SlidersHorizontal,
} from "lucide-react";

type ScrapedContact = {
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  pais: string;
  ciudad: string | null;
  direccion: string | null;
  notas: string | null;
  optin: number;
  etiquetas: string[];
  _website?: string | null;
  _hasWhatsapp?: boolean;
  _platforms?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (contacts: ScrapedContact[]) => Promise<void>;
};

const RUBROS = [
  "Gastronomia", "Tecnologia", "Salud y Bienestar", "Moda y Ropa",
  "Construccion", "Educacion", "Finanzas", "Marketing y Publicidad",
  "Turismo y Hoteleria", "Inmobiliaria", "Automotriz", "Consultoria",
  "Logistica", "Retail", "Industria y Manufactura", "Deporte y Fitness",
  "Belleza y Estetica", "Legal y Juridico", "Arquitectura y Diseno", "Otro",
];

const PAISES = [
  "Argentina", "Mexico", "Colombia", "Chile", "Peru", "Uruguay",
  "Paraguay", "Bolivia", "Venezuela", "Ecuador", "Brasil", "Espana", "Otro",
];

const PLATFORMS = [
  { value: "tiendanube",    label: "Tienda Nube" },
  { value: "mercadoshops",  label: "Mercado Shops" },
  { value: "shopify",       label: "Shopify" },
  { value: "woocommerce",   label: "WooCommerce" },
  { value: "wix",           label: "Wix" },
  { value: "squarespace",   label: "Squarespace" },
  { value: "prestashop",    label: "PrestaShop" },
  { value: "vtex",          label: "VTEX" },
  { value: "jumpseller",    label: "Jumpseller" },
];

type WebsiteFilter = "yes" | "no" | null;
type WhatsappFilter = "yes" | "no" | null;

function FilterToggle({
  label, value, onChange,
}: {
  label: string;
  value: "yes" | "no" | null;
  onChange: (v: "yes" | "no" | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-400 w-28 flex-shrink-0">{label}</span>
      <div className="flex rounded-md overflow-hidden border border-zinc-700 text-xs">
        {(["yes", "no", null] as const).map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 transition-colors ${
              value === opt
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {opt === "yes" ? "Si" : opt === "no" ? "No" : "Todos"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScrapePanel({ open, onClose, onImport }: Props) {
  const [rubro, setRubro] = useState("");
  const [rubroCustom, setRubroCustom] = useState("");
  const [pais, setPais] = useState("");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [cantidad, setCantidad] = useState(15);

  // Filtros
  const [filterHasWebsite, setFilterHasWebsite] = useState<WebsiteFilter>(null);
  const [filterHasWhatsapp, setFilterHasWhatsapp] = useState<WhatsappFilter>(null);
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ScrapedContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ imported: number } | null>(null);

  const finalRubro = rubro === "Otro" ? rubroCustom : rubro;

  const needsAI = filterHasWhatsapp !== null || filterPlatforms.length > 0;

  function toggleSelect(idx: number) {
    setSelected((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)));
  }
  function togglePlatform(p: string) {
    setFilterPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSearch() {
    if (!finalRubro.trim() || !pais) { setError("Rubro y pais son obligatorios"); return; }
    setError("");
    setResults([]);
    setSelected(new Set());
    setImportDone(null);
    setLoading(true);
    try {
      const res = await fetch("/api/margarita/crm/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rubro: finalRubro, pais, estado, ciudad, cantidad,
          filterHasWebsite,
          filterHasWhatsapp,
          filterPlatforms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar");
      setResults(data.contacts || []);
      setSelected(new Set((data.contacts || []).map((_: any, i: number) => i)));
    } catch (err: any) {
      setError(err.message || "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const toImport = results.filter((_, i) => selected.has(i));
    if (!toImport.length) return;
    setImporting(true);
    try {
      await onImport(toImport);
      setImportDone({ imported: toImport.length });
      setResults([]);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setResults([]); setSelected(new Set()); setError(""); setImportDone(null);
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col outline-none">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-100">
                Buscador inteligente de Leads
              </Dialog.Title>
              <p className="text-xs text-zinc-500 mt-0.5">
                Datos reales via Google Places · Analisis IA opcional
              </p>
            </div>
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-zinc-100 transition-colors rounded-md p-1 hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Filters section */}
          <div className="px-6 py-4 border-b border-zinc-800 flex-shrink-0 space-y-3 overflow-y-auto max-h-[420px]">

            {/* Location + Rubro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-medium">Rubro *</label>
                <select value={rubro} onChange={(e) => setRubro(e.target.value)}
                  className="h-9 w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                  <option value="">Seleccionar rubro...</option>
                  {RUBROS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {rubro === "Otro" && (
                  <Input value={rubroCustom} onChange={(e) => setRubroCustom(e.target.value)}
                    placeholder="Especifica el rubro..."
                    className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-medium">Pais *</label>
                <select value={pais} onChange={(e) => setPais(e.target.value)}
                  className="h-9 w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                  <option value="">Seleccionar pais...</option>
                  {PAISES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-medium">Estado / Provincia</label>
                <Input value={estado} onChange={(e) => setEstado(e.target.value)}
                  placeholder="Buenos Aires"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-medium">Ciudad</label>
                <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)}
                  placeholder="CABA"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-medium">Cantidad</label>
                <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))}
                  className="h-9 w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                  {[5, 10, 15, 20, 25, 30].map((n) => (
                    <option key={n} value={n}>{n} contactos</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <SlidersHorizontal className="size-3.5" />
              Filtros avanzados
              {(filterHasWebsite || filterHasWhatsapp || filterPlatforms.length > 0) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-900/50 text-violet-300 border-violet-800/50 ml-1">
                  {[filterHasWebsite, filterHasWhatsapp, filterPlatforms.length > 0 ? "plataformas" : null].filter(Boolean).length} activos
                </Badge>
              )}
            </button>

            {showFilters && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">

                {/* Website filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <Globe className="size-3.5 text-zinc-500" />
                    Sitio web
                  </div>
                  <FilterToggle
                    label="Tiene sitio web"
                    value={filterHasWebsite}
                    onChange={setFilterHasWebsite}
                  />
                </div>

                <div className="h-px bg-zinc-800" />

                {/* WhatsApp filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <MessageCircle className="size-3.5 text-emerald-500" />
                    WhatsApp
                    <span className="text-[10px] text-zinc-600 font-normal">(requiere analisis IA del sitio web)</span>
                  </div>
                  <FilterToggle
                    label="Tiene WhatsApp"
                    value={filterHasWhatsapp}
                    onChange={setFilterHasWhatsapp}
                  />
                </div>

                <div className="h-px bg-zinc-800" />

                {/* Platform filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <ShoppingBag className="size-3.5 text-blue-400" />
                    Servicios de terceros
                    <span className="text-[10px] text-zinc-600 font-normal">(requiere analisis IA del sitio web)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          filterPlatforms.includes(p.value)
                            ? "bg-blue-700/40 text-blue-300 border-blue-700/60"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {filterPlatforms.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterPlatforms([])}
                      className="text-[10px] text-zinc-600 hover:text-zinc-400"
                    >
                      Limpiar seleccion
                    </button>
                  )}
                </div>

                {/* AI notice */}
                {needsAI && (
                  <div className="rounded-md bg-violet-950/40 border border-violet-800/30 px-3 py-2 text-xs text-violet-300">
                    Los filtros de WhatsApp y plataformas requieren analizar cada sitio web con IA.
                    La busqueda puede tomar un poco mas de tiempo.
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button onClick={handleSearch} disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white">
              {loading ? (
                <><Loader2 className="size-4 animate-spin mr-2" />
                  {needsAI ? "Buscando y analizando con IA..." : "Buscando en Google Places..."}</>
              ) : (
                <><Search className="size-4 mr-2" /> Buscar leads</>
              )}
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.size === results.length}
                    onChange={toggleAll} className="accent-violet-500 w-4 h-4" />
                  <span className="text-xs text-zinc-400">
                    {selected.size} de {results.length} seleccionados
                  </span>
                </div>
                <Button size="sm" onClick={handleImport}
                  disabled={selected.size === 0 || importing}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-7">
                  {importing
                    ? <><Loader2 className="size-3 animate-spin mr-1" /> Importando...</>
                    : <><Download className="size-3 mr-1" /> Importar {selected.size}</>}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
                {results.map((c, i) => (
                  <label key={i} className="flex items-start gap-3 px-6 py-3 hover:bg-zinc-900/50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                      className="accent-violet-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100">{c.nombre}</span>
                        {c._hasWhatsapp && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-900/40 text-emerald-400 border-emerald-800/50 gap-1">
                            <MessageCircle className="size-2.5" /> WhatsApp
                          </Badge>
                        )}
                        {(c._platforms || []).map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-900/30 text-blue-400 border-blue-800/40">
                            {p}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.telefono && <span className="text-xs text-zinc-400">{c.telefono}</span>}
                        {c._website && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1 truncate max-w-[200px]">
                            <Globe className="size-3 flex-shrink-0" />
                            <span className="truncate">{c._website.replace(/^https?:\/\//, "")}</span>
                          </span>
                        )}
                        {(c.ciudad || c.pais) && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <MapPin className="size-3" />{[c.ciudad, c.pais].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                      {c.direccion && <p className="text-xs text-zinc-600 mt-0.5 truncate">{c.direccion}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {importDone && (
            <div className="px-6 py-8 text-center flex-1">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-zinc-100 font-semibold">{importDone.imported} contactos importados</p>
              <p className="text-zinc-500 text-sm mt-1">Ya aparecen en tu CRM</p>
              <Button onClick={handleClose} className="mt-4 bg-violet-600 hover:bg-violet-500 text-white">
                Cerrar
              </Button>
            </div>
          )}

          {!loading && !results.length && !importDone && (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm py-10">
              Completa los filtros y presiona Buscar leads
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
