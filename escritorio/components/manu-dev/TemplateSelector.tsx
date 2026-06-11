"use client";

import { useState } from "react";

// ─── Template metadata ──────────────────────────────────────────────────────

export type LiteTemplateId = "professional" | "bold" | "elegant" | "fresh" | "minimal";

interface TemplateMeta {
  id: LiteTemplateId;
  name: string;
  desc: string;
}

const TEMPLATES: TemplateMeta[] = [
  { id: "professional", name: "Professional", desc: "Corporativo, limpio y moderno" },
  { id: "bold", name: "Bold", desc: "Fondo oscuro, gradientes fuertes" },
  { id: "elegant", name: "Elegant", desc: "Serif refinado, tonos calidos" },
  { id: "fresh", name: "Fresh", desc: "Organico, fresco, verde y suave" },
  { id: "minimal", name: "Minimal", desc: "Ultra limpio, blanco puro" },
];

const TEMPLATE_COLORS: Record<LiteTemplateId, { primary: string; secondary: string; accent: string; bg: string; navBg: string; text: string }> = {
  professional: { primary: "#1a1a2e", secondary: "#16213e", accent: "#0f3460", bg: "#f8fafc", navBg: "#1a1a2e", text: "#1e293b" },
  bold:         { primary: "#6d28d9", secondary: "#7c3aed", accent: "#f59e0b", bg: "#0f0f14", navBg: "#18181b", text: "#ffffff" },
  elegant:      { primary: "#78350f", secondary: "#92400e", accent: "#b45309", bg: "#fffbeb", navBg: "#78350f", text: "#451a03" },
  fresh:        { primary: "#059669", secondary: "#10b981", accent: "#f97316", bg: "#ecfdf5", navBg: "#ffffff", text: "#064e3b" },
  minimal:      { primary: "#18181b", secondary: "#3f3f46", accent: "#18181b", bg: "#ffffff", navBg: "#ffffff", text: "#18181b" },
};

// ─── SVG Thumbnails ─────────────────────────────────────────────────────────

