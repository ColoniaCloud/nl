import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import getPool from "@/lib/db-manu";
import {
  buildLiteSiteFiles,
  normalizeGenerationMode,
  resolveEffectiveMode,
  validateLiteFallbackScope,
  validateLiteManualScope,
} from "@/lib/manu-dev-lite-site";
import {
  markBuildFailed,
  markBuildQueued,
  markBuildSuccess,
  prepareBuildInfra,
  queueBuild,
} from "@/lib/manu-dev-build";
import { generateLitePlusSite } from "@/lib/manu-dev-lite-plus";
import { DAILY_BUILD_CAP, validateModeForRoles } from "@/lib/billing-plans";
import { checkMaxSites } from "@/lib/billing-access";
import type { SiteGenerationMode } from "@/lib/billing-plans";
import { getAgent } from "@/lib/agents";
import { sendBuildErrorReport } from "@/lib/email";

const CREATE_SITE_MODEL = getAgent("manu-dev")!.models!["create-site"];

export const runtime = "nodejs";
export const maxDuration = 300;

const execAsync = promisify(exec);
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;
const SITES_DIR = "/opt/docker-apps/sites";
const GENERATION_TIMEOUT_MS = Number(process.env.MANU_DEV_GENERATION_TIMEOUT_MS || 240000);
const UNSPLASH_TIMEOUT_MS = Number(process.env.MANU_DEV_UNSPLASH_TIMEOUT_MS || 10000);

function formatProviderError(err: any, provider: string): string {
  const raw = String(err?.message || "error").toLowerCase();
  if (raw.includes("timeout") || raw.includes("timed out") || err?.name === "AbortError") {
    return `${provider}: timeout de red. Intenta nuevamente.`;
  }
  if (raw.includes("429") || raw.includes("rate") || raw.includes("quota")) {
    return `${provider}: limite temporal alcanzado. Reintenta en unos segundos.`;
  }
  if (raw.includes("503") || raw.includes("502") || raw.includes("overloaded")) {
    return `${provider}: servicio temporalmente no disponible.`;
  }
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("econn") || raw.includes("enotfound")) {
    return `${provider}: error de conexion de red.`;
  }
  return `${provider}: ${String(err?.message || "error no identificado")}`;
}

/** Classify whether an error is transient (worth retrying) or permanent */
function isTransientError(err: any): boolean {
  const raw = String(err?.message || "").toLowerCase();
  // Permanent errors — do NOT retry
  if (raw.includes("429") || raw.includes("rate") || raw.includes("quota")) return false;
  if (raw.includes("401") || raw.includes("403") || raw.includes("auth")) return false;
  if (raw.includes("invalid") && raw.includes("key")) return false;
  // Transient errors — retry
  if (raw.includes("timeout") || raw.includes("timed out") || err?.name === "AbortError") return true;
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("econn") || raw.includes("enotfound")) return true;
  if (raw.includes("503") || raw.includes("502") || raw.includes("overloaded")) return true;
  if (raw.includes("econnreset") || raw.includes("epipe") || raw.includes("socket")) return true;
  // Unknown errors — treat as transient (better to retry than fail)
  return true;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} excedio el timeout de ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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

async function fetchUnsplashPhotos(
  query: string,
  count = 6
): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), UNSPLASH_TIMEOUT_MS);
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        signal: abort.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const photos = await res.json();
    return photos.map(
      (p: any) => `${p.urls.regular}&w=1200&q=80` // credit: photo by ${p.user.name} on Unsplash
    );
  } catch (err: any) {
    console.warn("[create-site]", formatProviderError(err, "Unsplash"));
    return [];
  }
}

// Fixed boilerplate files — written by us, not Gemini, to save tokens and ensure correctness
const BOILERPLATE: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "site",
      version: "1.0.0",
      private: true,
      scripts: { build: "next build", start: "next start" },
      // Next 14 + React 18: stable, no --legacy-peer-deps needed
      dependencies: { next: "14.2.20", react: "18.3.1", "react-dom": "18.3.1", "lucide-react": "^0.460.0" },
    },
    null,
    2
  ),
  "next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;`,
  Dockerfile: `FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","start"]`,
  // Social links — managed via admin panel, starts empty; updated without rebuild of JS
  "app/social-links.js": `// Redes sociales — administradas desde el panel de control\nexport const socialLinks = [];\n`,
  // Curated icon re-exports — model imports from './icons' or '../icons' instead of lucide-react directly
  "app/icons.jsx": `export {
  Phone, Mail, MapPin, Clock, Star, CheckCircle, ArrowRight, ArrowLeft,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Menu, X, Search, Filter, ShoppingBag, ShoppingCart,
  Heart, Share2, Facebook, Instagram, Twitter, Youtube, Linkedin,
  MessageCircle, Send, Globe, ExternalLink,
  User, Users, Award, TrendingUp, BarChart2, PieChart,
  Home, Building2, Briefcase, Calendar, Image, Video,
  Play, Pause, Volume2, Music2, Camera, Eye,
  Zap, Shield, Lock, Key, Settings, Info,
  Plus, Minus, Edit2, Trash2, Upload, Download,
  Check, AlertTriangle, HelpCircle, Sparkles,
} from 'lucide-react';
`,
  // Simple placeholder for dynamic slug routes — avoids asking Claude to generate
  // large data-heavy files that get truncated
  "app/[slug]/page.jsx": `export default function Page({ params }) {
  return (
    <main style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>Página en construcción</h1>
      <p style={{ marginBottom: "2rem", opacity: 0.7 }}>Esta sección estará disponible pronto.</p>
      <a href="/" style={{ display: "inline-block", padding: "0.75rem 1.5rem", background: "var(--color-primary, #1a1a2e)", color: "#fff", borderRadius: "0.5rem", textDecoration: "none", fontWeight: 600 }}>
        ← Volver al inicio
      </a>
    </main>
  );
}`,
};

/**
 * Remove any next/image usage from JSX files and replace with plain <img>.
 * Claude sometimes generates `import Image from 'next/image'` + <Image layout="fill" ...>
 * despite being told not to, which breaks Next.js 14+ at runtime.
 */
function sanitizeJSX(content: string): string {
  // Remove next/image import lines
  let out = content.replace(/^.*import\s+\w+\s+from\s+['"]next\/image['"]\s*;?\s*\n?/gm, "");

  // Replace <Image ... /> (self-closing) with <img>
  // Strategy: find <Image ... /> and convert attributes
  out = out.replace(/<Image\b([\s\S]*?)\/>/g, (_match, attrs) => {
    return buildImgTag(attrs);
  });

  // Replace <Image ...> (non self-closing, treat same way)
  out = out.replace(/<Image\b([\s\S]*?)>/g, (_match, attrs) => {
    return buildImgTag(attrs);
  });

  // Remove closing </Image> tags if any
  out = out.replace(/<\/Image>/g, "");

  return out;
}

/**
 * Checks that a JSX/JS file looks syntactically complete by verifying
 * that braces, brackets and parens are balanced.
 * Returns false if likely truncated.
 */
function isJSXComplete(content: string): boolean {
  let braces = 0, brackets = 0, parens = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === "\\" && (inSingle || inDouble || inTemplate)) { i++; continue; }
    if (c === "'" && !inDouble && !inTemplate) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle && !inTemplate) { inDouble = !inDouble; continue; }
    if (c === "`" && !inSingle && !inDouble) { inTemplate = !inTemplate; continue; }
    if (inSingle || inDouble || inTemplate) continue;
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (c === "[") brackets++;
    if (c === "]") brackets--;
    if (c === "(") parens++;
    if (c === ")") parens--;
  }
  if (braces !== 0 || brackets !== 0 || parens !== 0) return false;
  // Also verify the file ends with a recognizable JSX/JS terminator (not mid-string or mid-tag)
  const lastLine = content.trimEnd().split("\n").pop()?.trim() ?? "";
  return /^[}\);]/.test(lastLine) || lastLine.endsWith("/>") || lastLine.endsWith(">");
}

