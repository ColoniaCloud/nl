import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "@/lib/agents";
import { checkAgentAccess } from "@/lib/billing-access";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SCRAPE_MODEL = getAgent("margarita")!.model;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Caché de lugares (in-memory + persistente en mm_places_cache) ──────────
// searchPlaces (Google u OSM) la llena; getPlaceDetails la lee. Evita re-pagar
// a Google Places por el mismo negocio dentro de la ventana de expiración.

const placesCache = new Map<string, any>();
const PLACES_CACHE_TTL_DAYS = 30;

async function getCachedPlace(placeId: string): Promise<any | null> {
  if (placesCache.has(placeId)) return placesCache.get(placeId);
  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = (await pool.execute(
      `SELECT payload FROM mm_places_cache WHERE place_id = ? AND expires_at > NOW()`,
      [placeId]
    )) as any;
    if (rows[0]) {
      const payload = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
      placesCache.set(placeId, payload);
      return payload;
    }
  } catch {}
  return null;
}

async function setCachedPlace(placeId: string, payload: any, provider: "google" | "osm"): Promise<void> {
  placesCache.set(placeId, payload);
  try {
    await ensureTables();
    const pool = getPool();
    await pool.execute(
      `INSERT INTO mm_places_cache (place_id, provider, payload, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${PLACES_CACHE_TTL_DAYS} DAY))
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), provider = VALUES(provider),
         fetched_at = NOW(), expires_at = VALUES(expires_at)`,
      [placeId, provider, JSON.stringify(payload)]
    );
  } catch {}
}

// ─── Google Places API (New) ────────────────────────────────────────────────

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Diccionario rubro (es) → includedType de Google Places (Table A). Opcional:
// si no hay match, la búsqueda se apoya solo en textQuery (rubro + ubicación).
const RUBRO_INCLUDED_TYPE: { match: string; type: string }[] = [
  { match: "gastronomia", type: "restaurant" },
  { match: "tecnologia", type: "electronics_store" },
  { match: "salud y bienestar", type: "pharmacy" },
  { match: "moda y ropa", type: "clothing_store" },
  { match: "construccion", type: "hardware_store" },
  { match: "educacion", type: "school" },
  { match: "finanzas", type: "bank" },
  { match: "turismo y hoteleria", type: "lodging" },
  { match: "inmobiliaria", type: "real_estate_agency" },
  { match: "automotriz", type: "car_repair" },
  { match: "consultoria", type: "consultant" },
  { match: "logistica", type: "moving_company" },
  { match: "retail", type: "store" },
  { match: "deporte y fitness", type: "gym" },
  { match: "belleza y estetica", type: "beauty_salon" },
  { match: "legal y juridico", type: "lawyer" },
  { match: "arquitectura y diseno", type: "architect" },
];

function googlePlaceToPlace(p: any): any {
  return {
    place_id: p.id,
    name: p.displayName?.text || "",
    formatted_phone_number: p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    formatted_address: p.formattedAddress || null,
    types: p.types || [],
    primary_type: p.primaryType || p.types?.[0] || null,
    rating: p.rating ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    business_status: p.businessStatus || null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  };
}

const GOOGLE_FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location",
  "places.internationalPhoneNumber", "places.websiteUri",
  "places.rating", "places.userRatingCount", "places.businessStatus",
  "places.types", "places.primaryType", "nextPageToken",
].join(",");

type Geo = { lat: number; lng: number; radiusKm: number };

