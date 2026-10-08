"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  ArrowLeft, Search, Download, Loader2, MapPin, Globe,
  MessageCircle, ShoppingBag, SlidersHorizontal, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrapeMap } from "@/components/margarita/crm/ScrapeMap";
import { GooglePlaceInput, type PlaceBounds } from "@/components/margarita/crm/GooglePlaceInput";

export const dynamic = "force-dynamic";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAPS_LIBRARIES: ("places")[] = ["places"];

declare const google: any;

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
  score?: number;
  priority?: "high" | "medium" | "low";
  website_quality?: "none" | "poor" | "decent" | "good";
  reason?: string;
  _rating?: number | null;
  _totalReviews?: number | null;
  // TEMP: duplicados entre usuarios — borrar junto con checkDuplicates() en scrape/route.ts
  _dupAdded?: boolean;
  _dupContacted?: boolean;
};

const RUBROS = [
  "Gastronomia", "Tecnologia", "Salud y Bienestar", "Moda y Ropa",
  "Construccion", "Educacion", "Finanzas", "Marketing y Publicidad",
  "Turismo y Hoteleria", "Inmobiliaria", "Automotriz", "Consultoria",
  "Logistica", "Retail", "Industria y Manufactura", "Deporte y Fitness",
  "Belleza y Estetica", "Legal y Juridico", "Arquitectura y Diseno", "Otro",
];

