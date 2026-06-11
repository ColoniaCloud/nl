"use client";

import { useState } from "react";

// ─── Template SVG Thumbnails ─────────────────────────────────────────────────

interface TemplateInfo {
  id: string;
  name: string;
  desc: string;
}

const TEMPLATES: TemplateInfo[] = [
  { id: "boutique", name: "Boutique", desc: "Elegante para moda y accesorios" },
  { id: "fresh", name: "Fresh", desc: "Organico para alimentos y artesanias" },
  { id: "spark", name: "Spark", desc: "Moderno para tech y digital" },
  { id: "classic", name: "Classic", desc: "Minimalista y limpio, para cualquier rubro" },
  { id: "neon", name: "Neon", desc: "Vibrante y oscuro con acentos neon" },
  { id: "terra", name: "Terra", desc: "Calido y natural, tonos tierra" },
];

const TEMPLATE_COLORS: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
  boutique: { primary: "#6366f1", secondary: "#4f46e5", accent: "#f59e0b", bg: "#faf5ff" },
  fresh: { primary: "#16a34a", secondary: "#15803d", accent: "#f97316", bg: "#f0fdf4" },
  spark: { primary: "#0ea5e9", secondary: "#0284c7", accent: "#f43f5e", bg: "#f0f9ff" },
  classic: { primary: "#374151", secondary: "#1f2937", accent: "#6366f1", bg: "#f9fafb" },
  neon: { primary: "#8b5cf6", secondary: "#7c3aed", accent: "#22d3ee", bg: "#0f0f23" },
  terra: { primary: "#b45309", secondary: "#92400e", accent: "#059669", bg: "#fffbeb" },
};