// Distancia haversine en km entre dos puntos.
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Text Search (New) devuelve hasta 20 resultados por página, con todos los
// campos del fieldMask ya incluidos (no hace falta una llamada Details aparte).
// Se limitan las páginas a 2 (máx. 40 resultados) para controlar el costo/latencia.
async function searchPlacesGoogle(rubro: string, location: string, cantidad: number, geo?: Geo): Promise<any[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];

  const norm = normalize(rubro);
  const includedType = RUBRO_INCLUDED_TYPE.find((r) => norm.includes(r.match))?.type;

  const places: any[] = [];
  let pageToken: string | undefined;
  const maxPages = 2;

  for (let page = 0; page < maxPages && places.length < cantidad; page++) {
    const body: any = {
      textQuery: geo ? rubro : `${rubro} en ${location}`,
      languageCode: "es",
      maxResultCount: 20,
    };
    if (geo) {
      // Text Search (New) solo admite circle en locationBias (sesgo), no en locationRestriction
      // (esa combinación devuelve 400 INVALID_ARGUMENT). El radio exacto se aplica después
      // filtrando por distancia real, ya que el bias es una sugerencia, no un límite duro.
      body.locationBias = {
        circle: {
          center: { latitude: geo.lat, longitude: geo.lng },
          radius: Math.min(geo.radiusKm * 1000, 50000),
        },
      };
    }
    if (includedType) body.includedType = includedType;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[Margarita Scrape] Google Places searchText → HTTP ${res.status}: ${errText.slice(0, 300)}`);
      break;
    }

    const data = await res.json();
    let batch = (data.places || []).filter((p: any) => p.displayName?.text).map(googlePlaceToPlace);
    if (geo) {
      // locationBias es una sugerencia; se descarta lo que caiga fuera del radio real dibujado.
      batch = batch.filter((p: any) =>
        p.lat == null || p.lng == null || distanceKm(geo, { lat: p.lat, lng: p.lng }) <= geo.radiusKm
      );
    }
    places.push(...batch);
    await Promise.all(batch.map((p: any) => setCachedPlace(p.place_id, p, "google")));

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    // El nextPageToken de Places API (New) tarda unos segundos en activarse.
    await new Promise((r) => setTimeout(r, 2000));
  }

  return places.slice(0, cantidad);
}

// ─── OpenStreetMap helpers (Overpass + Nominatim, sin API key) ──────────────
// Fallback gratuito cuando no hay GOOGLE_PLACES_API_KEY o Google Places falla.

const NOMINATIM_UA = "NL360-Margarita/1.0 (comunicacion@colonia.cloud)";

// Espejos públicos de Overpass; se prueban en orden hasta que uno responda JSON.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Diccionario rubro (es) → tag OSM. Claves = categorías del select (ScrapePanel RUBROS),
// sin acentos y en minúscula (ver normalize()). value puede ser regex multivalor (a|b|c).
const RUBRO_TAGS: { match: string; key: string; value: string }[] = [
  { match: "gastronomia",           key: "amenity", value: "restaurant|cafe|bar|fast_food|ice_cream|pub|food_court" },
  { match: "tecnologia",            key: "shop",    value: "computer|electronics|mobile_phone" },
  { match: "salud y bienestar",     key: "amenity", value: "pharmacy|clinic|doctors|dentist|hospital|physiotherapist" },
  { match: "moda y ropa",           key: "shop",    value: "clothes|shoes|boutique|fashion|accessories" },
  { match: "construccion",          key: "shop",    value: "hardware|building_materials|doityourself" },
  { match: "educacion",             key: "amenity", value: "school|college|university|language_school|driving_school" },
  { match: "finanzas",              key: "amenity", value: "bank|bureau_de_change|atm" },
  { match: "marketing y publicidad",key: "office",  value: "advertising_agency|marketing|media" },
  { match: "turismo y hoteleria",   key: "tourism", value: "hotel|hostel|guest_house|motel|apartment" },
  { match: "inmobiliaria",          key: "office",  value: "estate_agent" },
  { match: "automotriz",            key: "shop",    value: "car|car_repair|car_parts|tyres|motorcycle" },
  { match: "consultoria",           key: "office",  value: "consulting|company|it" },
  { match: "logistica",             key: "shop",    value: "courier|logistics|storage" },
  { match: "retail",                key: "shop",    value: "supermarket|convenience|department_store|mall" },
  { match: "industria y manufactura",key: "industrial", value: "factory|warehouse" },
  { match: "deporte y fitness",     key: "leisure", value: "fitness_centre|sports_centre|gym|swimming_pool" },
  { match: "belleza y estetica",    key: "shop",    value: "hairdresser|beauty|cosmetics|perfumery|nail_salon" },
  { match: "legal y juridico",      key: "office",  value: "lawyer|notary" },
  { match: "arquitectura y diseno", key: "office",  value: "architect|designer" },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Geocodifica una ubicación libre ("Buenos Aires, Argentina") a un bounding box OSM.
// Devuelve [south, north, west, east] (formato boundingbox de Nominatim).
async function geocodeArea(location: string): Promise<[string, string, string, string] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", location);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "es" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit?.boundingbox || hit.boundingbox.length !== 4) return null;
  return hit.boundingbox;
}

// Construye el shape que espera el handler a partir de un elemento OSM de Overpass.
// rating/user_ratings_total/business_status no existen en OSM → siempre null.
function osmElementToPlace(el: any): any {
  const t = el.tags || {};
  const addr = [
    [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "),
    t["addr:city"] || t["addr:suburb"],
    t["addr:state"],
  ].filter(Boolean).join(", ");
  return {
    place_id: String(el.id),
    name: t.name || "",
    formatted_phone_number: t.phone || t["contact:phone"] || null,
    website: t.website || t["contact:website"] || null,
    formatted_address: addr || null,
    types: [],
    rating: null,
    user_ratings_total: null,
    business_status: null,
  };
}

// Bounding box [south, north, west, east] a partir de un centro + radio en km
// (aproximación esférica, suficiente para el uso de Overpass).
function bboxFromGeo(geo: Geo): [string, string, string, string] {
  const dLat = geo.radiusKm / 111;
  const dLng = geo.radiusKm / (111 * Math.cos((geo.lat * Math.PI) / 180));
  return [
    String(geo.lat - dLat), String(geo.lat + dLat),
    String(geo.lng - dLng), String(geo.lng + dLng),
  ];
}

// Fallback OSM: busca vía Overpass cuando no hay Google Places API key o falló.
async function searchPlacesOSM(rubro: string, location: string, cantidad: number, geo?: Geo): Promise<any[]> {
  const bbox = geo ? bboxFromGeo(geo) : (location ? await geocodeArea(location) : null);
  if (!bbox) return [];
  const [south, north, west, east] = bbox;
  const bb = `(${south},${west},${north},${east})`; // Overpass: (south,west,north,east)

  const norm = normalize(rubro);
  const tag = RUBRO_TAGS.find((r) => norm.includes(r.match));

  // Con tag del diccionario → filtro por tag. Sin tag → fallback por nombre (amenity o shop).
  const safeRubro = rubro.replace(/["\\]/g, "");
  const selectors = tag
    ? `  nwr["${tag.key}"~"${tag.value}"]${bb};`
    : `  nwr["name"~"${safeRubro}",i]["amenity"]${bb};\n` +
      `  nwr["name"~"${safeRubro}",i]["shop"]${bb};`;

  const oql = `[out:json][timeout:25];\n(\n${selectors}\n);\nout center tags ${Math.min(cantidad, 200)};`;

  // Probar mirrors en orden; el primero que responda JSON válido gana. Si todos fallan → [].
  let elements: any[] = [];
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": NOMINATIM_UA,   // evita 429 de los mirrors de Overpass
          "Accept": "application/json",  // evita 406 de overpass-api.de
        },
        body: "data=" + encodeURIComponent(oql),
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn(`[Margarita Scrape] Overpass mirror ${mirror} → HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) {
        console.warn(`[Margarita Scrape] Overpass mirror ${mirror} → content-type no JSON: ${ct}`);
        continue;
      }
      const data = await res.json();
      elements = Array.isArray(data?.elements) ? data.elements : [];
      break; // mirror funcionó, salir del loop
    } catch (err: any) {
      console.warn(`[Margarita Scrape] Overpass mirror ${mirror} → error: ${err.message}`);
    }
  }

  const places = elements
    .filter((el) => el.tags?.name) // descartar elementos sin nombre
    .map(osmElementToPlace);

  // Llenar la caché para getPlaceDetails (clave = id OSM, valor determinístico por id).
  await Promise.all(places.map((p) => setCachedPlace(p.place_id, p, "osm")));

  return places.slice(0, cantidad);
}