function buildImgTag(attrs: string): string {
  // Extract src
  const srcMatch = attrs.match(/src=\{([^}]+)\}|src="([^"]+)"|src='([^']+)'/);
  const src = srcMatch ? (srcMatch[1] || srcMatch[2] || srcMatch[3]) : '""';

  // Extract alt
  const altMatch = attrs.match(/alt=\{([^}]+)\}|alt="([^"]+)"|alt='([^']+)'/);
  const alt = altMatch ? (altMatch[1] || altMatch[2] || altMatch[3]) : "";

  // Build clean <img> — drop layout, objectFit, objectPosition, fill, quality, priority, sizes, placeholder
  const srcAttr = srcMatch?.[1] ? `src={${src}}` : `src="${src}"`;
  const altAttr = altMatch?.[1] ? `alt={${alt}}` : `alt="${alt}"`;

  return `<img ${srcAttr} ${altAttr} style={{width:"100%",height:"100%",objectFit:"cover"}} />`;
}

/** Common business/design context block used in both prompts */
function buildBusinessBlock(project: any, design: any, pages: any[]): string {
  const pageList = pages
    .map((p) => {
      const sections = Array.isArray(p.content_json)
        ? p.content_json
        : JSON.parse(p.content_json || "[]");
      return `  - ${p.title} (slug: "${p.slug}", secciones: ${sections.join(", ")})`;
    })
    .join("\n");

  const location = project.location || "America Latina";
  const rawExtra = project.extra_content || "";
  const truncatedExtra = rawExtra.length > 2000 ? rawExtra.slice(0, 2000) + "\n[...contenido adicional truncado]" : rawExtra;
  const extraContent = truncatedExtra ? `\nCONTENIDO ADICIONAL DEL NEGOCIO (usa esto para rellenar secciones con info real):\n${truncatedExtra}` : "";

  const fontHeading = design?.font_heading || "Inter";
  const fontBody = design?.font_body || "Inter";
  const siteType = project.site_type || "informational";
  const addressType = project.address_type || "regional";

  let socialInfo = "";
  let contactEmail = "";
  try {
    const links = typeof project.social_links === "string" ? JSON.parse(project.social_links || "[]") : (project.social_links || []);
    if (Array.isArray(links) && links.length > 0) {
      const socialLinks = links.filter((l: any) => l.platform !== "email");
      const emailLink = links.find((l: any) => l.platform === "email");
      if (emailLink) contactEmail = emailLink.value || emailLink.url || "";
      if (socialLinks.length > 0) {
        socialInfo = `\nREDES SOCIALES del negocio:\n${socialLinks.map((l: any) => `  - ${l.platform}: ${l.url || l.value}`).join("\n")}`;
      }
    }
  } catch {}

  const addressContext = addressType === "specific"
    ? `- Direccion: ${project.location || "sin especificar"} (zona especifica — usa esta referencia para contenido local preciso)`
    : `- Zona de operacion: ${project.location || "America Latina"} (regional — genera contenido apropiado para toda la zona)`;

  return `NEGOCIO:
- Nombre: ${project.name}
- Industria: ${project.industry}
- Tipo de sitio: ${siteType} (${siteType === "store" ? "tienda/ecommerce" : siteType === "blog" ? "blog/contenido" : "informativo/servicios"})
- Descripcion: ${project.description || "Negocio profesional"}
- Audiencia: ${project.audience || "publico general"}
${addressContext}
- Color primario: ${design?.primary_color || "#1a1a2e"}
- Color secundario: ${design?.secondary_color || "#16213e"}
- Color acento: ${design?.accent_color || "#0f3460"}
- Tipografia titulos: ${fontHeading}
- Tipografia cuerpo: ${fontBody}${contactEmail ? `\n- EMAIL DE CONTACTO: ${contactEmail} (usa mailto:${contactEmail} en pie de pagina y en el action de todos los formularios de contacto)` : ""}
${socialInfo}
${extraContent}
PRECIOS (si incluyes productos, servicios o ejemplos con precio):
- Los precios DEBEN ser coherentes con la economia real de "${location}"
- Usa la moneda local apropiada (MXN para Mexico, COP para Colombia, ARS para Argentina, PEN para Peru, CLP para Chile, USD para Panama/Ecuador/El Salvador, etc.)
- NO uses precios simbolicos ($9.99) ni fuera de rango para el mercado local

PAGINAS DEL SITIO:
${pageList}`;
}

/** System-level instructions for all site generation calls — not repeated in user messages */
const SITE_SYSTEM_PROMPT = `Eres un generador experto de sitios web Next.js 14.

CRITICO — FORMATO: Responde SOLO con bloques ===FILE:ruta===...===END===. Empieza DIRECTAMENTE con ===FILE: sin texto previo, sin markdown, sin bloques de codigo.

CRITICO — IMAGENES: NUNCA uses "import Image from 'next/image'" ni el componente <Image>. Siempre usa <img src="url" alt="desc" style={{width:"100%",height:"100%",objectFit:"cover"}} />.

CRITICO — ICONOS: Importa iconos SIEMPRE desde './icons' en app/ o '../icons' en sub-paginas (ej: app/contacto/page.jsx). Ejemplo: import { Phone, Mail, Star, CheckCircle } from './icons'. NUNCA importes desde 'lucide-react' directamente. De 'react' solo importa hooks (camelCase): useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, memo, forwardRef, Fragment, Suspense, lazy, etc. NUNCA pongas un componente PascalCase en import from 'react'. NUNCA emojis como iconos. Iconos disponibles: Phone, Mail, MapPin, Clock, Star, CheckCircle, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Menu, X, Search, Filter, ShoppingBag, ShoppingCart, Heart, Share2, Facebook, Instagram, Twitter, Youtube, Linkedin, MessageCircle, Send, Globe, ExternalLink, User, Users, Award, TrendingUp, BarChart2, PieChart, Home, Building2, Briefcase, Calendar, Image, Video, Play, Pause, Volume2, Music2, Camera, Eye, Zap, Shield, Lock, Key, Settings, Info, Plus, Minus, Edit2, Trash2, Upload, Download, Check, AlertTriangle, HelpCircle, Sparkles.

DISENO: Mobile-first con breakpoints Tailwind (sm:, md:, lg:). Animaciones CSS (fadeInUp, hover transitions). Variables CSS custom en :root. Hero de pantalla completa (min-height:100vh) con imagen de fondo y overlay oscuro semitransparente.`;

// Whitelist of REAL React exports — anything PascalCase in `from "react"` NOT in this set
// is assumed to be a lucide-react icon and gets moved.
const KNOWN_REACT_EXPORTS = new Set([
  // Hooks
  "useState", "useEffect", "useRef", "useCallback", "useMemo", "useContext",
  "useReducer", "useLayoutEffect", "useId", "useDeferredValue", "useTransition",
  "useSyncExternalStore", "useInsertionEffect", "useImperativeHandle", "useDebugValue",
  "useOptimistic", "useFormStatus", "useActionState", "use",
  // Components & utilities
  "Fragment", "Suspense", "StrictMode", "Profiler",
  "Component", "PureComponent",
  "Children",
  // Higher-order
  "memo", "forwardRef", "lazy", "startTransition",
  // Creation
  "createElement", "cloneElement", "createContext", "createRef", "createPortal",
  "isValidElement",
]);

// Common HTML/framework components that should NOT be treated as lucide icons
const KNOWN_NON_ICON_COMPONENTS = new Set([
  "Link", "Head", "Script",
]);