function TemplateSvg({ template, size = 160 }: { template: LiteTemplateId; size?: number }) {
  const c = TEMPLATE_COLORS[template];
  const w = size;
  const h = Math.round(size * 0.75);

  if (template === "professional") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        <rect x="0" y="0" width={w} height="18" rx="8" fill={c.navBg} />
        <rect x="8" y="5" width="30" height="8" rx="2" fill="white" opacity="0.9" />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        {/* Hero */}
        <rect x="12" y="26" width={w * 0.45} height="8" rx="2" fill={c.primary} />
        <rect x="12" y="38" width={w * 0.35} height="5" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="12" y="46" width={w * 0.3} height="5" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="12" y="56" width="40" height="12" rx="4" fill={c.accent} />
        <rect x={w * 0.55} y="24" width={w * 0.38} height="46" rx="6" fill={c.secondary} opacity="0.12" />
        <circle cx={w * 0.74} cy="47" r="10" fill={c.primary} opacity="0.15" />
        {/* Cards */}
        <rect x="12" y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="14" y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.08" />
        <rect x="14" y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
        <rect x={w * 0.36} y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x={w * 0.36 + 2} y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.08" />
        <rect x={w * 0.36 + 2} y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
        <rect x={w * 0.68} y="78" width={w * 0.28} height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x={w * 0.68 + 2} y="80" width={w * 0.24} height="16" rx="2" fill={c.secondary} opacity="0.08" />
        <rect x={w * 0.68 + 2} y="99" width={w * 0.16} height="3" rx="1" fill="#64748b" opacity="0.5" />
      </svg>
    );
  }

  if (template === "bold") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        <rect x="0" y="0" width={w} height="18" rx="8" fill={c.navBg} />
        <rect x="8" y="5" width="30" height="8" rx="2" fill={c.primary} />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.5" />
        {/* Hero gradient */}
        <rect x="0" y="18" width={w} height="50" fill={c.primary} opacity="0.15" />
        <rect x={w * 0.2} y="28" width={w * 0.6} height="8" rx="2" fill="white" opacity="0.9" />
        <rect x={w * 0.28} y="40" width={w * 0.44} height="4" rx="1" fill="#a78bfa" opacity="0.4" />
        <rect x={w * 0.35} y="50" width={w * 0.3} height="10" rx="5" fill={c.accent} />
        {/* Dark cards */}
        <rect x="8" y="76" width={w * 0.3} height="34" rx="4" fill={c.navBg} />
        <rect x="10" y="78" width={w * 0.26} height="16" rx="2" fill={c.primary} opacity="0.2" />
        <rect x="10" y="97" width={w * 0.18} height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="10" y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />
        <rect x={w * 0.35 + 2} y="76" width={w * 0.28} height="34" rx="4" fill={c.navBg} />
        <rect x={w * 0.35 + 4} y="78" width={w * 0.24} height="16" rx="2" fill={c.accent} opacity="0.15" />
        <rect x={w * 0.35 + 4} y="97" width={w * 0.16} height="3" rx="1" fill="white" opacity="0.6" />
        <rect x={w * 0.35 + 4} y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />
        <rect x={w * 0.68} y="76" width={w * 0.28} height="34" rx="4" fill={c.navBg} />
        <rect x={w * 0.68 + 2} y="78" width={w * 0.24} height="16" rx="2" fill={c.primary} opacity="0.2" />
        <rect x={w * 0.68 + 2} y="97" width={w * 0.16} height="3" rx="1" fill="white" opacity="0.6" />
        <rect x={w * 0.68 + 2} y="103" width={w * 0.10} height="3" rx="1" fill={c.accent} />
      </svg>
    );
  }

  if (template === "elegant") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        <rect x="0" y="0" width={w} height="18" rx="8" fill={c.navBg} />
        <rect x="8" y="5" width="30" height="8" rx="2" fill="white" opacity="0.9" />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill="white" opacity="0.5" />
        {/* Elegant hero with centered text */}
        <rect x="8" y="22" width={w - 16} height="44" rx="8" fill={c.primary} opacity="0.06" />
        <rect x={w * 0.2} y="30" width={w * 0.6} height="7" rx="2" fill={c.primary} />
        <rect x={w * 0.25} y="40" width={w * 0.5} height="4" rx="1" fill={c.text} opacity="0.3" />
        <rect x={w * 0.35} y="49" width={w * 0.3} height="10" rx="12" fill={c.accent} />
        {/* Elegant cards with thick borders */}
        <rect x="8" y="74" width={w * 0.3} height="36" rx="8" fill="white" stroke={c.primary} strokeWidth="1" opacity="0.8" />
        <rect x="14" y="78" width={w * 0.18} height="4" rx="1" fill={c.primary} opacity="0.7" />
        <rect x="14" y="85" width={w * 0.22} height="3" rx="1" fill={c.text} opacity="0.3" />
        <rect x="14" y="91" width={w * 0.22} height="3" rx="1" fill={c.text} opacity="0.2" />
        <rect x="14" y="99" width={w * 0.10} height="4" rx="2" fill={c.accent} opacity="0.7" />
        <rect x={w * 0.35} y="74" width={w * 0.3} height="36" rx="8" fill="white" stroke={c.primary} strokeWidth="1" opacity="0.8" />
        <rect x={w * 0.35 + 6} y="78" width={w * 0.18} height="4" rx="1" fill={c.primary} opacity="0.7" />
        <rect x={w * 0.35 + 6} y="85" width={w * 0.22} height="3" rx="1" fill={c.text} opacity="0.3" />
        <rect x={w * 0.35 + 6} y="91" width={w * 0.22} height="3" rx="1" fill={c.text} opacity="0.2" />
        <rect x={w * 0.35 + 6} y="99" width={w * 0.10} height="4" rx="2" fill={c.accent} opacity="0.7" />
        <rect x={w * 0.68} y="74" width={w * 0.29} height="36" rx="8" fill="white" stroke={c.primary} strokeWidth="1" opacity="0.8" />
        <rect x={w * 0.68 + 6} y="78" width={w * 0.17} height="4" rx="1" fill={c.primary} opacity="0.7" />
        <rect x={w * 0.68 + 6} y="85" width={w * 0.21} height="3" rx="1" fill={c.text} opacity="0.3" />
        <rect x={w * 0.68 + 6} y="91" width={w * 0.21} height="3" rx="1" fill={c.text} opacity="0.2" />
        <rect x={w * 0.68 + 6} y="99" width={w * 0.10} height="4" rx="2" fill={c.accent} opacity="0.7" />
      </svg>
    );
  }

  if (template === "fresh") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={w} height={h} rx="8" fill={c.bg} />
        <rect x="0" y="0" width={w} height="18" rx="8" fill="white" />
        <rect x="8" y="5" width="30" height="8" rx="2" fill={c.primary} />
        <rect x={w - 60} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        <rect x={w - 44} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        <rect x={w - 28} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.4" />
        {/* Organic hero */}
        <rect x="8" y="22" width={w - 16} height="44" rx="12" fill={c.primary} opacity="0.08" />
        <circle cx={w * 0.82} cy="44" r="18" fill={c.primary} opacity="0.06" />
        <rect x="20" y="32" width={w * 0.4} height="7" rx="2" fill={c.primary} />
        <rect x="20" y="42" width={w * 0.3} height="4" rx="1" fill="#64748b" opacity="0.4" />
        <rect x="20" y="50" width="36" height="10" rx="10" fill={c.accent} />
        {/* Pill cards */}
        <rect x="8" y="74" width={w * 0.3} height="36" rx="10" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.15 + 8} cy="86" r="6" fill={c.primary} opacity="0.12" />
        <rect x="14" y="96" width={w * 0.18} height="3" rx="1" fill="#374151" opacity="0.5" />
        <rect x="14" y="102" width={w * 0.12} height="3" rx="1" fill={c.primary} opacity="0.5" />
        <rect x={w * 0.35} y="74" width={w * 0.3} height="36" rx="10" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.5} cy="86" r="6" fill={c.accent} opacity="0.12" />
        <rect x={w * 0.35 + 6} y="96" width={w * 0.18} height="3" rx="1" fill="#374151" opacity="0.5" />
        <rect x={w * 0.35 + 6} y="102" width={w * 0.12} height="3" rx="1" fill={c.primary} opacity="0.5" />
        <rect x={w * 0.68} y="74" width={w * 0.29} height="36" rx="10" fill="white" stroke="#d1fae5" strokeWidth="1" />
        <circle cx={w * 0.82} cy="86" r="6" fill={c.secondary} opacity="0.12" />
        <rect x={w * 0.68 + 6} y="96" width={w * 0.17} height="3" rx="1" fill="#374151" opacity="0.5" />
        <rect x={w * 0.68 + 6} y="102" width={w * 0.11} height="3" rx="1" fill={c.primary} opacity="0.5" />
      </svg>
    );
  }

  // minimal
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={w} height={h} rx="8" fill="#ffffff" />
      <rect x="0" y="0" width={w} height="18" rx="8" fill="#ffffff" />
      <line x1="0" y1="18" x2={w} y2="18" stroke="#e4e4e7" strokeWidth="0.5" />
      <rect x="8" y="5" width="30" height="8" rx="2" fill={c.primary} />
      <rect x={w - 60} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.3" />
      <rect x={w - 44} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.3" />
      <rect x={w - 28} y="6" width="12" height="6" rx="1" fill={c.primary} opacity="0.3" />
      {/* Minimal hero — just text */}
      <rect x="16" y="30" width={w * 0.5} height="8" rx="2" fill={c.primary} />
      <rect x="16" y="42" width={w * 0.4} height="4" rx="1" fill="#a1a1aa" opacity="0.5" />
      <rect x="16" y="49" width={w * 0.35} height="4" rx="1" fill="#a1a1aa" opacity="0.4" />
      <rect x="16" y="58" width="38" height="10" rx="2" fill={c.primary} />
      {/* Minimal cards — no shadows, thin borders */}
      <line x1="12" y1="76" x2={w - 12} y2="76" stroke="#e4e4e7" strokeWidth="0.5" />
      <rect x="12" y="80" width={w * 0.28} height="28" rx="2" fill="#fafafa" />
      <rect x="14" y="83" width={w * 0.18} height="4" rx="1" fill={c.primary} opacity="0.7" />
      <rect x="14" y="90" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.4" />
      <rect x="14" y="96" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.3" />
      <rect x={w * 0.36} y="80" width={w * 0.28} height="28" rx="2" fill="#fafafa" />
      <rect x={w * 0.36 + 2} y="83" width={w * 0.18} height="4" rx="1" fill={c.primary} opacity="0.7" />
      <rect x={w * 0.36 + 2} y="90" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.4" />
      <rect x={w * 0.36 + 2} y="96" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.3" />
      <rect x={w * 0.68} y="80" width={w * 0.28} height="28" rx="2" fill="#fafafa" />
      <rect x={w * 0.68 + 2} y="83" width={w * 0.18} height="4" rx="1" fill={c.primary} opacity="0.7" />
      <rect x={w * 0.68 + 2} y="90" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.4" />
      <rect x={w * 0.68 + 2} y="96" width={w * 0.22} height="3" rx="1" fill="#71717a" opacity="0.3" />
    </svg>
  );
}

