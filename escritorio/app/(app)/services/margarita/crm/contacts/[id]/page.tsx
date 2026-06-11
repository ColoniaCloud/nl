"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, MapPin, Globe, Building2, Tag, X, Plus,
  Sparkles, Save, Loader2, ExternalLink, AlertCircle, ChevronDown,
  ChevronUp, Send, FileText, TrendingUp, Target, MessageSquare,
  CheckCircle2, Clock, XCircle, User, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CrmTag { id: number; name: string; color: string; }
interface AiAnalysis {
  resumen?: string; score?: number; score_razon?: string;
  fortalezas?: string[]; debilidades?: string[]; oportunidades?: string[];
  perfil_comprador?: string; approach_recomendado?: string;
  primer_mensaje?: string; objeciones_esperadas?: string[];
  mejor_canal?: string; urgencia?: string; etiquetas_sugeridas?: string[];
}
interface Contact {
  id: number; nombre: string; empresa: string | null; email: string | null;
  telefono: string | null; pais: string | null; ciudad: string | null;
  direccion: string | null; website: string | null; rubro: string | null;
  score: number | null; status: string; etiquetas: string[] | null;
  notas: string | null; ai_analysis: AiAnalysis | null; source: string | null;
  created_at: string; updated_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <User className="size-3" /> },
  contactado: { label: "Contactado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <MessageSquare className="size-3" /> },
  calificado: { label: "Calificado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="size-3" /> },
  cerrado: { label: "Cerrado", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <Target className="size-3" /> },
  perdido: { label: "Perdido", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="size-3" /> },
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className={cn("flex items-center gap-1 text-sm font-bold", color)}>
      <TrendingUp className="size-3.5" />
      {score}/100
    </div>
  );
}