/** Map Spanish industry name to English Unsplash search terms */
function buildUnsplashQuery(industry: string, siteType?: string): string {
  const ind = (industry || "").toLowerCase();
  if (ind.includes("restaurante") || ind.includes("comida") || ind.includes("gastro") || ind.includes("cafe") || ind.includes("bar"))
    return "restaurant food dining ambiance";
  if (ind.includes("salud") || ind.includes("clinica") || ind.includes("medic") || ind.includes("dental") || ind.includes("psico"))
    return "healthcare clinic medical professional";
  if (ind.includes("tecnolog") || ind.includes("software") || ind.includes("digital") || ind.includes("web") || ind.includes("app"))
    return "technology software modern workspace";
  if (ind.includes("moda") || ind.includes("ropa") || ind.includes("boutique") || ind.includes("tienda ropa"))
    return "fashion clothing boutique retail";
  if (ind.includes("belleza") || ind.includes("spa") || ind.includes("salon") || ind.includes("estetica") || ind.includes("cosmet"))
    return "beauty salon spa wellness";
  if (ind.includes("fitness") || ind.includes("gym") || ind.includes("gimnasio") || ind.includes("deporte") || ind.includes("entrena"))
    return "fitness gym workout training";
  if (ind.includes("inmobili") || ind.includes("real estate") || ind.includes("propiedad") || ind.includes("bienes raices"))
    return "real estate architecture modern home";
  if (ind.includes("educacion") || ind.includes("academia") || ind.includes("escuela") || ind.includes("curso") || ind.includes("universidad"))
    return "education learning study classroom";
  if (ind.includes("fotograf"))
    return "photography studio creative portrait";
  if (ind.includes("diseño") || ind.includes("diseno") || ind.includes("arte") || ind.includes("creativ") || ind.includes("agencia"))
    return "design creative studio modern";
  if (ind.includes("construccion") || ind.includes("arquitect"))
    return "construction architecture building";
  if (ind.includes("abogad") || ind.includes("legal") || ind.includes("notari") || ind.includes("juridic"))
    return "law office professional business";
  if (ind.includes("finanza") || ind.includes("contad") || ind.includes("inversion") || ind.includes("banco"))
    return "finance business professional corporate";
  if (ind.includes("hotel") || ind.includes("hosped") || ind.includes("turismo") || ind.includes("viaje") || ind.includes("resort"))
    return "hotel travel hospitality luxury";
  if (ind.includes("taller") || ind.includes("automotri") || ind.includes("mecanica") || ind.includes("auto"))
    return "automotive workshop car garage";
  if (ind.includes("jardin") || ind.includes("paisaj") || ind.includes("planta") || ind.includes("agricul"))
    return "garden landscape nature green";
  if (ind.includes("pet") || ind.includes("mascota") || ind.includes("veterinar"))
    return "pet veterinary animals care";
  if (ind.includes("logistic") || ind.includes("transport") || ind.includes("envio") || ind.includes("mensajer"))
    return "logistics transport shipping delivery";
  if (siteType === "store") return "retail shop products modern storefront";
  if (siteType === "blog") return "workspace writing minimal desk";
  return "professional business modern office";
}

/** Industry-specific layout hints */
function getIndustryHint(industry: string): string {
  const ind = industry.toLowerCase();
  if (ind.includes("restaurante") || ind.includes("comida") || ind.includes("gastro") || ind.includes("cafe") || ind.includes("bar"))
    return "LAYOUT: Galería de fotos prominente, menú en grid con precios reales, horarios de atención visibles, botón de reserva/pedido.";
  if (ind.includes("salud") || ind.includes("clinica") || ind.includes("medic") || ind.includes("dental") || ind.includes("psico"))
    return "LAYOUT: Formulario de cita destacado, colores calmados (azul/verde), iconos médicos de lucide-react, sección de especialidades.";
  if (ind.includes("tienda") || ind.includes("ecommerce") || ind.includes("venta") || ind.includes("shop"))
    return "LAYOUT: Grid de productos destacados, botones 'Comprar' prominentes, sección de ofertas o novedades.";
  if (ind.includes("portfolio") || ind.includes("fotograf") || ind.includes("diseno") || ind.includes("arte"))
    return "LAYOUT: Galería de trabajos a pantalla completa, hover effects en proyectos, navegación minimalista.";
  if (ind.includes("educacion") || ind.includes("academia") || ind.includes("escuela") || ind.includes("curso"))
    return "LAYOUT: Secciones de cursos/programas, testimonials de alumnos, CTA de inscripcion prominente.";
  return "";
}

/** Prompt 1 of 2: globals.css + layout.jsx */
function buildStructurePrompt(project: any, design: any, pages: any[]): string {
  const industryHint = getIndustryHint(project.industry || "");
  return `Genera EXACTAMENTE 2 archivos para un sitio Next.js 14.

${buildBusinessBlock(project, design, pages)}
${industryHint ? `\n${industryHint}` : ""}

GENERA ESTOS 2 ARCHIVOS (ambos OBLIGATORIOS y COMPLETOS):

===FILE:app/globals.css===
[CSS COMPLETO con:
- Variables :root: --color-primary (${design?.primary_color || "#1a1a2e"}), --color-secondary (${design?.secondary_color || "#16213e"}), --color-accent (${design?.accent_color || "#0f3460"}), --color-text (#1a1a1a), --color-bg (#ffffff), --color-muted (#f5f5f5)
- @import Google Fonts: "${design?.font_heading || "Inter"}" (titulos) y "${design?.font_body || "Inter"}" (cuerpo). Usa EXACTAMENTE estas fuentes, no elijas otras.
- @keyframes fadeInUp (translateY 30px a 0, opacity 0 a 1, duration 0.6s), fadeIn, pulse
- Clases .animate-fade-up { animation: fadeInUp 0.6s ease forwards }, .animate-fade-in
- .hero { min-height:100vh; position:relative; display:flex; align-items:center; background-size:cover; background-position:center; }
- .hero-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.55); }
- Nav sticky: backdrop-filter:blur(10px), fondo semitransparente, z-index alto
- .section { padding: 5rem 1rem; max-width:1200px; margin:0 auto; } .section-full { padding: 5rem 1rem; } .section-alt { background: var(--color-muted); }
- .section-header { text-align:center; margin-bottom:3rem; } .section-header h2 { font-size:2.2rem; font-weight:700; margin-bottom:0.75rem; } .section-header p { font-size:1.1rem; color:#666; max-width:600px; margin:0 auto; }
- .card { background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); transition:transform 0.3s,box-shadow 0.3s; } .card:hover { transform:translateY(-6px); box-shadow:0 8px 28px rgba(0,0,0,0.14); }
- .card-img { width:100%; height:220px; object-fit:cover; display:block; }
- .card-body { padding:1.5rem; } .card-body h3 { font-size:1.2rem; font-weight:600; margin-bottom:0.5rem; } .card-body p { color:#555; line-height:1.7; font-size:0.95rem; } .card-price { font-size:1.3rem; font-weight:700; color:var(--color-primary); margin-top:0.75rem; }
- .grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:2rem; } .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:2rem; }
- .split-section { display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; } .split-section.reverse { direction:rtl; } .split-section.reverse > * { direction:ltr; }
- .split-text h2 { font-size:2rem; font-weight:700; margin-bottom:1rem; } .split-text p { color:#555; line-height:1.8; margin-bottom:1rem; font-size:1rem; } .split-text ul { list-style:none; padding:0; } .split-text ul li { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0; color:#444; }
- .split-image { width:100%; height:450px; object-fit:cover; border-radius:16px; display:block; }
- .gallery-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; } .gallery-item { aspect-ratio:4/3; overflow:hidden; border-radius:10px; } .gallery-item img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s; } .gallery-item:hover img { transform:scale(1.06); }
- .stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2rem; text-align:center; padding:3rem 0; } .stat-number { font-size:3rem; font-weight:800; color:var(--color-primary); line-height:1; } .stat-label { font-size:0.9rem; color:#666; margin-top:0.5rem; }
- .testimonial-card { background:#fff; border-radius:12px; padding:2rem; box-shadow:0 2px 12px rgba(0,0,0,0.07); } .testimonial-text { font-style:italic; color:#444; line-height:1.8; margin-bottom:1rem; font-size:1rem; } .testimonial-author { font-weight:600; color:#222; } .testimonial-role { font-size:0.85rem; color:#888; }
- .cta-section { background:linear-gradient(135deg,var(--color-primary),var(--color-accent)); color:#fff; text-align:center; padding:6rem 1rem; } .cta-section h2 { font-size:2.5rem; font-weight:800; margin-bottom:1rem; } .cta-section p { font-size:1.15rem; opacity:0.9; max-width:550px; margin:0 auto 2rem; }
- Botones: .btn-primary { background:linear-gradient(135deg,var(--color-primary),var(--color-accent)); color:#fff; padding:0.85rem 2rem; border-radius:8px; font-weight:600; border:none; cursor:pointer; transition:transform 0.2s,opacity 0.2s; } .btn-primary:hover { transform:scale(1.03); opacity:0.92; } .btn-outline { border:2px solid var(--color-primary); color:var(--color-primary); padding:0.8rem 2rem; border-radius:8px; font-weight:600; background:transparent; cursor:pointer; transition:all 0.2s; } .btn-outline:hover { background:var(--color-primary); color:#fff; }
- Footer oscuro: background:#111; color:#ccc; padding:3rem 1rem; .footer-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2rem; max-width:1200px; margin:0 auto; } .footer-bottom { text-align:center; border-top:1px solid #333; padding-top:1.5rem; margin-top:2rem; font-size:0.85rem; }
- @media (max-width:768px): .grid-2,.grid-3,.split-section,.gallery-grid,.stat-grid,.footer-grid { grid-template-columns:1fr; } .split-section.reverse { direction:ltr; } .split-image { height:280px; } hero texto mas pequeno]
===END===

===FILE:app/layout.jsx===
[Layout principal. Importa globals.css.
- Carga Google Fonts via <link rel="preconnect"> y <link rel="stylesheet"> en el <head>: "${design?.font_heading || "Inter"}" y "${design?.font_body || "Inter"}"
- Nav sticky con backdrop-filter y links a todas las paginas del menu
- LOGO EN NAV: ${project?.logo_url ? `Usa <a href="/"><img src="${project.logo_url}" alt="${project?.name || "Logo"}" style={{height:"40px",width:"auto",objectFit:"contain"}} /></a> como elemento de marca. NO muestres el nombre del negocio como texto en el nav — solo el logo como link a home.` : `Muestra el nombre del negocio como texto en el nav con link a home (<a href="/">).`}
- Footer con nombre del negocio, derechos reservados y redes sociales
- REDES SOCIALES: importa { socialLinks } desde './social-links.js'. Renderiza cada uno como <a href={link.url} target="_blank"> con icono lucide-react segun link.platform: instagram->Instagram, facebook->Facebook, tiktok->Music2, whatsapp->MessageCircle, youtube->Youtube, twitter->Twitter, linkedin->Linkedin, telegram->Send, pinterest->Globe.
- HAMBURGER MENU: El boton de menu movil (clase nav-menu-toggle) debe tener id="navToggle". La lista ul debe tener id="navLinks". Al final del <body>, antes de cerrar </body>, agrega este script que maneja el toggle en mobile:
  <script dangerouslySetInnerHTML={{__html: "document.getElementById('navToggle')&&document.getElementById('navToggle').addEventListener('click',function(){document.getElementById('navLinks').classList.toggle('active');});"}} />
- NO usar "use client". El metadata export va al inicio.]
===END===

REGLAS:
- .jsx sin TypeScript
- Contenido en espanol
- Completos, no truncues`;
}

