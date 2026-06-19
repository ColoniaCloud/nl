import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "@/lib/agents";
import { checkAgentAccess } from "@/lib/billing-access";

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

// ─── OpenStreetMap helpers (Overpass + Nominatim, sin API key) ──────────────

// Caché de detalles por id de elemento OSM. searchPlaces la llena; getPlaceDetails la lee.
// Segura ante requests concurrentes: la clave es el id OSM y el valor es determinístico por id.
const osmDetailsCache = new Map<string, any>();

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

// Reemplaza Google Places Text Search con Overpass (OpenStreetMap).
// `query` llega como "<rubro> en <location>" desde el handler; lo separamos por " en ".
async function searchPlaces(query: string, cantidad: number): Promise<any[]> {
  const sep = query.indexOf(" en ");
  const rubro = (sep >= 0 ? query.slice(0, sep) : query).trim();
  const location = sep >= 0 ? query.slice(sep + 4).trim() : "";

  const bbox = location ? await geocodeArea(location) : null;
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
  for (const p of places) osmDetailsCache.set(p.place_id, p);

  return places.slice(0, cantidad);
}

// Con Overpass ya tenemos todos los datos en searchPlaces; aquí solo leemos la caché.
async function getPlaceDetails(placeId: string): Promise<any> {
  return osmDetailsCache.get(placeId) || null;
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
      // Filtros
      filterHasWebsite,      // "yes" | "no" | null
      filterHasWhatsapp,     // "yes" | "no" | null  (requiere website)
      filterPlatforms,       // string[] — ["tiendanube","mercadoshops",...] vacío = no filtrar
    } = body;

    if (!rubro || !pais) {
      return NextResponse.json({ error: "rubro y pais son requeridos" }, { status: 422 });
    }

    // Build Places query
    const location = [ciudad, estado, pais].filter(Boolean).join(", ");
    const query = `${rubro} en ${location}`;

    // 1. Fetch from Google Places (fetch more to compensate for filtering)
    const fetchQty = Math.min(60, cantidad * 3);
    const rawPlaces = await searchPlaces(query, fetchQty);

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

    // 3. Apply filter: has_website
    let filtered = detailed;

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
      };
    });

    // 6. AI batch scoring (1 sola llamada para todos los leads)
    contacts = await scoreLeadsWithAI(contacts);

    // Ordenar por score descendente (los mejores leads primero)
    contacts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return NextResponse.json({ contacts, rubro, location, total: contacts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