function TemplateSvg({ template, size = 160 }: { template: string; size?: number }) {
  const c = TEMPLATE_COLORS[template] || TEMPLATE_COLORS.boutique;
  const w = size;
  const h = Math.round(size * 0.75);

  if (template === "boutique") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        {/* Top nav */}
        <rect x="0" y="0" width={w} height="18" rx="8" fill={c.primary} />
        <rect x="8" y="5" width="30" height="8" rx="2" fill="white" opacity="0.9" />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        {/* Hero section */}
        <rect x="12" y="26" width={w * 0.45} height="8" rx="2" fill={c.primary} />
        <rect x="12" y="38" width={w * 0.35} height="5" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="12" y="46" width={w * 0.3} height="5" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="12" y="56" width="40" height="12" rx="4" fill={c.accent} />
        <text x="32" y="65" fontSize="6" fill="white" textAnchor="middle" fontFamily="sans-serif">Comprar</text>
        {/* Hero image placeholder */}
        <rect x={w * 0.55} y="24" width={w * 0.38} height="46" rx="6" fill={c.secondary} opacity="0.15" />
        <circle cx={w * 0.74} cy="47" r="10" fill={c.primary} opacity="0.2" />
        {/* Product grid */}
        <rect x="12" y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="14" y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.1" />
        <rect x="14" y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
        <rect x="14" y="104" width={w * 0.10} height="3" rx="1" fill={c.accent} opacity="0.7" />

        <rect x={w * 0.36} y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x={w * 0.36 + 2} y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.1" />
        <rect x={w * 0.36 + 2} y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
        <rect x={w * 0.36 + 2} y="104" width={w * 0.10} height="3" rx="1" fill={c.accent} opacity="0.7" />

        <rect x={w * 0.68} y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x={w * 0.68 + 2} y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.1" />
        <rect x={w * 0.68 + 2} y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
        <rect x={w * 0.68 + 2} y="104" width={w * 0.10} height="3" rx="1" fill={c.accent} opacity="0.7" />
      </svg>
    );
  }

  if (template === "fresh") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        {/* Top nav */}
        <rect x="0" y="0" width={w} height="18" rx="8" fill="white" />
        <rect x="8" y="5" width="30" height="8" rx="2" fill={c.primary} />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        {/* Full-width hero with organic shape */}
        <rect x="8" y="22" width={w - 16} height="44" rx="8" fill={c.primary} opacity="0.12" />
        <circle cx={w * 0.8} cy="44" r="18" fill={c.primary} opacity="0.08" />
        <rect x="20" y="32" width={w * 0.4} height="7" rx="2" fill={c.primary} />
        <rect x="20" y="42" width={w * 0.3} height="4" rx="1" fill="#64748b" opacity="0.5" />
        <rect x="20" y="49" width="36" height="10" rx="5" fill={c.accent} />
        <text x="38" y="57" fontSize="5" fill="white" textAnchor="middle" fontFamily="sans-serif">Explorar</text>
        {/* Category cards */}
        <rect x="8" y="74" width={w * 0.3} height="36" rx="6" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.15 + 8} cy="86" r="6" fill={c.primary} opacity="0.15" />
        <rect x="14" y="96" width={w * 0.18} height="3" rx="1" fill="#374151" opacity="0.6" />
        <rect x="14" y="102" width={w * 0.12} height="3" rx="1" fill={c.primary} opacity="0.5" />

        <rect x={w * 0.35} y="74" width={w * 0.3} height="36" rx="6" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.5} cy="86" r="6" fill={c.accent} opacity="0.15" />
        <rect x={w * 0.35 + 6} y="96" width={w * 0.18} height="3" rx="1" fill="#374151" opacity="0.6" />
        <rect x={w * 0.35 + 6} y="102" width={w * 0.12} height="3" rx="1" fill={c.primary} opacity="0.5" />

        <rect x={w * 0.68} y="74" width={w * 0.29} height="36" rx="6" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.82} cy="86" r="6" fill={c.secondary} opacity="0.15" />
        <rect x={w * 0.68 + 6} y="96" width={w * 0.17} height="3" rx="1" fill="#374151" opacity="0.6" />
        <rect x={w * 0.68 + 6} y="102" width={w * 0.11} height="3" rx="1" fill={c.primary} opacity="0.5" />
      </svg>
    );
  }

  // spark
  if (template === "spark") {
    return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={w} height={h} rx="8" fill="#0f172a" />
      {/* Top nav */}
      <rect x="0" y="0" width={w} height="18" rx="8" fill="#1e293b" />
      <rect x="8" y="5" width="30" height="8" rx="2" fill={c.primary} />
      <rect x={w - 60} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
      <rect x={w - 44} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
      <rect x={w - 28} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
      {/* Hero with gradient feel */}
      <rect x="0" y="18" width={w} height="50" fill={c.primary} opacity="0.08" />
      <rect x={w * 0.25} y="28" width={w * 0.5} height="8" rx="2" fill="white" opacity="0.9" />
      <rect x={w * 0.3} y="40" width={w * 0.4} height="4" rx="1" fill="#94a3b8" opacity="0.4" />
      <rect x={w * 0.38} y="50" width={w * 0.24} height="10" rx="5" fill={c.primary} />
      <text x={w * 0.5} y="58" fontSize="5" fill="white" textAnchor="middle" fontFamily="sans-serif">Ver todo</text>
      {/* Product cards dark */}
      <rect x="8" y="76" width={w * 0.3} height="34" rx="4" fill="#1e293b" />
      <rect x="10" y="78" width={w * 0.26} height="16" rx="2" fill={c.primary} opacity="0.12" />
      <rect x="10" y="97" width={w * 0.18} height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="10" y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />

      <rect x={w * 0.35 + 2} y="76" width={w * 0.28} height="34" rx="4" fill="#1e293b" />
      <rect x={w * 0.35 + 4} y="78" width={w * 0.24} height="16" rx="2" fill={c.accent} opacity="0.12" />
      <rect x={w * 0.35 + 4} y="97" width={w * 0.16} height="3" rx="1" fill="white" opacity="0.6" />
      <rect x={w * 0.35 + 4} y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />

      <rect x={w * 0.68} y="76" width={w * 0.28} height="34" rx="4" fill="#1e293b" />
      <rect x={w * 0.68 + 2} y="78" width={w * 0.24} height="16" rx="2" fill={c.primary} opacity="0.12" />
      <rect x={w * 0.68 + 2} y="97" width={w * 0.16} height="3" rx="1" fill="white" opacity="0.6" />
      <rect x={w * 0.68 + 2} y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />
    </svg>
    );
  }

  if (template === "classic") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill="#ffffff" />
        <rect x="0" y="0" width={w} height="16" rx="8" fill="white" />
        <line x1="0" y1="16" x2={w} y2="16" stroke="#e5e7eb" strokeWidth="0.5" />
        <rect x={w * 0.35} y="4" width={w * 0.3} height="7" rx="2" fill="#111827" />
        <rect x={w * 0.25} y="28" width={w * 0.5} height="10" rx="2" fill="#111827" opacity="0.9" />
        <rect x={w * 0.33} y="42" width={w * 0.34} height="1" fill={c.accent} />
        <rect x={w * 0.3} y="48" width={w * 0.4} height="4" rx="1" fill="#9ca3af" opacity="0.4" />
        <rect x={w * 0.36} y="56" width={w * 0.28} height="9" rx="0" fill="transparent" stroke={c.accent} strokeWidth="1" />
        <text x={w * 0.5} y="63" fontSize="5" fill={c.accent} textAnchor="middle" fontFamily="sans-serif">Ver todo</text>
        <line x1="8" y1="74" x2={w - 8} y2="74" stroke="#e5e7eb" strokeWidth="0.5" />
        <rect x="8" y="80" width={w * 0.28} height="28" rx="0" fill="#f3f4f6" />
        <rect x={w * 0.36} y="80" width={w * 0.28} height="28" rx="0" fill="#f3f4f6" />
        <rect x={w * 0.68} y="80" width={w * 0.28} height="28" rx="0" fill="#f3f4f6" />
      </svg>
    );
  }

  if (template === "neon") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill="#0f0f23" />
        <rect x="0" y="0" width={w} height="16" rx="8" fill="#1a1a2e" />
        <rect x="8" y="4" width="28" height="7" rx="2" fill={c.accent} />
        <rect x="0" y="16" width={w} height="50" fill={c.primary} opacity="0.06" />
        <rect x="12" y="28" width={w * 0.45} height="8" rx="2" fill={c.accent} opacity="0.9" />
        <rect x="12" y="40" width={w * 0.35} height="4" rx="1" fill="#6b7280" opacity="0.5" />
        <rect x="12" y="50" width="40" height="10" rx="5" fill={c.accent} />
        <rect x="8" y="76" width={w * 0.3} height="30" rx="8" fill="#1a1a2e" stroke={c.accent} strokeWidth="0.5" opacity="0.8" />
        <rect x={w * 0.36} y="76" width={w * 0.28} height="30" rx="8" fill="#1a1a2e" stroke={c.primary} strokeWidth="0.5" opacity="0.8" />
        <rect x={w * 0.68} y="76" width={w * 0.28} height="30" rx="8" fill="#1a1a2e" stroke={c.accent} strokeWidth="0.5" opacity="0.8" />
      </svg>
    );
  }

  // terra (default fallback)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={w} height={h} rx="8" fill={c.bg} />
      <rect x="0" y="0" width={w} height="16" rx="8" fill="#fef3c7" />
      <rect x="8" y="4" width="30" height="7" rx="2" fill={c.primary} />
      <rect x="0" y="16" width={w * 0.5} height="54" fill={c.bg} />
      <rect x={w * 0.5} y="16" width={w * 0.5} height="54" fill={c.primary} opacity="0.1" />
      <rect x="12" y="28" width={w * 0.35} height="8" rx="2" fill={c.primary} />
      <rect x="12" y="40" width={w * 0.25} height="4" rx="1" fill="#92400e" opacity="0.4" />
      <rect x="12" y="50" width="36" height="10" rx="5" fill={c.primary} />
      <circle cx={w * 0.75} cy="43" r="14" fill={c.primary} opacity="0.08" />
      <line x1="0" y1="72" x2={w} y2="72" stroke="#fde68a" strokeWidth="0.5" />
      <rect x="8" y="80" width={w * 0.28} height="28" rx="8" fill="white" stroke="#fde68a" strokeWidth="0.5" />
      <rect x={w * 0.36} y="80" width={w * 0.28} height="28" rx="8" fill="white" stroke="#fde68a" strokeWidth="0.5" />
      <rect x={w * 0.68} y="80" width={w * 0.28} height="28" rx="8" fill="white" stroke="#fde68a" strokeWidth="0.5" />
    </svg>
  );
}