/** Prompt 2 of 2: page.jsx (homepage) — receives CSS class names as context */
function buildPagePrompt(
  project: any,
  design: any,
  pages: any[],
  photos: string[],
  cssClasses: string
): string {
  const photoList =
    photos.length > 0
      ? `\nFOTOS DISPONIBLES (usa en <img src="...">):\n${photos.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}`
      : "";

  return `Genera EXACTAMENTE 1 archivo para un sitio Next.js 14.

${buildBusinessBlock(project, design, pages)}
${photoList}

CLASES CSS DISPONIBLES (definidas en globals.css, usaias):
${cssClasses}

GENERA ESTE ARCHIVO:

===FILE:app/page.jsx===
[Pagina de inicio COMPLETA con estas secciones OBLIGATORIAS:

1. HERO (pantalla completa):
   - Fondo: primera foto disponible como <img> dentro de .hero, con .hero-overlay encima
   - Titulo grande del negocio con clase .animate-fade-up
   - Subtitulo descriptivo (1 linea) y boton CTA con gradiente
   - Posicion del texto: absoluta, centrada sobre el overlay

2. SERVICIOS/PRODUCTOS (grid 3 columnas en desktop):
   - Cards con hover effect, icono lucide-react por servicio, nombre y descripcion breve
   - Precios REALES coherentes con "${project.location || "America Latina"}"
   - Contenido 100% especifico para ${project.name}

3. POR QUE ELEGIRNOS:
   - 4 ventajas con icono CheckCircle de lucide-react
   - 3 estadisticas de impacto (ej: "500+ clientes", "10 anos de experiencia", "99% satisfaccion")

4. TESTIMONIALS:
   - 3 testimonios con nombre, rol/empresa y calificacion (5 iconos Star de lucide-react)
   - Nombres y empresas coherentes con "${project.location || "America Latina"}"

5. CTA FINAL:
   - Seccion con gradiente usando var(--color-primary) y var(--color-accent)
   - Titulo motivador y boton grande de contacto/accion

Todo el texto en espanol, especifico para ${project.name}.]
===END===

REGLAS:
- .jsx sin TypeScript
- Usa las clases CSS del globals.css
- Contenido REAL en espanol, coherente con el negocio
- Completo, no truncues`;
}

/** Prompt 3 of 3: inner pages (about, services, contact, etc.) */
function buildInnerPagesPrompt(
  project: any,
  design: any,
  pages: any[],
  photos: string[],
  cssClasses: string,
  projectId: number | string
): string | null {
  const innerPages = pages.filter((p) => p.slug !== "home");
  if (innerPages.length === 0) return null;

  const photoList =
    photos.length > 0
      ? `\nFOTOS DISPONIBLES (usa en <img src="...">):\n${photos.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}`
      : "";

  const pageList = innerPages.map((p) => {
    const sections = Array.isArray(p.content_json)
      ? p.content_json
      : JSON.parse(p.content_json || "[]");
    return `- "${p.title}" → archivo: app/${p.slug}/page.jsx, secciones: ${sections.join(", ")}`;
  }).join("\n");

  return `Genera ${innerPages.length} paginas interiores para un sitio Next.js 14.

${buildBusinessBlock(project, design, pages)}
${photoList}

CLASES CSS DISPONIBLES (ya definidas en globals.css, usaias sin redefinir):
${cssClasses}

PAGINAS A GENERAR (una por archivo):
${pageList}

Para cada pagina genera un archivo ===FILE:app/[slug]/page.jsx=== con:
- Estructura coherente con la pagina (ej: "about" → historia, equipo, valores; "contact" → formulario + info de contacto; "services" → cards de servicios con precios reales)
- Usa las clases CSS disponibles (.section, .container, .card, .btn-primary, etc.)
- Hero de pagina: banner con imagen de fondo, overlay y titulo de la pagina
- Contenido REAL y especifico para ${project.name}
- Formulario de contacto en la pagina de contacto (con campos nombre, email, mensaje). El formulario debe hacer un fetch POST a 'https://nl360.site/api/manu-dev/form-submit' con body JSON: {project_id: ${projectId}, name, email, message}. Al enviar: deshabilita el boton, muestra indicador de carga, y muestra mensaje de exito/error inline (NO redirigir)
- Precios coherentes con "${project.location || "America Latina"}" donde aplique

REGLAS:
- .jsx sin TypeScript
- Sin imports de next/image
- Contenido en espanol
- Cada archivo completo, no truncues`;
}

/** Extract CSS class names from generated CSS for use as page.jsx context */
function extractCSSClasses(css: string): string {
  const classes: string[] = [];
  const regex = /\.([\w-]+)\s*\{/g;
  let m;
  while ((m = regex.exec(css)) !== null) {
    if (!classes.includes(m[1])) classes.push(m[1]);
  }
  return classes.slice(0, 120).join(", ");
}

function parseImportedLucideIcons(content: string): Set<string> {
  const imported = new Set<string>();
  // Accept icons from lucide-react directly OR from our icons.jsx boilerplate
  const importRegex = /import\s*\{\s*([^}]*)\}\s*from\s*["'](?:lucide-react|\.\.?\/icons)["'];?/gm;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(" as ")[0].trim());
    for (const name of names) imported.add(name);
  }
  return imported;
}