// Google Places primero (si hay API key); si falla o no trae resultados, OSM.
// `query` llega como "<rubro> en <location>" desde el handler. `geo` (centro+radio del
// mapa) tiene prioridad sobre `location` como criterio de área para ambos proveedores.
async function searchPlaces(query: string, cantidad: number, geo?: Geo): Promise<any[]> {
  const sep = query.indexOf(" en ");
  const rubro = (sep >= 0 ? query.slice(0, sep) : query).trim();
  const location = sep >= 0 ? query.slice(sep + 4).trim() : "";

  if (GOOGLE_PLACES_API_KEY) {
    try {
      const results = await searchPlacesGoogle(rubro, location, cantidad, geo);
      if (results.length > 0) return results;
    } catch (err: any) {
      console.warn("[Margarita Scrape] Google Places falló, fallback a OSM:", err.message);
    }
  }

  return searchPlacesOSM(rubro, location, cantidad, geo);
}

// Ambos proveedores ya devuelven todos los datos en searchPlaces; aquí solo leemos la caché.
async function getPlaceDetails(placeId: string): Promise<any> {
  return getCachedPlace(placeId);
}

// ─── Website analysis via Claude ───────────────────────────────────────────

async function analyzeWebsite(website: string): Promise<{
  hasWhatsapp: boolean;
  platform: string | null;
  platforms: string[];
}> {
  try {
    // Fetch website HTML with short timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(website, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NL360Bot/1.0)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return { hasWhatsapp: false, platform: null, platforms: [] };

    const html = await res.text();
    const snippet = html.slice(0, 12000); // first 12k chars is enough

    const msg = await anthropic.messages.create({
      model: SCRAPE_MODEL,
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `Analiza este fragmento de HTML y responde SOLO con JSON valido (sin markdown):
{
  "hasWhatsapp": boolean,   // true si hay link wa.me, api.whatsapp o boton de WhatsApp
  "platforms": string[]     // lista de plataformas detectadas. Posibles valores: "tiendanube", "mercadoshops", "shopify", "woocommerce", "wix", "squarespace", "prestashop", "magento", "jumpseller", "vtex", "otro"
}

HTML:
${snippet}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(cleaned);
    return {
      hasWhatsapp: Boolean(result.hasWhatsapp),
      platform: result.platforms?.[0] || null,
      platforms: result.platforms || [],
    };
  } catch {
    return { hasWhatsapp: false, platform: null, platforms: [] };
  }
}

// ─── TEMP: detección de duplicados entre usuarios (borrar en unos días) ────
// Marca cada lead scrapeado si el teléfono ya existe en mm_contacts de OTRO
// usuario (_dupAdded) y si ese contacto ya fue contactado por WA o email por
// ese otro usuario (_dupContacted). Solo afecta la respuesta del scrape, no
// se persiste en mm_contacts.

function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

async function checkDuplicates(contacts: any[], currentUserId: number): Promise<void> {
  const phones = Array.from(
    new Set(contacts.map((c) => normalizePhone(c.telefono)).filter(Boolean))
  ) as string[];
  if (!phones.length) return;

  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = (await pool.execute(
      `SELECT mc.id, mc.telefono,
              (SELECT COUNT(*) FROM mm_campaign_recipients r
                 WHERE r.contact_id = mc.id AND r.status IN ('sent','delivered','read')) AS wa_sent,
              (SELECT COUNT(*) FROM mm_email_campaign_recipients r
                 WHERE r.contact_id = mc.id AND r.status IN ('sent','opened')) AS email_sent
       FROM mm_contacts mc
       WHERE mc.user_id != ? AND mc.telefono IS NOT NULL`,
      [currentUserId]
    )) as any;

    const addedPhones = new Set<string>();
    const contactedPhones = new Set<string>();
    const phoneSet = new Set(phones);

    for (const row of rows) {
      const p = normalizePhone(row.telefono);
      if (!p || !phoneSet.has(p)) continue;
      addedPhones.add(p);
      if (row.wa_sent > 0 || row.email_sent > 0) contactedPhones.add(p);
    }

    for (const c of contacts) {
      const p = normalizePhone(c.telefono);
      c._dupAdded = !!(p && addedPhones.has(p));
      c._dupContacted = !!(p && contactedPhones.has(p));
    }
  } catch (err) {
    console.error("[Margarita Scrape] checkDuplicates error:", err);
  }
}

// ─── AI batch scoring ──────────────────────────────────────────────────────

async function scoreLeadsWithAI(leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadsForScoring = leads.map((l, i) => ({
    index: i,
    nombre: l.nombre,
    hasWebsite: !!l._website,
    website: l._website || null,
    hasPhone: !!l.telefono,
    hasWhatsapp: l._hasWhatsapp ?? false,
    platforms: l._platforms ?? [],
    rating: l._rating ?? null,
    totalReviews: l._totalReviews ?? null,
    category: l._primaryType ?? null,
  }));

  const prompt = `Sos un experto en calificación de leads para una agencia de marketing digital
que vende sitios web y presencia online a negocios locales latinoamericanos.

Analizá estos negocios y asignale a cada uno un score de 0-100 según qué tan buen lead es
para venderle servicios de presencia digital (sitio web, redes, etc).

Criterios de scoring (señales principales: tiene web o no, tiene teléfono o no, nombre del negocio):
- Sin website en absoluto → score 75-95 (excelente lead, necesita presencia)
- Sin website + tiene teléfono de contacto → score 85-95 (lead premium, contactable y sin web)
- Sin website + tiene WhatsApp business → score 80-90 (semi-digitalizado, receptivo)
- Sin website pero sin teléfono → score 70-80 (buen lead, falta confirmar contacto)
- Solo tiene redes sociales como plataforma → score 70-85
- Website muy básico o desactualizado → score 40-65
- Website presente pero sin evaluar → score 20-40
- Website profesional y completo → score 5-20 (mal lead para nosotros)

Señales adicionales de Google Maps (rating/totalReviews), cuando NO son null, afinan el score:
- Rating alto (>=4.3) con muchas reviews (>=50) y sin website → score 90-98 (negocio activo y con
  reputación comprobada que aún no invirtió en presencia digital: lead premium).
- Rating bajo (<3.5) o muy pocas reviews (<5) → restar 5-15 puntos (negocio posiblemente poco activo
  o de baja calidad, priorizarlo menos aunque no tenga web).
- Si rating/totalReviews son null (proveedor sin esos datos), ignorá esta sección y usá solo las
  señales base de arriba.

Devolvé ÚNICAMENTE un array JSON válido, sin markdown, sin texto extra.
Formato exacto (un objeto por lead, mismo orden que el input):
[
  {
    "index": 0,
    "score": 85,
    "priority": "high",
    "website_quality": "none",
    "reason": "Negocio sin sitio web propio pero con teléfono de contacto. Lead premium."
  }
]

Reglas para priority:
- score >= 70 → "high"
- score 40-69 → "medium"
- score < 40 → "low"

Reglas para website_quality:
- Sin website → "none"
- Website básico/dudoso → "poor"
- Website funcional → "decent"
- Website profesional → "good"

Leads a analizar:
${JSON.stringify(leadsForScoring, null, 2)}`;

  try {
    const response = await anthropic.messages.create({
      model: SCRAPE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    const clean = raw.replace(/```json|```/g, "").trim();
    const scores: any[] = JSON.parse(clean);

    // Merge scores back into leads
    return leads.map((lead, i) => {
      const s = scores.find((x: any) => x.index === i);
      if (!s) return lead;
      return {
        ...lead,
        score: s.score,
        priority: s.priority,
        website_quality: s.website_quality,
        reason: s.reason,
      };
    });
  } catch (err) {
    console.error("[Margarita Scrape] scoreLeadsWithAI error:", err);
    // Si falla el scoring, devolver leads sin score (no romper el scrape)
    return leads;
  }
}

// ─── POST /api/margarita/crm/scrape ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    const body = await req.json();
    const {
      rubro,
      pais,
      estado,
      ciudad,
      cantidad = 15,
      lat,        // number | undefined — centro elegido en el mapa
      lng,        // number | undefined
      radiusKm,   // number | undefined — radio del círculo del mapa
      // Filtros
      filterHasWebsite,      // "yes" | "no" | null
      filterHasWhatsapp,     // "yes" | "no" | null  (requiere website)
      filterPlatforms,       // string[] — ["tiendanube","mercadoshops",...] vacío = no filtrar
    } = body;

    if (!rubro || !pais) {
      return NextResponse.json({ error: "rubro y pais son requeridos" }, { status: 422 });
    }

    const geo: Geo | undefined =
      typeof lat === "number" && typeof lng === "number" && typeof radiusKm === "number"
        ? { lat, lng, radiusKm }
        : undefined;

    // Build Places query
    const location = [ciudad, estado, pais].filter(Boolean).join(", ");
    const query = `${rubro} en ${location}`;

    // 1. Fetch from Google Places (fetch more to compensate for filtering)
    const fetchQty = Math.min(60, cantidad * 3);
    const rawPlaces = await searchPlaces(query, fetchQty, geo);

    // 2. Get details for each (parallel, max 10 at a time)
    const needsWebsiteAnalysis =
      filterHasWhatsapp === "yes" || filterHasWhatsapp === "no" ||
      (Array.isArray(filterPlatforms) && filterPlatforms.length > 0);

    const detailed: any[] = [];
    const batchSize = 10;
    for (let i = 0; i < rawPlaces.length; i += batchSize) {
      const batch = rawPlaces.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((p) => getPlaceDetails(p.place_id)));
      detailed.push(...results.filter(Boolean));
    }

    // 3. Apply filter: has_website (descarta también negocios cerrados permanentemente, si el dato existe)
    let filtered = detailed.filter((p) => p.business_status !== "CLOSED_PERMANENTLY");

    if (filterHasWebsite === "yes") {
      filtered = filtered.filter((p) => !!p.website);
    } else if (filterHasWebsite === "no") {
      filtered = filtered.filter((p) => !p.website);
    }

    // 4. Website analysis (WhatsApp + platform detection) — only for places with websites
    let analyzed: (any & { _analysis?: ReturnType<typeof analyzeWebsite> extends Promise<infer T> ? T : never })[] = filtered;

    if (needsWebsiteAnalysis) {
      const withWebsite = filtered.filter((p) => !!p.website);
      const withoutWebsite = filtered.filter((p) => !p.website);

      // Analyze in parallel (max 8 at once)
      const analysisResults: any[] = [];
      for (let i = 0; i < withWebsite.length; i += 8) {
        const batch = withWebsite.slice(i, i + 8);
        const results = await Promise.all(
          batch.map(async (p) => ({ ...p, _analysis: await analyzeWebsite(p.website) }))
        );
        analysisResults.push(...results);
      }

      // Merge: places without website get empty analysis
      analyzed = [
        ...analysisResults,
        ...withoutWebsite.map((p) => ({ ...p, _analysis: { hasWhatsapp: false, platform: null, platforms: [] } })),
      ];

      // Apply WhatsApp filter
      if (filterHasWhatsapp === "yes") {
        analyzed = analyzed.filter((p) => p._analysis?.hasWhatsapp === true);
      } else if (filterHasWhatsapp === "no") {
        analyzed = analyzed.filter((p) => !p._analysis?.hasWhatsapp);
      }

      // Apply platform filter
      if (Array.isArray(filterPlatforms) && filterPlatforms.length > 0) {
        analyzed = analyzed.filter((p) =>
          filterPlatforms.some((fp: string) => p._analysis?.platforms?.includes(fp))
        );
      }
    }

    // 5. Trim to requested quantity and map to CRM contact format
    let contacts: any[] = analyzed.slice(0, cantidad).map((p) => {
      // Extract city/country from formatted_address
      const addressParts = (p.formatted_address || "").split(",").map((s: string) => s.trim());
      const inferredCity = ciudad || addressParts[1] || null;

      return {
        nombre: p.name || "",
        empresa: p.name || null,
        email: null,
        telefono: p.formatted_phone_number || null,
        pais: pais,
        ciudad: inferredCity,
        direccion: p.formatted_address || null,
        notas: p.website
          ? `Sitio web: ${p.website}${p._analysis?.platforms?.length ? ` | Plataforma: ${p._analysis.platforms.join(", ")}` : ""}${p._analysis?.hasWhatsapp ? " | Tiene WhatsApp" : ""}`
          : null,
        optin: 0,
        etiquetas: [rubro, ...(p._analysis?.platforms || [])].filter(Boolean),
        _website: p.website || null,
        _hasWhatsapp: p._analysis?.hasWhatsapp || false,
        _platforms: p._analysis?.platforms || [],
        _rating: p.rating ?? null,
        _totalReviews: p.user_ratings_total ?? null,
        _primaryType: p.primary_type ?? null,
      };
    });

    // 5b. TEMP: marcar duplicados entre usuarios (teléfono ya agregado/contactado)
    await checkDuplicates(contacts, user.id);

    // 6. AI batch scoring (1 sola llamada para todos los leads)
    contacts = await scoreLeadsWithAI(contacts);

    // Ordenar por score descendente (los mejores leads primero)
    contacts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return NextResponse.json({ contacts, rubro, location, total: contacts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