export function TemplatePicker({
  onSelect,
}: {
  onSelect: (template: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t.id);
              onSelect(t.id);
            }}
            className={`group relative rounded-xl border-2 p-1.5 transition-all duration-200 ${
              selected === t.id
                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "border-border hover:border-emerald-500/50 bg-muted/30"
            }`}
          >
            <div className="rounded-lg overflow-hidden">
              <TemplateSvg template={t.id} size={140} />
            </div>
            <div className="mt-1.5 text-center">
              <p className={`text-xs font-semibold ${selected === t.id ? "text-emerald-400" : "text-foreground"}`}>
                {t.name}
              </p>
              <p className="text-2xs text-muted-foreground leading-tight mt-0.5">
                {t.desc}
              </p>
            </div>
            {selected === t.id && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Color Palette Preview ───────────────────────────────────────────────────

interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

function PaletteSvg({ palette, template, size = 140 }: { palette: ColorPalette; template: string; size?: number }) {
  const w = size;
  const h = Math.round(size * 0.65);
  const isDark = template === "spark" || template === "neon";
  const bgColor = isDark ? "#0f172a" : "#ffffff";
  const textColor = isDark ? "white" : "#1e293b";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={w} height={h} rx="6" fill={bgColor} stroke="#e2e8f0" strokeWidth="0.5" />
      {/* Nav bar */}
      <rect x="0" y="0" width={w} height="14" rx="6" fill={palette.primary} />
      <rect x="6" y="4" width="22" height="6" rx="1.5" fill="white" opacity="0.9" />
      {/* Title area */}
      <rect x="8" y="20" width={w * 0.6} height="6" rx="1.5" fill={textColor} opacity="0.8" />
      <rect x="8" y="29" width={w * 0.4} height="4" rx="1" fill={textColor} opacity="0.3" />
      {/* CTA button */}
      <rect x="8" y="37" width="30" height="8" rx="4" fill={palette.accent} />
      {/* Product card */}
      <rect x="8" y="50" width={w * 0.4} height="32" rx="4" fill={palette.primary} opacity="0.08" />
      <rect x="10" y="52" width={w * 0.36} height="14" rx="2" fill={palette.secondary} opacity="0.15" />
      <rect x="10" y="70" width={w * 0.20} height="3" rx="1" fill={textColor} opacity="0.5" />
      <rect x="10" y="76" width={w * 0.12} height="3" rx="1" fill={palette.accent} />
      {/* Second card */}
      <rect x={w * 0.52} y="50" width={w * 0.42} height="32" rx="4" fill={palette.primary} opacity="0.08" />
      <rect x={w * 0.52 + 2} y="52" width={w * 0.38} height="14" rx="2" fill={palette.primary} opacity="0.15" />
      <rect x={w * 0.52 + 2} y="70" width={w * 0.22} height="3" rx="1" fill={textColor} opacity="0.5" />
      <rect x={w * 0.52 + 2} y="76" width={w * 0.14} height="3" rx="1" fill={palette.accent} />
      {/* Color swatches at bottom */}
      <circle cx={w * 0.35} cy={h - 6} r="4" fill={palette.primary} />
      <circle cx={w * 0.5} cy={h - 6} r="4" fill={palette.secondary} />
      <circle cx={w * 0.65} cy={h - 6} r="4" fill={palette.accent} />
    </svg>
  );
}