// Detect PascalCase JSX tags that are likely lucide icons (not HTML, React, or locally-defined components)
function findUsedLucideIcons(content: string): Set<string> {
  const used = new Set<string>();
  // Collect locally-defined component names (const Foo =, function Foo(, export default function Foo)
  const localComponents = new Set<string>();
  const localRegex = /(?:const|let|var|function)\s+([A-Z][A-Za-z0-9]*)\s*[=(]/g;
  let lm;
  while ((lm = localRegex.exec(content)) !== null) localComponents.add(lm[1]);

  const tagRegex = /<([A-Z][A-Za-z0-9]*)\b/g;
  let m;
  while ((m = tagRegex.exec(content)) !== null) {
    const name = m[1];
    // Skip React builtins, known framework components, and locally-defined components
    if (KNOWN_REACT_EXPORTS.has(name)) continue;
    if (KNOWN_NON_ICON_COMPONENTS.has(name)) continue;
    if (localComponents.has(name)) continue;
    used.add(name);
  }
  return used;
}

function findMissingLucideImports(content: string): string[] {
  const imported = parseImportedLucideIcons(content);
  const used = findUsedLucideIcons(content);
  return [...used].filter((name) => !imported.has(name));
}

function applyLucideImportFix(content: string, missing: string[]): string {
  if (missing.length === 0) return content;

  const existingImport = content.match(/import\s*\{\s*([^}]*)\}\s*from\s*["']lucide-react["'];?/m);
  if (existingImport) {
    const currentNames = existingImport[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(" as ")[0].trim());
    const merged = [...new Set([...currentNames, ...missing])].sort((a, b) => a.localeCompare(b));
    const replacement = `import { ${merged.join(", ")} } from "lucide-react";`;
    return content.replace(existingImport[0], replacement);
  }

  const newImport = `import { ${[...new Set(missing)].sort((a, b) => a.localeCompare(b)).join(", ")} } from "lucide-react";\n`;
  if (/^["']use client["'];\s*$/m.test(content)) {
    return content.replace(/^["']use client["'];\s*\n/m, (m0) => `${m0}${newImport}`);
  }
  return `${newImport}${content}`;
}

// Remove non-React exports accidentally placed in the "react" import statement.
// Any PascalCase name that is NOT a known React export gets moved to lucide-react.
// E.g.: import { Star, Filter, useState } from "react"  →  import { useState } from "react"
function removeLucideIconsFromReactImport(content: string): { content: string; removed: string[] } {
  const reactImportRegex = /import\s*\{\s*([^}]*)\}\s*from\s*["']react["'];?/m;
  const m = reactImportRegex.exec(content);
  if (!m) return { content, removed: [] };

  const allNames = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  // Anything PascalCase (starts with uppercase) that is NOT a real React export → likely an icon
  const nonReactNames = allNames.filter((n) => {
    const base = n.split(" as ")[0].trim();
    return /^[A-Z]/.test(base) && !KNOWN_REACT_EXPORTS.has(base);
  });
  if (nonReactNames.length === 0) return { content, removed: [] };

  const cleanNames = allNames.filter((n) => {
    const base = n.split(" as ")[0].trim();
    return !/^[A-Z]/.test(base) || KNOWN_REACT_EXPORTS.has(base);
  });
  let replacement: string;
  if (cleanNames.length === 0) {
    replacement = "";
  } else {
    replacement = `import { ${cleanNames.join(", ")} } from "react";`;
  }
  return {
    content: content.replace(m[0], replacement),
    removed: nonReactNames.map((n) => n.split(" as ")[0].trim()),
  };
}

// Remove identifiers that appear in multiple import statements (keep the more specific module)
function deduplicateAllImports(content: string): { content: string; deduped: string[] } {
  const importRegex = /import\s*\{\s*([^}]*)\}\s*from\s*["']([^"']+)["'];?/gm;
  const seen = new Map<string, string>(); // name → module
  const duplicates: { name: string; removeFromModule: string }[] = [];
  let im;
  while ((im = importRegex.exec(content)) !== null) {
    const names = im[1].split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.split(" as ")[0].trim());
    const mod = im[2];
    for (const name of names) {
      if (seen.has(name)) {
        // Keep the import from the more specific module (not "react")
        const prevMod = seen.get(name)!;
        const removeFrom = prevMod === "react" ? "react" : mod === "react" ? "react" : mod;
        duplicates.push({ name, removeFromModule: removeFrom });
      } else {
        seen.set(name, mod);
      }
    }
  }
  if (duplicates.length === 0) return { content, deduped: [] };

  let result = content;
  for (const { name, removeFromModule } of duplicates) {
    const modImportRegex = new RegExp(
      `import\\s*\\{\\s*([^}]*)\\}\\s*from\\s*["']${removeFromModule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'];?`,
      "m"
    );
    const modMatch = modImportRegex.exec(result);
    if (!modMatch) continue;
    const currentNames = modMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    const filtered = currentNames.filter((s) => s.split(" as ")[0].trim() !== name);
    if (filtered.length === 0) {
      result = result.replace(modMatch[0], "");
    } else {
      result = result.replace(modMatch[0], `import { ${filtered.join(", ")} } from "${removeFromModule}";`);
    }
  }
  return { content: result, deduped: duplicates.map((d) => d.name) };
}

function runPreflightAutoFix(files: { path: string; content: string }[]) {
  const fixes: { path: string; icons: string[] }[] = [];
  const patched = files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;

    // Step 1: strip non-React PascalCase names from the react import → move to lucide-react
    const { content: dedupedContent, removed } = removeLucideIconsFromReactImport(file.content);
    let workingContent = dedupedContent;

    // Step 2: deduplicate any identifiers imported from multiple modules
    const { content: dedupContent2, deduped } = deduplicateAllImports(workingContent);
    workingContent = dedupContent2;

    // Step 3: ensure all PascalCase JSX tags used in the file are in lucide-react import
    const missing = findMissingLucideImports(workingContent);
    const allMissing = [...new Set([...missing, ...removed])];
    if (allMissing.length === 0 && removed.length === 0 && deduped.length === 0) return file;

    const fixedContent = applyLucideImportFix(workingContent, allMissing);
    const allFixed = [...new Set([...removed, ...deduped, ...allMissing])];
    if (allFixed.length > 0) {
      fixes.push({ path: file.path, icons: allFixed });
    }
    return { ...file, content: fixedContent };
  });

  return { patched, fixes };
}

// Phase 2: Parse webpack build errors and auto-fix them for retry
function parseBuildErrors(buildLog: string): { file: string; name: string; type: "duplicate" | "not-exported" }[] {
  const errors: { file: string; name: string; type: "duplicate" | "not-exported" }[] = [];

  // Match: the name `X` is defined multiple times
  const dupRegex = /\.\/(\S+\.jsx)\s*\n.*?\n.*?the name `(\w+)` is defined multiple times/g;
  let dm;
  while ((dm = dupRegex.exec(buildLog)) !== null) {
    errors.push({ file: dm[1], name: dm[2], type: "duplicate" });
  }

  // Also try a simpler pattern
  const simpleDupRegex = /the name `(\w+)` is defined multiple times/g;
  const fileRefRegex = /\.\/(\S+\.jsx)/g;
  let sdm;
  while ((sdm = simpleDupRegex.exec(buildLog)) !== null) {
    const name = sdm[1];
    if (errors.some((e) => e.name === name)) continue;
    // Find nearest file reference before this match
    fileRefRegex.lastIndex = 0;
    let lastFile = "";
    let fm;
    while ((fm = fileRefRegex.exec(buildLog)) !== null && fm.index < sdm.index) {
      lastFile = fm[1];
    }
    if (lastFile) errors.push({ file: lastFile, name, type: "duplicate" });
  }

  // Match: X is not exported from 'react'
  const notExportedRegex = /`(\w+)` is not exported from ['"]react['"]/g;
  let nem;
  while ((nem = notExportedRegex.exec(buildLog)) !== null) {
    errors.push({ file: "", name: nem[1], type: "not-exported" });
  }

  return errors;
}

async function autoFixBuildErrors(
  subdomain: string,
  buildLog: string
): Promise<{ fixed: boolean; fixedCount: number }> {
  const errors = parseBuildErrors(buildLog);
  if (errors.length === 0) return { fixed: false, fixedCount: 0 };

  const siteDir = path.join(SITES_DIR, subdomain);
  let fixedCount = 0;

  // Collect all affected files
  const affectedFiles = new Set<string>();
  for (const err of errors) {
    if (err.file) affectedFiles.add(err.file);
  }

  // If no specific file found, scan all jsx files
  if (affectedFiles.size === 0) {
    try {
      const entries = await fs.readdir(path.join(siteDir, "app"), { recursive: true });
      for (const entry of entries) {
        const name = typeof entry === "string" ? entry : String(entry);
        if (name.endsWith(".jsx") || name.endsWith(".tsx")) {
          affectedFiles.add(`app/${name}`);
        }
      }
    } catch {}
  }

  for (const filePath of affectedFiles) {
    const fullPath = path.join(siteDir, filePath);
    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }

    // Apply the same preflight fixes
    const { content: fixed1, removed } = removeLucideIconsFromReactImport(content);
    const { content: fixed2, deduped } = deduplicateAllImports(fixed1);
    const missing = findMissingLucideImports(fixed2);
    const allMissing = [...new Set([...missing, ...removed])];
    const final = applyLucideImportFix(fixed2, allMissing);

    if (final !== content) {
      await fs.writeFile(fullPath, final, "utf8");
      fixedCount += removed.length + deduped.length + allMissing.length;
    }
  }

  return { fixed: fixedCount > 0, fixedCount };
}

function parseGeneratedFiles(
  raw: string
): { path: string; content: string }[] {
  // Strip markdown code fences that models sometimes add despite instructions
  let text = raw.replace(/^```[a-zA-Z]*\n?/gm, "").replace(/^```\n?/gm, "");

  // Find all FILE header positions (store index of start of header, not end)
  const headerRegex = /===FILE:\s*([^\n\r=][^\n\r]*?)\s*===(?:\r?\n)?/g;
  const headers: { path: string; headerStart: number; contentStart: number }[] = [];
  let hm;
  while ((hm = headerRegex.exec(text)) !== null) {
    headers.push({
      path: hm[1].trim(),
      headerStart: hm.index,
      contentStart: hm.index + hm[0].length,
    });
  }

  if (headers.length === 0) {
    const preview = raw.slice(0, 300).replace(/\n/g, "\\n");
    throw new Error(`No files found in response. Preview: ${preview}`);
  }

  const files: { path: string; content: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].contentStart;
    // Content ends at the start of the next ===FILE: header, or end of string
    const end = i + 1 < headers.length ? headers[i + 1].headerStart : text.length;
    let content = text.slice(start, end).replace(/\r\n/g, "\n");
    // Strip trailing ===END=== (with optional surrounding whitespace)
    content = content.replace(/\s*===END===\s*$/, "").trimEnd();
    if (headers[i].path) {
      files.push({ path: headers[i].path, content });
    }
  }

  return files;
}