const PAISES: { label: string; code?: string; center: { lat: number; lng: number } }[] = [
  { label: "Argentina", code: "AR", center: { lat: -34.6037, lng: -58.3816 } },
  { label: "Mexico", code: "MX", center: { lat: 19.4326, lng: -99.1332 } },
  { label: "Colombia", code: "CO", center: { lat: 4.7110, lng: -74.0721 } },
  { label: "Chile", code: "CL", center: { lat: -33.4489, lng: -70.6693 } },
  { label: "Peru", code: "PE", center: { lat: -12.0464, lng: -77.0428 } },
  { label: "Uruguay", code: "UY", center: { lat: -34.9011, lng: -56.1645 } },
  { label: "Paraguay", code: "PY", center: { lat: -25.2637, lng: -57.5759 } },
  { label: "Bolivia", code: "BO", center: { lat: -16.5000, lng: -68.1500 } },
  { label: "Venezuela", code: "VE", center: { lat: 10.4806, lng: -66.9036 } },
  { label: "Ecuador", code: "EC", center: { lat: -0.1807, lng: -78.4678 } },
  { label: "Brasil", code: "BR", center: { lat: -23.5505, lng: -46.6333 } },
  { label: "Espana", code: "ES", center: { lat: 40.4168, lng: -3.7038 } },
  { label: "Otro", center: { lat: -34.6037, lng: -58.3816 } },
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

const FIELD_CLASS = "h-9 w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

function FilterToggle({
  label, value, onChange,
}: {
  label: string;
  value: "yes" | "no" | null;
  onChange: (v: "yes" | "no" | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex rounded-md overflow-hidden border border-border text-xs">
        {(["yes", "no", null] as const).map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "px-2.5 py-1 transition-colors",
              value === opt ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-white/[0.06]"
            )}
          >
            {opt === "yes" ? "Si" : opt === "no" ? "No" : "Todos"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ScrapeLeadsPage() {
  const router = useRouter();

  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: "margarita-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const [rubro, setRubro] = useState("");
  const [rubroCustom, setRubroCustom] = useState("");
  const [paisLabel, setPaisLabel] = useState("Argentina");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [estadoBounds, setEstadoBounds] = useState<PlaceBounds | null>(null);
  const [cantidad, setCantidad] = useState(15);

  const pais = useMemo(() => PAISES.find((p) => p.label === paisLabel) || PAISES[0], [paisLabel]);

  const [center, setCenter] = useState(pais.center);
  const [radiusKm, setRadiusKm] = useState(5);

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

  const geocoderRef = useRef<any>(null);

  function handlePaisChange(label: string) {
    setPaisLabel(label);
    const p = PAISES.find((x) => x.label === label) || PAISES[0];
    setCenter(p.center);
    setEstado("");
    setCiudad("");
    setEstadoBounds(null);
  }

  function handleEstadoSelect(place: { description: string; lat: number; lng: number; bounds?: PlaceBounds }) {
    setEstado(place.description);
    setCenter({ lat: place.lat, lng: place.lng });
    setEstadoBounds(place.bounds || null);
    setCiudad("");
  }

  function handleCiudadSelect(place: { description: string; lat: number; lng: number }) {
    setCiudad(place.description);
    setCenter({ lat: place.lat, lng: place.lng });
  }

  // Click/arrastre en el mapa → geocodifica el punto y completa Estado/Ciudad automáticamente.
  const handleMapCenterChange = useCallback((newCenter: { lat: number; lng: number }) => {
    setCenter(newCenter);
    if (!mapsLoaded || typeof google === "undefined") return;
    if (!geocoderRef.current) geocoderRef.current = new (google as any).maps.Geocoder();
    geocoderRef.current.geocode({ location: newCenter }, (results: any[], status: string) => {
      if (status !== "OK" || !results?.length) return;
      const comps = results[0].address_components as any[];
      const find = (type: string) => comps.find((c) => c.types.includes(type))?.long_name;
      const provincia = find("administrative_area_level_1");
      const localidad = find("locality") || find("administrative_area_level_2") || find("sublocality");
      if (provincia) setEstado(provincia);
      if (localidad) setCiudad(localidad);
      setEstadoBounds(null);
    });
  }, [mapsLoaded]);

  function toggleSelect(idx: number) {
    setSelected((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)));
  }
  function togglePlatform(p: string) {
    setFilterPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  async function handleSearch() {
    if (!finalRubro.trim()) { setError("El rubro es obligatorio"); return; }
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
          rubro: finalRubro, pais: pais.label, estado, ciudad, cantidad,
          lat: center.lat, lng: center.lng, radiusKm,
          filterHasWebsite, filterHasWhatsapp, filterPlatforms,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = "Error al buscar";
        try { msg = JSON.parse(text).error || msg; } catch { msg = `Error ${res.status} del servidor`; }
        throw new Error(msg);
      }
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error("Respuesta inválida del servidor"); }
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
      const res = await fetch("/api/margarita/crm/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: toImport }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error al importar"); }
      setImportDone({ imported: toImport.length });
      setResults([]);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border">
        <button
          onClick={() => router.push("/services/margarita/crm")}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20">
          <Sparkles className="size-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold">Buscador inteligente de leads</h1>
          <p className="text-xs text-muted-foreground">Google Maps + análisis IA · Margarita Mkt</p>
        </div>
      </div>

      {/* Two columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* Left: form + map */}
        <div className="flex flex-col min-h-0 border-r border-border overflow-y-auto">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Rubro *</label>
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Seleccionar rubro...</option>
                  {RUBROS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {rubro === "Otro" && (
                  <input value={rubroCustom} onChange={(e) => setRubroCustom(e.target.value)}
                    placeholder="Especifica el rubro..." className={cn(FIELD_CLASS, "mt-1")} />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Pais *</label>
                <select value={paisLabel} onChange={(e) => handlePaisChange(e.target.value)} className={FIELD_CLASS}>
                  {PAISES.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Estado / Provincia</label>
                <GooglePlaceInput
                  value={estado}
                  onChange={setEstado}
                  onPlaceSelect={handleEstadoSelect}
                  placeholder="Buscar provincia..."
                  countryCode={pais.code}
                  types={["administrative_area_level_1"]}
                  isLoaded={mapsLoaded}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Ciudad</label>
                <GooglePlaceInput
                  value={ciudad}
                  onChange={setCiudad}
                  onPlaceSelect={handleCiudadSelect}
                  placeholder="Buscar ciudad..."
                  countryCode={pais.code}
                  types={["locality"]}
                  bounds={estadoBounds}
                  isLoaded={mapsLoaded}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Cantidad</label>
                <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={FIELD_CLASS}>
                  {[5, 10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} contactos</option>)}
                </select>
              </div>
            </div>

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <SlidersHorizontal className="size-3.5" />
              Filtros avanzados
              {(filterHasWebsite || filterHasWhatsapp || filterPlatforms.length > 0) && (
                <Badge variant="secondary" className="text-2xs px-1.5 py-0 bg-emerald-900/50 text-emerald-300 border-emerald-800/50 ml-1">
                  {[filterHasWebsite, filterHasWhatsapp, filterPlatforms.length > 0 ? "plataformas" : null].filter(Boolean).length} activos
                </Badge>
              )}
            </button>

            {showFilters && (
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Globe className="size-3.5 text-muted-foreground" /> Sitio web
                  </div>
                  <FilterToggle label="Tiene sitio web" value={filterHasWebsite} onChange={setFilterHasWebsite} />
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <MessageCircle className="size-3.5 text-emerald-500" /> WhatsApp
                    <span className="text-2xs text-muted-foreground font-normal">(requiere analisis IA del sitio web)</span>
                  </div>
                  <FilterToggle label="Tiene WhatsApp" value={filterHasWhatsapp} onChange={setFilterHasWhatsapp} />
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <ShoppingBag className="size-3.5 text-blue-400" /> Servicios de terceros
                    <span className="text-2xs text-muted-foreground font-normal">(requiere analisis IA del sitio web)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          filterPlatforms.includes(p.value)
                            ? "bg-blue-700/40 text-blue-300 border-blue-700/60"
                            : "bg-muted text-muted-foreground border-border hover:border-zinc-500"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {filterPlatforms.length > 0 && (
                    <button type="button" onClick={() => setFilterPlatforms([])}
                      className="text-2xs text-muted-foreground hover:text-foreground">
                      Limpiar seleccion
                    </button>
                  )}
                </div>

                {needsAI && (
                  <div className="rounded-md bg-emerald-950/40 border border-emerald-800/30 px-3 py-2 text-xs text-emerald-300">
                    Los filtros de WhatsApp y plataformas requieren analizar cada sitio web con IA.
                    La busqueda puede tomar un poco mas de tiempo.
                  </div>
                )}
              </div>
            )}

            {/* Radius slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-emerald-400" /> Radio de búsqueda
                </label>
                <span className="text-xs text-emerald-400 font-semibold">{radiusKm} km</span>
              </div>
              <input
                type="range" min={1} max={50} step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full h-1.5 rounded-full bg-muted accent-emerald-500 cursor-pointer"
              />
              <p className="text-2xs text-muted-foreground">
                Hacé click en el mapa o arrastrá el círculo para mover el área de búsqueda.
              </p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="size-4 animate-spin" /> {needsAI ? "Buscando y analizando con IA..." : "Buscando leads..."}</>
              ) : (
                <><Search className="size-4" /> Buscar leads</>
              )}
            </button>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-[320px] px-5 pb-5">
            <ScrapeMap
              center={center}
              radiusKm={radiusKm}
              onCenterChange={handleMapCenterChange}
              isLoaded={mapsLoaded}
              loadError={mapsLoadError}
            />
          </div>
        </div>

        {/* Right: leads list */}
        <div className="flex flex-col min-h-0">
          {results.length > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.size === results.length}
                  onChange={toggleAll} className="accent-emerald-500 w-4 h-4" />
                <span className="text-xs text-muted-foreground">{selected.size} de {results.length} seleccionados</span>
              </div>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="flex items-center gap-1.5 text-xs h-7 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
              >
                {importing ? <><Loader2 className="size-3 animate-spin" /> Importando...</> : <><Download className="size-3" /> Importar {selected.size}</>}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {results.length > 0 ? (
              <div className="divide-y divide-border">
                {results.map((c, i) => (
                  <label key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.03] cursor-pointer">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                      className="accent-emerald-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{c.nombre}</span>
                        {c.score != null && (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                            c.score >= 70 ? "bg-green-500/20 text-green-400"
                              : c.score >= 40 ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          )}>
                            Score {c.score}{c.priority === "high" && " · 🔥"}
                          </span>
                        )}
                        {c._rating != null && (
                          <span className="text-xs text-muted-foreground">⭐ {c._rating} ({c._totalReviews ?? 0} reseñas)</span>
                        )}
                        {c._hasWhatsapp && (
                          <Badge variant="secondary" className="text-2xs px-1.5 py-0 bg-emerald-900/40 text-emerald-400 border-emerald-800/50 gap-1">
                            <MessageCircle className="size-2.5" /> WhatsApp
                          </Badge>
                        )}
                        {(c._platforms || []).map((p) => (
                          <Badge key={p} variant="secondary" className="text-2xs px-1.5 py-0 bg-blue-900/30 text-blue-400 border-blue-800/40">{p}</Badge>
                        ))}
                        {c._dupAdded && (
                          <Badge variant="secondary" className="text-2xs px-1.5 py-0 bg-yellow-900/40 text-yellow-400 border-yellow-800/50">
                            Ya agregado
                          </Badge>
                        )}
                        {c._dupContacted && (
                          <Badge variant="secondary" className="text-2xs px-1.5 py-0 bg-red-900/40 text-red-400 border-red-800/50">
                            Ya contactado
                          </Badge>
                        )}
                      </div>
                      {c.reason && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.reason}</p>}
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.telefono && <span className="text-xs text-muted-foreground">{c.telefono}</span>}
                        {c._website && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                            <Globe className="size-3 flex-shrink-0" />
                            <span className="truncate">{c._website.replace(/^https?:\/\//, "")}</span>
                          </span>
                        )}
                        {(c.ciudad || c.pais) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3" />{[c.ciudad, c.pais].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                      {c.direccion && <p className="text-xs text-zinc-600 mt-0.5 truncate">{c.direccion}</p>}
                    </div>
                  </label>
                ))}
              </div>
            ) : importDone ? (
              <div className="px-6 py-10 text-center">
                <div className="text-4xl mb-3">✓</div>
                <p className="text-foreground font-semibold">{importDone.imported} contactos importados</p>
                <p className="text-muted-foreground text-sm mt-1">Ya aparecen en tu CRM</p>
                <button onClick={() => router.push("/services/margarita/crm")}
                  className="mt-4 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">
                  Ver contactos
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-10 px-6 text-center">
                {loading ? "Buscando leads..." : "Completa el formulario y presioná Buscar leads"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
