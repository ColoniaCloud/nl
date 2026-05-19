import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY!;

async function getUser(token: string): Promise<{ id: number } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    return data.user?.id ? { id: data.user.id } : null;
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id } : null;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Google Places helpers ──────────────────────────────────────────────────

async function searchPlaces(query: string, cantidad: number): Promise<any[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", PLACES_KEY);
  url.searchParams.set("language", "es");

  const all: any[] = [];
  let nextPageToken: string | null = null;

  do {
    if (nextPageToken) {
      await new Promise((r) => setTimeout(r, 2000)); // Places API requires delay for next_page_token
      url.searchParams.set("pagetoken", nextPageToken);
    } else {
      url.searchParams.delete("pagetoken");
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json();
    if (data.results) all.push(...data.results);
    nextPageToken = data.next_page_token || null;
  } while (nextPageToken && all.length < cantidad);

  return all.slice(0, cantidad);
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_phone_number,website,formatted_address,types");
  url.searchParams.set("key", PLACES_KEY);
  url.searchParams.set("language", "es");

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();
  return data.result || null;
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
      model: "claude-haiku-4-5-20251001",
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

// ─── POST /api/margarita/crm/scrape ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

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
    const contacts = analyzed.slice(0, cantidad).map((p) => {
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
      };
    });

    return NextResponse.json({ contacts, rubro, location, total: contacts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