const TAG_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6b7280",
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});

  // Tags
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState("#10b981");
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Email template
  const [showEmailGen, setShowEmailGen] = useState(false);
  const [emailType, setEmailType] = useState("bienvenida");
  const [emailContext, setEmailContext] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailHtml, setEmailHtml] = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/margarita/crm/contacts/${id}`, { cache: "no-store" });
      if (!res.ok) { setError("Lead no encontrado"); return; }
      const data = await res.json();
      const c = data.contact;
      const tags = (() => { try { return Array.isArray(c.etiquetas) ? c.etiquetas : JSON.parse(c.etiquetas || "[]"); } catch { return []; } })();
      const analysis = (() => { try { return typeof c.ai_analysis === "string" ? JSON.parse(c.ai_analysis) : c.ai_analysis; } catch { return null; } })();
      setContact({ ...c, etiquetas: tags, ai_analysis: analysis });
      setForm({ ...c, etiquetas: tags, ai_analysis: analysis });
    } catch { setError("Error cargando lead"); }
    finally { setLoading(false); }
  }, [id]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/margarita/crm/tags");
      const data = await res.json();
      setTags(data.tags || []);
    } catch {}
  }, []);

  useEffect(() => { fetchContact(); fetchTags(); }, [fetchContact, fetchTags]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.nombre?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/margarita/crm/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, etiquetas: form.etiquetas || [] }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await fetchContact();
      setEditing(false);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async function addTag(name: string, color?: string) {
    if (!name.trim()) return;
    // Upsert in catalog
    await fetch("/api/margarita/crm/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color: color || tagColor }),
    });
    // Add to contact
    const currentTags: string[] = form.etiquetas || [];
    if (!currentTags.includes(name.trim())) {
      const newTags = [...currentTags, name.trim()];
      setForm((f) => ({ ...f, etiquetas: newTags }));
      // Auto-save tags
      await fetch(`/api/margarita/crm/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, etiquetas: newTags }),
      });
      await fetchContact();
      await fetchTags();
    }
    setTagInput("");
    setShowTagPicker(false);
  }

  async function removeTag(tag: string) {
    const newTags = (form.etiquetas || []).filter((t) => t !== tag);
    setForm((f) => ({ ...f, etiquetas: newTags }));
    await fetch(`/api/margarita/crm/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, etiquetas: newTags }),
    });
    await fetchContact();
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisLog([]);
    setShowAnalysis(true);
    try {
      const res = await fetch(`/api/margarita/crm/contacts/${id}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) setAnalysisLog((l) => [...l, data.text]);
            if (data.step === "done" || data.analysis) {
              await fetchContact();
            }
          } catch {}
        }
      }
    } catch (e: any) { setAnalysisLog((l) => [...l, `Error: ${e.message}`]); }
    finally { setAnalyzing(false); }
  }

  // ── Email template ────────────────────────────────────────────────────────

  async function generateEmail() {
    setGeneratingEmail(true);
    setEmailHtml("");
    try {
      const res = await fetch("/api/margarita/crm/email-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: Number(id), template_type: emailType, context: emailContext }),
      });
      const data = await res.json();
      setEmailHtml(data.html || "");
    } catch (e: any) { alert(e.message); }
    finally { setGeneratingEmail(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-dvh bg-background">
      <div className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span key={d} className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );

  if (error || !contact) return (
    <div className="flex flex-col items-center justify-center h-dvh bg-background gap-4">
      <AlertCircle className="size-8 text-red-400" />
      <p className="text-muted-foreground">{error || "Lead no encontrado"}</p>
      <button onClick={() => router.back()} className="text-sm text-emerald-400 hover:underline">Volver</button>
    </div>
  );

  const contactTags = Array.isArray(form.etiquetas) ? form.etiquetas : [];
  const statusCfg = STATUS_CONFIG[contact.status || "nuevo"] || STATUS_CONFIG.nuevo;

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 h-12 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-sm truncate">{contact.nombre}</span>
          {contact.empresa && <span className="text-muted-foreground text-sm truncate">— {contact.empresa}</span>}
        </div>
        <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full border", statusCfg.color)}>
          {statusCfg.icon}
          {statusCfg.label}
        </div>
        {contact.score !== null && <ScoreBadge score={contact.score} />}
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : editing ? <Save className="size-3" /> : <span>Editar</span>}
          {editing && !saving && "Guardar"}
        </button>
        {editing && (
          <button onClick={() => { setEditing(false); setForm({ ...contact }); }} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">

          {/* ── Contact info card ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Información del lead</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <Field label="Nombre" icon={<User className="size-3.5" />} editing={editing}
                value={form.nombre || ""}
                onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Nombre del contacto" required
              />
              {/* Empresa */}
              <Field label="Empresa" icon={<Building2 className="size-3.5" />} editing={editing}
                value={form.empresa || ""}
                onChange={(v) => setForm((f) => ({ ...f, empresa: v }))}
                placeholder="Nombre de la empresa"
              />
              {/* Rubro */}
              <Field label="Rubro / Industria" icon={<Hash className="size-3.5" />} editing={editing}
                value={form.rubro || ""}
                onChange={(v) => setForm((f) => ({ ...f, rubro: v }))}
                placeholder="Ej: Gastronomía, Tecnología..."
              />
              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Target className="size-3.5" /> Estado</label>
                {editing ? (
                  <select
                    value={form.status || "nuevo"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                ) : (
                  <div className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border", statusCfg.color)}>
                    {statusCfg.icon} {statusCfg.label}
                  </div>
                )}
              </div>
              {/* Email */}
              <Field label="Email" icon={<Mail className="size-3.5" />} editing={editing}
                value={form.email || ""}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="email@empresa.com" type="email"
                display={contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-sm text-emerald-400 hover:underline flex items-center gap-1">
                    {contact.email} <ExternalLink className="size-3" />
                  </a>
                ) : undefined}
              />
              {/* Teléfono */}
              <Field label="Teléfono" icon={<Phone className="size-3.5" />} editing={editing}
                value={form.telefono || ""}
                onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
                placeholder="+54 11 ..."
                display={contact.telefono ? (
                  <a href={`tel:${contact.telefono}`} className="text-sm text-emerald-400 hover:underline">{contact.telefono}</a>
                ) : undefined}
              />
              {/* Website */}
              <Field label="Sitio web" icon={<Globe className="size-3.5" />} editing={editing}
                value={form.website || ""}
                onChange={(v) => setForm((f) => ({ ...f, website: v }))}
                placeholder="https://..."
                display={contact.website ? (
                  <a href={contact.website} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:underline flex items-center gap-1 truncate">
                    {contact.website} <ExternalLink className="size-3 flex-shrink-0" />
                  </a>
                ) : undefined}
              />
              {/* Ciudad/País */}
              <Field label="Ciudad / País" icon={<MapPin className="size-3.5" />} editing={editing}
                value={`${form.ciudad || ""}${form.ciudad && form.pais ? ", " : ""}${form.pais || ""}`}
                onChange={(v) => {
                  const parts = v.split(",").map(s => s.trim());
                  setForm((f) => ({ ...f, ciudad: parts[0] || null, pais: parts[1] || f.pais || null }));
                }}
                placeholder="Ciudad, País"
              />
              {/* Dirección */}
              <div className="sm:col-span-2">
                <Field label="Dirección" icon={<MapPin className="size-3.5" />} editing={editing}
                  value={form.direccion || ""}
                  onChange={(v) => setForm((f) => ({ ...f, direccion: v }))}
                  placeholder="Calle, número, piso..."
                />
              </div>
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Tag className="size-3.5" /> Etiquetas
              </h2>
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3" /> Agregar
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {contactTags.length === 0 && <span className="text-xs text-muted-foreground">Sin etiquetas</span>}
              {contactTags.map((tag) => {
                const tagMeta = tags.find((t) => t.name === tag);
                const color = tagMeta?.color || "#10b981";
                return (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border"
                    style={{ backgroundColor: `${color}20`, borderColor: `${color}40`, color }}
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:opacity-70 ml-0.5">
                      <X className="size-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>

            {showTagPicker && (
              <div className="rounded-lg border border-border bg-muted p-3 space-y-3">
                {/* Existing tags from catalog */}
                {tags.filter((t) => !contactTags.includes(t.name)).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Etiquetas existentes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.filter((t) => !contactTags.includes(t.name)).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => addTag(t.name, t.color)}
                          className="text-xs px-2.5 py-1 rounded-full border hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: `${t.color}20`, borderColor: `${t.color}40`, color: t.color }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Create new tag */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Crear nueva etiqueta</p>
                  <div className="flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag(tagInput)}
                      placeholder="Nombre..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-1">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setTagColor(c)}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{ backgroundColor: c, borderColor: tagColor === c ? "white" : "transparent" }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => addTag(tagInput)}
                      disabled={!tagInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-40"
                    >
                      Crear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notas</h2>
            {editing ? (
              <textarea
                value={form.notas || ""}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Notas sobre este lead..."
                rows={4}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notas || "Sin notas."}</p>
            )}
          </div>

          {/* ── AI Analysis ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="size-3.5 text-emerald-400" /> Análisis IA
              </h2>
              <div className="flex items-center gap-2">
                {contact.ai_analysis && (
                  <button onClick={() => setShowAnalysis(!showAnalysis)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {showAnalysis ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {showAnalysis ? "Ocultar" : "Ver análisis"}
                  </button>
                )}
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <span className="flex gap-0.5">
                      {[0, 150, 300].map((d) => <span key={d} className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: `${d}ms` }} />)}
                    </span>
                  ) : <Sparkles className="size-3" />}
                  {contact.ai_analysis ? "Re-analizar" : "Analizar con IA"}
                </button>
              </div>
            </div>

            {analyzing && analysisLog.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 mb-4">
                {analysisLog.map((l, i) => <p key={i} className="flex items-center gap-1.5"><Clock className="size-3 flex-shrink-0" />{l}</p>)}
              </div>
            )}

            {contact.ai_analysis && showAnalysis && (
              <div className="space-y-4">
                {contact.ai_analysis.resumen && (
                  <p className="text-sm text-foreground leading-relaxed">{contact.ai_analysis.resumen}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {contact.ai_analysis.score !== undefined && (
                    <InfoBlock title="Score" value={`${contact.ai_analysis.score}/100`} sub={contact.ai_analysis.score_razon} color="emerald" />
                  )}
                  {contact.ai_analysis.urgencia && (
                    <InfoBlock title="Urgencia" value={contact.ai_analysis.urgencia} color={contact.ai_analysis.urgencia === "alta" ? "red" : contact.ai_analysis.urgencia === "media" ? "amber" : "blue"} />
                  )}
                  {contact.ai_analysis.mejor_canal && (
                    <InfoBlock title="Canal recomendado" value={contact.ai_analysis.mejor_canal} color="purple" />
                  )}
                </div>
                {contact.ai_analysis.approach_recomendado && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">Approach recomendado</p>
                    <p className="text-sm text-foreground">{contact.ai_analysis.approach_recomendado}</p>
                  </div>
                )}
                {contact.ai_analysis.primer_mensaje && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-xs font-semibold text-blue-400 mb-1">Primer mensaje sugerido</p>
                    <p className="text-sm text-foreground italic">"{contact.ai_analysis.primer_mensaje}"</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contact.ai_analysis.fortalezas?.length && (
                    <ListBlock title="Fortalezas" items={contact.ai_analysis.fortalezas} color="emerald" />
                  )}
                  {contact.ai_analysis.oportunidades?.length && (
                    <ListBlock title="Oportunidades de venta" items={contact.ai_analysis.oportunidades} color="blue" />
                  )}
                  {contact.ai_analysis.objeciones_esperadas?.length && (
                    <ListBlock title="Objeciones esperadas" items={contact.ai_analysis.objeciones_esperadas} color="amber" />
                  )}
                  {contact.ai_analysis.etiquetas_sugeridas?.length && (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Etiquetas sugeridas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.ai_analysis.etiquetas_sugeridas.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            className={cn("text-xs px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors", contactTags.includes(tag) && "opacity-40 cursor-default")}
                            disabled={contactTags.includes(tag)}
                          >
                            {contactTags.includes(tag) ? "✓ " : "+ "}{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!contact.ai_analysis && !analyzing && (
              <p className="text-sm text-muted-foreground">Sin análisis. Hacé click en "Analizar con IA" para generar un perfil completo.</p>
            )}
          </div>

          {/* ── Email template generator ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="size-3.5 text-blue-400" /> Generar Email
              </h2>
              <button
                onClick={() => setShowEmailGen(!showEmailGen)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showEmailGen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {showEmailGen ? "Ocultar" : "Crear template"}
              </button>
            </div>

            {showEmailGen && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo de email</label>
                    <select
                      value={emailType}
                      onChange={(e) => setEmailType(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                      {["bienvenida", "seguimiento", "propuesta", "reactivacion", "confirmacion", "nurturing"].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Contexto adicional</label>
                    <input
                      value={emailContext}
                      onChange={(e) => setEmailContext(e.target.value)}
                      placeholder="Ej: ofrecer descuento del 20%..."
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <button
                  onClick={generateEmail}
                  disabled={generatingEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                >
                  {generatingEmail ? (
                    <span className="flex gap-0.5">
                      {[0, 150, 300].map((d) => <span key={d} className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: `${d}ms` }} />)}
                    </span>
                  ) : <Send className="size-3.5" />}
                  Generar HTML
                </button>

                {emailHtml && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Template generado. Copiá el HTML:</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(emailHtml)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Copiar HTML
                      </button>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{emailHtml.slice(0, 2000)}{emailHtml.length > 2000 ? "\n..." : ""}</pre>
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border bg-card">Vista previa:</p>
                      <iframe
                        srcDoc={emailHtml}
                        className="w-full h-80 bg-white"
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground flex gap-4 pb-6">
            <span>ID: {contact.id}</span>
            <span>Creado: {new Date(contact.created_at).toLocaleDateString("es-AR")}</span>
            {contact.source && <span>Fuente: {contact.source}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({
  label, icon, editing, value, onChange, placeholder, type = "text", required, display
}: {
  label: string; icon: React.ReactNode; editing: boolean;
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
  display?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        />
      ) : (
        display || <p className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</p>
      )}
    </div>
  );
}

function InfoBlock({ title, value, sub, color }: { title: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };
  return (
    <div className={cn("rounded-lg border p-3", colorMap[color] || colorMap.blue)}>
      <p className="text-xs font-semibold opacity-70 mb-0.5">{title}</p>
      <p className="text-sm font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1 line-clamp-2">{sub}</p>}
    </div>
  );
}

function ListBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/20",
    blue: "text-blue-400 bg-blue-500/20",
  };
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
            <span className={cn("flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-2xs font-bold mt-0.5", colorMap[color] || colorMap.blue)}>
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