// ─── Mode Picker ─────────────────────────────────────────────────────────────

export type ModeOption = {
  id: string;
  label: string;
  desc: string;
};

export function ModePicker({
  modes,
  onSelect,
}: {
  modes: ModeOption[];
  onSelect: (modeId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Elige el motor de generacion:</p>
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelected(m.id);
              onSelect(m.id);
            }}
            className={[
              "rounded-xl border-2 px-4 py-2.5 text-left transition-all duration-200 min-w-[140px]",
              selected === m.id
                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "border-border hover:border-emerald-500/50 bg-muted/30",
            ].join(" ")}
          >
            <p className={`text-xs font-semibold ${selected === m.id ? "text-emerald-400" : "text-foreground"}`}>
              {m.label}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Template Picker ────────────────────────────────────────────────────────

export function TemplateSelector({
  onSelect,
}: {
  onSelect: (templateId: LiteTemplateId) => void;
}) {
  const [selected, setSelected] = useState<LiteTemplateId | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Elige un diseno para tu sitio:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t.id);
              onSelect(t.id);
            }}
            className={[
              "group relative rounded-xl border-2 p-1.5 transition-all duration-200",
              selected === t.id
                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "border-border hover:border-emerald-500/50 bg-muted/30",
            ].join(" ")}
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