async function writeFiles(
  subdomain: string,
  files: { path: string; content: string }[]
) {
  const siteDir = path.join(SITES_DIR, subdomain);
  await fs.mkdir(siteDir, { recursive: true });

  for (const file of files) {
    // Security: prevent path traversal
    const safePath = path.normalize(file.path).replace(/^(\.\.[/\\])+/, "");
    const fullPath = path.join(siteDir, safePath);

    // Ensure inside siteDir
    if (!fullPath.startsWith(siteDir)) continue;

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, "utf8");
  }
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await getUser(token);
  if (!user?.id)
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  /* ── Daily build cap enforcement ─────────────────────────────────── */
  const dailyCap = user.roles.reduce<number | null>((cap, role) => {
    const rc = DAILY_BUILD_CAP[role];
    return rc !== undefined ? (cap === null ? rc : Math.min(cap, rc)) : cap;
  }, null);

  if (dailyCap !== null) {
    const pool0 = getPool();
    const [rows] = await pool0.query<import("mysql2/promise").RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM md_projects
       WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [user.id],
    );
    const todayCount = (rows[0]?.cnt as number) ?? 0;
    if (todayCount >= dailyCap) {
      return NextResponse.json(
        { error: `Límite diario alcanzado (${dailyCap} sitios por día)` },
        { status: 429 },
      );
    }
  }

  // F2: Verificar límite de sitios por plan
  const maxSitesCheck = await checkMaxSites(user.id, user.roles);
  if (!maxSitesCheck.allowed) {
    return Response.json(
      { ok: false, error: maxSitesCheck.reason },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { project_id } = body;
  if (!project_id)
    return NextResponse.json({ error: "project_id requerido" }, { status: 400 });

  const pool = getPool();
  const encoder = new TextEncoder();

  function send(controller: ReadableStreamDefaultController, data: object) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
    );
  }

  function sendKeepAlive(controller: ReadableStreamDefaultController) {
    try {
      controller.enqueue(encoder.encode(":keepalive\n\n"));
    } catch { /* controller already closed */ }
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Send SSE keepalive every 15s to prevent proxy idle-timeout (Traefik default 180s)
      const keepAliveTimer = setInterval(() => sendKeepAlive(controller), 15_000);
      try {
        // Load project
        send(controller, { status: "loading", message: "Cargando proyecto..." });

        const [prows] = (await pool.execute(
          "SELECT * FROM md_projects WHERE id = ? AND user_id = ?",
          [project_id, user.id]
        )) as any;

        const project = prows[0];
        if (!project) {
          send(controller, { status: "error", message: "Proyecto no encontrado" });
          controller.close();
          return;
        }

        const [drows] = (await pool.execute(
          "SELECT * FROM md_design WHERE project_id = ?",
          [project_id]
        )) as any;
        const design = drows[0] || null;

        const [pgrows] = (await pool.execute(
          "SELECT * FROM md_pages WHERE project_id = ? ORDER BY id ASC",
          [project_id]
        )) as any;
        const pages = pgrows as any[];

        // If no pages defined (new chat flow), generate defaults based on site_type
        if (pages.length === 0) {
          const siteType = project.site_type || "informational";
          const defaults: Record<string, { title: string; slug: string; sections: string[] }[]> = {
            store: [
              { title: "Inicio", slug: "home", sections: ["hero", "products", "testimonials", "cta"] },
              { title: "Productos", slug: "productos", sections: ["product-grid", "categories"] },
              { title: "Nosotros", slug: "nosotros", sections: ["about", "team", "values"] },
              { title: "Contacto", slug: "contacto", sections: ["contact-form", "map", "info"] },
            ],
            blog: [
              { title: "Inicio", slug: "home", sections: ["hero", "featured-posts", "categories", "cta"] },
              { title: "Blog", slug: "blog", sections: ["post-grid", "sidebar"] },
              { title: "Nosotros", slug: "nosotros", sections: ["about", "team"] },
              { title: "Contacto", slug: "contacto", sections: ["contact-form", "info"] },
            ],
            informational: [
              { title: "Inicio", slug: "home", sections: ["hero", "services", "about-brief", "testimonials", "cta"] },
              { title: "Servicios", slug: "servicios", sections: ["service-detail", "pricing", "faq"] },
              { title: "Nosotros", slug: "nosotros", sections: ["about", "team", "values"] },
              { title: "Contacto", slug: "contacto", sections: ["contact-form", "map", "info"] },
            ],
          };
          for (const dp of (defaults[siteType] || defaults.informational)) {
            pages.push({ title: dp.title, slug: dp.slug, content_json: JSON.stringify(dp.sections) });
          }
        }

        const requestedMode = normalizeGenerationMode(body?.generation_mode ?? project.generation_mode ?? "auto");
        const requestedTemplate = typeof body?.template === "string" ? body.template : undefined;
        const resolvedMode = resolveEffectiveMode(requestedMode, pages.length);

        // Enforce plan-based restrictions: downgrade if user's plan doesn't allow the resolved mode
        const generationMode = validateModeForRoles(resolvedMode as SiteGenerationMode, user.roles);
        const manualLiteValidation = validateLiteManualScope(pages);

        const modeWasDowngraded = generationMode !== resolvedMode;

        send(controller, {
          status: "mode",
          mode: generationMode,
          requested_mode: requestedMode,
          effective_mode: generationMode,
          page_count: pages.length,
          downgraded: modeWasDowngraded,
          message: modeWasDowngraded
            ? `Modo ajustado: ${resolvedMode} → ${generationMode} (limite de plan)`
            : `Modo: ${generationMode} | Paginas: ${pages.length}`,
        });

        const subdomain = project.subdomain;

        await prepareBuildInfra();

        // Fetch Unsplash photos — translate industry to English for better results
        send(controller, { status: "images", message: "Buscando imagenes..." });
        const photoQuery = buildUnsplashQuery(project.industry || "", project.site_type || "");
        const photos = await fetchUnsplashPhotos(photoQuery, 8);

        async function buildAndDeploy(activeMode: "next" | "lite", retryAttempt = 0) {
          if (retryAttempt === 0) {
            await markBuildQueued(Number(project_id), "queued-after-generation");
          }

          const queuedBuild = queueBuild({
            subdomain,
            projectId: Number(project_id),
            mode: activeMode,
            onStart: () => {
              send(controller, {
                status: "building",
                mode: activeMode,
                message: activeMode === "lite"
                  ? "Desplegando modo Lite..."
                  : retryAttempt > 0
                    ? `Reconstruyendo (intento ${retryAttempt + 1})...`
                    : "Construyendo imagen Docker...",
              });
            },
          });

          if (queuedBuild.queuePosition > 1) {
            send(controller, {
              status: "queued",
              message: `En cola, posicion ${queuedBuild.queuePosition}...`,
            });
          }

          let containerId = "";
          try {
            const buildResult = await queuedBuild.run;
            containerId = buildResult.containerId;
          } catch (buildErr: any) {
            const buildLogPath = path.join(SITES_DIR, subdomain, "build.log");
            let buildLog = "";
            try {
              buildLog = await fs.readFile(buildLogPath, "utf8");
            } catch {}
            const buildTail = buildLog.trim().split("\n").slice(-12).join("\n");

            const stderrTail = typeof buildErr?.stderr === "string"
              ? buildErr.stderr.trim().split("\n").slice(-8).join("\n")
              : "";

            // Auto-fix retry: if this is a Next.js build and we haven't retried yet, try to fix and rebuild
            if (activeMode === "next" && retryAttempt < 1 && buildLog) {
              const { fixed, fixedCount } = await autoFixBuildErrors(subdomain, buildLog);
              if (fixed) {
                send(controller, {
                  status: "preflight",
                  message: `Auto-fix: corregidos ${fixedCount} imports tras error de build. Reintentando...`,
                });
                return buildAndDeploy(activeMode, retryAttempt + 1);
              }
            }

            const diagnostic = (stderrTail || buildTail || buildErr?.message || "Error desconocido").slice(0, 1200);
            await markBuildFailed(Number(project_id), "build-failed", diagnostic);
            send(controller, {
              status: "error",
              message: `Error en build. ${diagnostic.slice(0, 500)}`,
            });
            execAsync(`sh /opt/docker-apps/scripts/manu-dev-cleanup.sh ${subdomain}`).catch(() => {});
            return false;
          }

          // Persist pages to md_pages so CMS Panel can display and edit them
          try {
            await pool.execute("DELETE FROM md_pages WHERE project_id = ?", [project_id]);
            for (const page of pages) {
              const content_json = typeof page.content_json === "string"
                ? page.content_json
                : JSON.stringify(page.content_json || []);
              await pool.execute(
                "INSERT INTO md_pages (project_id, slug, title, content_json) VALUES (?, ?, ?, ?)",
                [project_id, page.slug, page.title, content_json]
              );
            }
          } catch (pgErr) {
            console.error("[create-site] Failed to persist pages:", pgErr);
          }

          await markBuildSuccess(
            Number(project_id),
            containerId,
            `https://${subdomain}.nl360.site`
          );

          send(controller, {
            status: "done",
            message: "Sitio listo!",
            url: `https://${subdomain}.nl360.site`,
            subdomain,
            mode: activeMode,
          });
          return true;
        }

        async function generateLiteAndDeploy(params?: { reason?: string; fallback?: boolean }) {
          const fallback = params?.fallback === true;
          const reason = params?.reason;
          const liteValidation = fallback ? validateLiteFallbackScope(pages) : manualLiteValidation;

          if (!liteValidation.ok) {
            send(controller, {
              status: "error",
              message: fallback
                ? `${liteValidation.reason} No se pudo aplicar fallback automatico.`
                : `${liteValidation.reason} Usa generation_mode=next para sitios mas grandes.`,
            });
            return false;
          }

          if (reason) {
            send(controller, {
              status: "fallback",
              mode: "lite",
              message: `Activando fallback a modo Lite: ${reason}`,
            });
          }

          send(controller, {
            status: "generating",
            mode: "lite",
            message: fallback
              ? "Generando fallback Lite..."
              : "Generando Landingpage PRO...",
          });

          const liteFiles = buildLiteSiteFiles({
            project,
            design,
            pages,
            photos,
            maxPages: fallback ? 5 : 3,
            singlePageAnchors: !fallback,
            template: requestedTemplate,
          });
          send(controller, { status: "writing", mode: "lite", message: `Escribiendo ${liteFiles.length} archivos...` });
          await writeFiles(subdomain, liteFiles);

          return buildAndDeploy("lite");
        }

        async function generateLitePlusAndDeploy(params?: { fallback?: boolean; reason?: string }) {
          const reason = params?.reason;

          if (reason) {
            send(controller, {
              status: "mode_degraded",
              mode: "lite_plus",
              message: `⚠️  Modo PRO no disponible (${reason}). Construyendo con Lite+ automáticamente.`,
              originalMode: "next",
            });
          }

          let lastError = "error desconocido";

          for (let attempt = 1; attempt <= 2; attempt++) {
            send(controller, {
              status: "generating",
              mode: "lite_plus",
              message: attempt === 1
                ? "Generando sitio con IA (Lite+)..."
                : "Reintentando generacion (intento 2/2)...",
            });

            try {
              const result = await generateLitePlusSite(
                { project, design, pages, photos, projectId: Number(project_id) },
                (msg) => send(controller, { status: "generating", mode: "lite_plus", message: msg }),
              );

              if (!result.success) {
                lastError = result.error || "generateLitePlusSite no retorno exito";
                if (attempt < 2) continue;
                // Both attempts failed — report error
                sendBuildErrorReport(lastError, project_id);
                send(controller, {
                  status: "error",
                  message: `<h3>Ups, algo salió mal.</h3><p>Intentamos generar el sitio dos veces pero sucedió un error que nuestro sistema no pudo resolver. Te pedimos disculpas. Acabamos de enviar un reporte de urgencia al equipo técnico. Si esto consumió algún límite de tu plan, no te preocupes, lo restauraremos.</p><code>${lastError.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`,
                });
                return false;
              }

              if (result.fallbackUsed) {
                send(controller, {
                  status: "generating",
                  mode: "lite_plus",
                  message: `${result.pagesGenerated} paginas generadas (algunas con fallback).`,
                });
              }

              send(controller, {
                status: "writing",
                mode: "lite_plus",
                message: `Escribiendo ${result.files.length} archivos...`,
              });
              await writeFiles(subdomain, result.files);
              return buildAndDeploy("lite");

            } catch (err: any) {
              lastError = String(err?.message || "error desconocido");
              if (attempt < 2) {
                send(controller, {
                  status: "generating",
                  mode: "lite_plus",
                  message: `Error en primer intento (${lastError}), reintentando...`,
                });
                await delay(3000);
                continue;
              }
              // Both attempts threw — report error
              sendBuildErrorReport(lastError, project_id);
              send(controller, {
                status: "error",
                message: `<h3>Ups, algo salió mal.</h3><p>Intentamos generar el sitio dos veces pero sucedió un error que nuestro sistema no pudo resolver. Te pedimos disculpas. Acabamos de enviar un reporte de urgencia al equipo técnico. Si esto consumió algún límite de tu plan, no te preocupes, lo restauraremos.</p><code>${lastError.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`,
              });
              return false;
            }
          }

          return false;
        }

        if (generationMode === "lite") {
          const deployed = await generateLiteAndDeploy();
          if (!deployed) {
            controller.close();
            return;
          }
          controller.close();
          return;
        }

        if (generationMode === "lite_plus") {
          const deployed = await generateLitePlusAndDeploy();
          if (!deployed) {
            controller.close();
            return;
          }
          controller.close();
          return;
        }

        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          timeout: 120_000,
          maxRetries: 0,
        });

        /** Stream a generation prompt and return the accumulated raw text */
        async function streamGenerate(prompt: string, label: string, system?: string): Promise<string> {
          const generationTask = (async () => {
            let raw = "";
            let charCount = 0;
            const genStream = client.messages.stream({
              model: CREATE_SITE_MODEL,
              max_tokens: 32768,
              ...(generationMode === "next" ? {
                thinking: { type: "adaptive" },
                output_config: { effort: "high" },
              } : {}),
              ...(system ? { system } : {}),
              messages: [{ role: "user", content: prompt }],
            });
            for await (const event of genStream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                raw += event.delta.text;
                charCount += event.delta.text.length;
                if (charCount % 500 < event.delta.text.length) {
                  send(controller, {
                    status: "generating",
                    message: `${label} (${Math.round(charCount / 1000)}kb)`,
                  });
                }
              }
            }
            return raw;
          })();

          try {
            return await withTimeout(generationTask, GENERATION_TIMEOUT_MS, `Generacion IA (${label})`);
          } catch (err: any) {
            // Preserve original error for transient classification upstream
            const wrapped = new Error(String(err?.message || "error desconocido"));
            (wrapped as any).original = err;
            throw wrapped;
          }
        }

        /** Parse, sanitize and validate a raw generation output */
        function processRaw(raw: string, silent = false): { path: string; content: string }[] | null {
          let parsed: { path: string; content: string }[];
          try {
            parsed = parseGeneratedFiles(raw);
          } catch (e: any) {
            console.error("[create-site] Parse error (first 500):", raw.slice(0, 500));
            if (!silent) send(controller, { status: "error", message: `Error al parsear: ${e?.message}` });
            return null;
          }
          // Sanitize
          parsed = parsed.map((f) =>
            f.path.endsWith(".jsx") || f.path.endsWith(".tsx")
              ? { ...f, content: sanitizeJSX(f.content) }
              : f
          );
          // Validate completeness
          const truncated = parsed
            .filter((f) => (f.path.endsWith(".jsx") || f.path.endsWith(".tsx")) && !isJSXComplete(f.content))
            .map((f) => f.path);
          if (truncated.length > 0) {
            if (!silent) send(controller, { status: "error", message: `Archivos truncados: ${truncated.join(", ")}. Intenta de nuevo.` });
            return null;
          }
          return parsed;
        }

        const MAX_ATTEMPTS = 3;

        let files: { path: string; content: string }[] = [];
        try {
          // ── Call 1: globals.css + layout.jsx (with retry) ────────────────────
          let structureFiles: { path: string; content: string }[] | null = null;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              send(controller, {
                status: "generating",
                message: attempt === 1
                  ? "Generando estructura..."
                  : `Estructura intento ${attempt}/${MAX_ATTEMPTS}...`,
              });
              const raw1 = await streamGenerate(buildStructurePrompt(project, design, pages), "Generando estilos y layout", SITE_SYSTEM_PROMPT);
              send(controller, { status: "parsing", message: "Procesando estructura..." });
              structureFiles = processRaw(raw1, attempt < MAX_ATTEMPTS);
              if (structureFiles) break;
            } catch (genErr: any) {
              console.error(`[create-site] Estructura intento ${attempt}/${MAX_ATTEMPTS} fallo:`, genErr?.message);
              if (!isTransientError(genErr) || attempt === MAX_ATTEMPTS) throw genErr;
              send(controller, { status: "generating", message: `Error de red, reintentando (${attempt + 1}/${MAX_ATTEMPTS})...` });
              await delay(1000 * Math.pow(2, attempt - 1));
            }
          }
          if (!structureFiles) throw new Error("No se pudo generar la estructura base.");

          // Extract CSS class names to give page.jsx some context
          const cssFile = structureFiles.find((f) => f.path === "app/globals.css");
          const cssClasses = cssFile ? extractCSSClasses(cssFile.content) : "";

          // ── Call 2: page.jsx (with retry) ────────────────────────────────────
          let pageFiles: { path: string; content: string }[] | null = null;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              send(controller, {
                status: "generating",
                message: attempt === 1
                  ? "Generando pagina principal..."
                  : `Pagina principal intento ${attempt}/${MAX_ATTEMPTS}...`,
              });
              const raw2 = await streamGenerate(buildPagePrompt(project, design, pages, photos, cssClasses), "Generando pagina principal", SITE_SYSTEM_PROMPT);
              send(controller, { status: "parsing", message: "Procesando pagina..." });
              pageFiles = processRaw(raw2, attempt < MAX_ATTEMPTS);
              if (pageFiles) break;
            } catch (genErr: any) {
              console.error(`[create-site] Pagina principal intento ${attempt}/${MAX_ATTEMPTS} fallo:`, genErr?.message);
              if (!isTransientError(genErr) || attempt === MAX_ATTEMPTS) throw genErr;
              send(controller, { status: "generating", message: `Error de red, reintentando (${attempt + 1}/${MAX_ATTEMPTS})...` });
              await delay(1000 * Math.pow(2, attempt - 1));
            }
          }
          if (!pageFiles) throw new Error("No se pudo generar la pagina principal.");

          // ── Call 3: inner pages (about, contact, etc.) — optional, best-effort ──
          let innerPageFiles: { path: string; content: string }[] = [];
          const innerPrompt = buildInnerPagesPrompt(project, design, pages, photos, cssClasses, project_id);
          if (innerPrompt) {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
              try {
                send(controller, {
                  status: "generating",
                  message: attempt === 1
                    ? "Generando paginas internas..."
                    : `Paginas internas intento ${attempt}/${MAX_ATTEMPTS}...`,
                });
                const raw3 = await streamGenerate(innerPrompt, "Generando paginas internas", SITE_SYSTEM_PROMPT);
                send(controller, { status: "parsing", message: "Procesando internas..." });
                const inner = processRaw(raw3, true); // silent — failure is non-fatal
                if (inner) { innerPageFiles = inner; break; }
              } catch (genErr: any) {
                console.error(`[create-site] Internas intento ${attempt}/${MAX_ATTEMPTS} fallo:`, genErr?.message);
                if (!isTransientError(genErr) || attempt === MAX_ATTEMPTS) break; // non-fatal, just skip
                send(controller, { status: "generating", message: `Error de red en internas, reintentando (${attempt + 1}/${MAX_ATTEMPTS})...` });
                await delay(1000 * Math.pow(2, attempt - 1));
              }
            }
          }

          files = [...structureFiles, ...pageFiles, ...innerPageFiles];
        } catch (aiErr: any) {
          const aiMessage = formatProviderError(aiErr, "IA");
          // Next mode AI failure → fall back to lite_plus (which handles its own retries)
          const fallbackDeployed = await generateLitePlusAndDeploy({ reason: aiMessage, fallback: true });
          if (!fallbackDeployed) {
            controller.close();
            return;
          }
          controller.close();
          return;
        }

        // Phase 1 preflight: auto-fix frequent compile errors before Docker build
        send(controller, { status: "preflight", message: "Ejecutando preflight..." });
        const preflight = runPreflightAutoFix(files);
        files = preflight.patched;
        if (preflight.fixes.length > 0) {
          const totalFixed = preflight.fixes.reduce((acc, f) => acc + f.icons.length, 0);
          send(controller, {
            status: "preflight",
            message: `Preflight: corregidos ${totalFixed} imports de iconos en ${preflight.fixes.length} archivo(s).`,
          });
        }

        // If after auto-fix there are still unresolved lucide imports, fail early with actionable error.
        const unresolved: string[] = [];
        for (const file of files) {
          if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;
          const missing = findMissingLucideImports(file.content);
          if (missing.length > 0) {
            unresolved.push(`${file.path}: ${missing.join(", ")}`);
          }
        }
        if (unresolved.length > 0) {
          send(controller, {
            status: "error",
            message: `Preflight fallido: imports de iconos sin resolver. ${unresolved.slice(0, 4).join(" | ")}`,
          });
          controller.close();
          return;
        }

        // Validate required files are present
        const filePaths = files.map((f) => f.path);
        const missingRequired = ["app/layout.jsx", "app/page.jsx"].filter(
          (req) => !filePaths.includes(req)
        );
        if (missingRequired.length > 0) {
          send(controller, {
            status: "error",
            message: `Generación incompleta: faltan los archivos ${missingRequired.join(", ")}. Intenta de nuevo.`,
          });
          controller.close();
          return;
        }

        // Write boilerplate first, then Claude-generated files (generated files win if overlap)
        // Build dynamic social-links.js from project data
        let socialLinksContent = "export const socialLinks = [];\n";
        try {
          const links = typeof project.social_links === "string" ? JSON.parse(project.social_links || "[]") : (project.social_links || []);
          if (Array.isArray(links) && links.length > 0) {
            socialLinksContent = `export const socialLinks = ${JSON.stringify(links, null, 2)};\n`;
          }
        } catch {}
        const dynamicBoilerplate = { ...BOILERPLATE, "app/social-links.js": socialLinksContent };

        send(controller, { status: "writing", message: `Escribiendo ${files.length} archivos...` });
        const boilerplateFiles = Object.entries(dynamicBoilerplate).map(([p, content]) => ({ path: p, content }));
        await writeFiles(subdomain, [...boilerplateFiles, ...files]);

        const deployed = await buildAndDeploy("next");
        if (!deployed) {
          // Fallback to lite+ mode if Next.js build failed
          const fallbackDeployed = await generateLitePlusAndDeploy({
            reason: "Build Next.js fallido tras auto-fix. Generando version Lite+.",
            fallback: true,
          });
          if (!fallbackDeployed) {
            controller.close();
            return;
          }
          controller.close();
          return;
        }
        controller.close();
      } catch (err: any) {
        send(controller, {
          status: "error",
          message: err?.message || "Error interno",
        });
        controller.close();
      } finally {
        clearInterval(keepAliveTimer);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