export function ColorPalettePreview({
  palettes,
  template,
  onSelect,
}: {
  palettes: ColorPalette[];
  template: string;
  onSelect: (palette: ColorPalette) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {palettes.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setSelected(p.name);
              onSelect(p);
            }}
            className={`group rounded-xl border-2 p-1.5 transition-all duration-200 ${
              selected === p.name
                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "border-border hover:border-emerald-500/50 bg-muted/30"
            }`}
          >
            <div className="rounded-lg overflow-hidden">
              <PaletteSvg palette={p} template={template} size={140} />
            </div>
            <div className="mt-1.5 text-center">
              <p className={`text-xxs font-semibold ${selected === p.name ? "text-emerald-400" : "text-foreground"}`}>
                {p.name}
              </p>
              <div className="flex justify-center gap-1 mt-1">
                <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.primary }} />
                <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.secondary }} />
                <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.accent }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Font Preview ────────────────────────────────────────────────────────────

interface FontOption {
  heading: string;
  body: string;
  label: string;
}

export function NubiaFontPreview({
  options,
  onSelect,
}: {
  options: FontOption[];
  onSelect: (option: FontOption) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load all fonts
  if (typeof window !== "undefined" && !loaded) {
    const allFonts = new Set<string>();
    options.forEach((o) => { allFonts.add(o.heading); allFonts.add(o.body); });
    allFonts.forEach((f) => {
      const id = `gf-${f.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    });
    setLoaded(true);
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => {
              setSelected(opt.label);
              onSelect(opt);
            }}
            className={`rounded-xl border-2 p-3 transition-all duration-200 text-left ${
              selected === opt.label
                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "border-border hover:border-emerald-500/50 bg-muted/30"
            }`}
          >
            <p
              className="text-sm font-bold text-foreground leading-tight"
              style={{ fontFamily: `"${opt.heading}", serif` }}
            >
              Tu Tienda
            </p>
            <p
              className="text-xxs text-muted-foreground mt-1 leading-snug"
              style={{ fontFamily: `"${opt.body}", sans-serif` }}
            >
              Los mejores productos al mejor precio
            </p>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{opt.label}</p>
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">{opt.heading} + {opt.body}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
