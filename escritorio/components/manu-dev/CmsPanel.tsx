"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
  faWandMagicSparkles,
  faChevronRight,
  faX,
  faEnvelope,
  faStore,
  faBlog,
  faShareNodes,
  faPalette,
  faFileLines,
  faCircle,
  faTrash,
  faPlus,
  faCheck,
  faHeadset,
  faCode,
  faRobot,
  faCommentDots,
} from "@fortawesome/free-solid-svg-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  content_json: string;
}

interface CmsData {
  project: { id: number; name: string; subdomain: string; site_url: string; status: string };
  design: { primary_color: string; secondary_color: string; accent_color: string; font_heading?: string; font_body?: string } | null;
  pages: CmsPage[];
}

interface SocialLink {
  platform: string;
  enabled: boolean;
  value: string;
}

interface Message {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  read_at?: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_NETWORKS = [
  { id: "whatsapp", name: "WhatsApp", placeholder: "+52 55 1234 5678" },
  { id: "instagram", name: "Instagram", placeholder: "@tunegocio" },
  { id: "facebook", name: "Facebook", placeholder: "facebook.com/tunegocio" },
  { id: "tiktok", name: "TikTok", placeholder: "@tunegocio" },
  { id: "youtube", name: "YouTube", placeholder: "youtube.com/@tunegocio" },
  { id: "twitter", name: "Twitter / X", placeholder: "@tunegocio" },
  { id: "linkedin", name: "LinkedIn", placeholder: "linkedin.com/company/tu-negocio" },
  { id: "pinterest", name: "Pinterest", placeholder: "pinterest.com/tunegocio" },
  { id: "telegram", name: "Telegram", placeholder: "@tunegocio" },
  { id: "email", name: "Email", placeholder: "contacto@tunegocio.com" },
];

const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Playfair Display", "Merriweather", "Source Sans Pro", "Ubuntu",
];

// ─── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-3">
      <div className={[
        "bg-background rounded-2xl border border-border shadow-2xl flex flex-col w-full",
        wide ? "max-w-3xl" : "max-w-md",
      ].join(" ")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
            <FontAwesomeIcon icon={faX} className="text-xs" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Layout Modal ─────────────────────────────────────────────────────────────

function LayoutModal({ projectId, initialDesign, onClose, onSaved }: {
  projectId: number;
  initialDesign: CmsData["design"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [primary, setPrimary] = useState(initialDesign?.primary_color || "#1a1a2e");
  const [secondary, setSecondary] = useState(initialDesign?.secondary_color || "#16213e");
  const [accent, setAccent] = useState(initialDesign?.accent_color || "#0f3460");
  const [fontHeading, setFontHeading] = useState(initialDesign?.font_heading || "Inter");
  const [fontBody, setFontBody] = useState(initialDesign?.font_body || "Inter");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCss, setShowCss] = useState(false);
  const [cssContent, setCssContent] = useState("");
  const [loadingCss, setLoadingCss] = useState(false);
  const [savingCss, setSavingCss] = useState(false);
  const [cssMsg, setCssMsg] = useState("");

  // Load Google Fonts for preview
  useEffect(() => {
    GOOGLE_FONTS.forEach(f => {
      const id = `gf-cms-${f.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, []);

  async function loadCss() {
    setLoadingCss(true);
    setCssMsg("");
    try {
      const res = await fetch(`/api/manu-dev/css?project_id=${projectId}`);
      const d = await res.json();
      if (res.ok) { setCssContent(d.css || ""); setShowCss(true); }
      else setCssMsg(d.error || "Error al cargar CSS");
    } catch { setCssMsg("Error de red"); }
    finally { setLoadingCss(false); }
  }

  async function saveCss() {
    if (!confirm("Los cambios al CSS son irreversibles. \u00bfContinuar?")) return;
    setSavingCss(true);
    setCssMsg("");
    try {
      const res = await fetch("/api/manu-dev/css", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, css: cssContent }),
      });
      if (res.ok) { setCssMsg("CSS guardado. Redesplega para ver los cambios."); onSaved(); }
      else { const d = await res.json(); setCssMsg(d.error || "Error al guardar"); }
    } catch { setCssMsg("Error de red"); }
    finally { setSavingCss(false); }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/manu-dev/design", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          primary_color: primary,
          secondary_color: secondary,
          accent_color: accent,
          font_heading: fontHeading,
          font_body: fontBody,
        }),
      });
      if (res.ok) {
        setMsg("Guardado. Redesplega para ver los cambios.");
        onSaved();
      } else {
        const d = await res.json();
        setMsg(d.error || "Error al guardar");
      }
    } catch {
      setMsg("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Layout — Colores y Fuentes" onClose={onClose}>
      <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[60vh]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paleta de colores</p>
          {[
            { label: "Color primario", value: primary, set: setPrimary },
            { label: "Color secundario", value: secondary, set: setSecondary },
            { label: "Color de acento", value: accent, set: setAccent },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center gap-3">
              <input type="color" value={value} onChange={e => set(e.target.value)}
                className="h-9 w-9 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
              <input type="text" value={value} onChange={e => set(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipografias</p>
          {[
            { label: "Titulo (heading)", value: fontHeading, set: setFontHeading },
            { label: "Cuerpo de texto", value: fontBody, set: setFontBody },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <select value={value} onChange={e => set(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: `"${value}", sans-serif` }}>{value} — Muestra de texto</p>
            </div>
          ))}
        </div>

        {/* CSS Editor section */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editar CSS</p>
            <button onClick={showCss ? () => setShowCss(false) : loadCss} disabled={loadingCss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              {loadingCss ? "Cargando..." : showCss ? "Ocultar" : "Abrir editor"}
            </button>
          </div>
          {showCss && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-400 text-xs flex-shrink-0" />
                <p className="text-xxs text-amber-400">Los cambios al CSS son irreversibles. Edita con cuidado.</p>
              </div>
              <textarea value={cssContent} onChange={e => setCssContent(e.target.value)}
                rows={14} spellCheck={false}
                className="w-full resize-y rounded-lg border border-border bg-zinc-900 px-3 py-2 text-xs text-zinc-200 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring" />
              {cssMsg && <p className={`text-xs ${cssMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>{cssMsg}</p>}
              <button onClick={saveCss} disabled={savingCss}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-3 py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition-colors">
                {savingCss ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Guardando CSS...</> : <><FontAwesomeIcon icon={faCode} /> Guardar CSS</>}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border space-y-2">
        {msg && <p className={`text-xs ${msg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>{msg}</p>}
        <button onClick={save} disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-3 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
          {saving ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Guardando...</> : "Guardar cambios"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Pages Modal ─────────────────────────────────────────────────────────────

function PagesModal({ projectId, pages, onClose, onSaved }: {
  projectId: number;
  pages: CmsPage[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedPage, setSelectedPage] = useState<CmsPage | null>(pages[0] ?? null);
  const [changeText, setChangeText] = useState("");
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function applyChange() {
    if (!changeText.trim() || !selectedPage) return;
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch("/api/manu-dev/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, page_id: selectedPage.id, change_description: changeText.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: json.message || "Cambio aplicado. Redesplega para ver." });
        setChangeText("");
        onSaved();
      } else {
        setResult({ ok: false, msg: json.error || "Error al aplicar el cambio" });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Error de red" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="absolute inset-y-0 left-0 z-50 flex" style={{ width: "min(100%, 400px)" }}>
      <div className="bg-background border-r border-border flex flex-col w-full shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">Editar Paginas</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
            <FontAwesomeIcon icon={faX} className="text-xs" />
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-muted-foreground text-2xl mb-2" />
            <p className="text-sm text-muted-foreground">No hay paginas disponibles.</p>
            <p className="text-xs text-muted-foreground mt-1">Redesplega el sitio para regenerar las paginas.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <p className="text-xxs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Selecciona una pagina</p>
              <div className="space-y-0.5">
                {pages.map(page => (
                  <button key={page.id}
                    onClick={() => { setSelectedPage(page); setResult(null); setChangeText(""); }}
                    className={[
                      "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors text-left",
                      selectedPage?.id === page.id ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                    ].join(" ")}>
                    <span>{page.title}</span>
                    <FontAwesomeIcon icon={faChevronRight} className="text-2xs opacity-50" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              <p className="text-xxs font-semibold uppercase tracking-wide text-muted-foreground">
                Describí el cambio en: <span className="text-foreground normal-case font-bold">{selectedPage?.title ?? "—"}</span>
              </p>
              <textarea value={changeText} onChange={e => setChangeText(e.target.value)}
                placeholder={`Ej: Cambia el titulo del hero a "Bienvenidos a ${selectedPage?.title ?? "nuestra web"}".\nCambia el subtitulo a "Calidad y servicio garantizado".`}
                rows={6} disabled={applying || !selectedPage}
                className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 transition-colors" />
              {result && (
                <div className={["rounded-lg px-3 py-2 text-xs", result.ok
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"].join(" ")}>
                  {result.msg}
                </div>
              )}
              <button onClick={applyChange} disabled={applying || !changeText.trim() || !selectedPage}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-3 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
                {applying
                  ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Aplicando con IA...</>
                  : <><FontAwesomeIcon icon={faWandMagicSparkles} /> Aplicar cambio</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Social Modal ─────────────────────────────────────────────────────────────

function SocialModal({ projectId, onClose, onSaved }: {
  projectId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [links, setLinks] = useState<SocialLink[]>(
    SOCIAL_NETWORKS.map(n => ({ platform: n.id, enabled: false, value: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/manu-dev/social-links?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => {
        if (d.social_links && Array.isArray(d.social_links)) {
          setLinks(SOCIAL_NETWORKS.map(n => {
            const existing = d.social_links.find((l: SocialLink) => l.platform === n.id);
            return existing ?? { platform: n.id, enabled: false, value: "" };
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  function update(platform: string, field: "enabled" | "value", val: string | boolean) {
    setLinks(prev => prev.map(l => l.platform === platform ? { ...l, [field]: val } : l));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const active = links.filter(l => l.enabled && l.value.trim());
      const res = await fetch("/api/manu-dev/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, social_links: active }),
      });
      const d = await res.json();
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setMsg(d.error || "Error al guardar");
      }
    } catch {
      setMsg("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Redes Sociales y Contacto" onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-8"><FontAwesomeIcon icon={faSpinner} className="animate-spin text-muted-foreground text-xl" /></div>
      ) : (
        <>
          <div className="overflow-y-auto max-h-[55vh] px-5 py-4">
            <p className="text-xs text-muted-foreground mb-4">Activa las que uses y agregá tu usuario o URL. El sitio se redesplegara automaticamente al guardar.</p>
            <div className="space-y-3">
              {SOCIAL_NETWORKS.map(network => {
                const link = links.find(l => l.platform === network.id) ?? { platform: network.id, enabled: false, value: "" };
                return (
                  <div key={network.id} className="flex items-center gap-3">
                    <input type="checkbox" id={`social-${network.id}`} checked={link.enabled}
                      onChange={e => update(network.id, "enabled", e.target.checked)}
                      className="h-4 w-4 cursor-pointer flex-shrink-0 accent-foreground" />
                    <label htmlFor={`social-${network.id}`}
                      className="text-sm font-medium text-foreground w-24 flex-shrink-0 cursor-pointer">
                      {network.name}
                    </label>
                    <input type={network.id === "email" ? "email" : "text"} value={link.value}
                      onChange={e => update(network.id, "value", e.target.value)}
                      placeholder={network.placeholder} disabled={!link.enabled}
                      className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors" />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-5 py-4 border-t border-border space-y-2">
            {msg && <p className="text-xs text-red-400">{msg}</p>}
            <button onClick={save} disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-3 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
              {saving ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Guardando...</> : "Guardar y redesplegar"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Messages Modal ───────────────────────────────────────────────────────────

function MessagesModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch(`/api/manu-dev/messages?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages || []);
        setUnread(d.unread || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function markRead(id: number) {
    await fetch("/api/manu-dev/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: id, project_id: projectId }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function deleteMsg(id: number) {
    await fetch(`/api/manu-dev/messages?message_id=${id}&project_id=${projectId}`, { method: "DELETE" });
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const msg = messages.find(m => m.id === id);
    if (msg && !msg.read_at) markRead(id);
  }

  return (
    <Modal title={`Mensajes${unread > 0 ? ` (${unread} sin leer)` : ""}`} onClose={onClose} wide>
      {loading ? (
        <div className="flex justify-center py-8"><FontAwesomeIcon icon={faSpinner} className="animate-spin text-muted-foreground text-xl" /></div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <FontAwesomeIcon icon={faEnvelope} className="text-muted-foreground text-3xl mb-3" />
          <p className="text-sm font-medium text-foreground">No hay mensajes todavia</p>
          <p className="text-xs text-muted-foreground mt-1">Los mensajes de los formularios de contacto apareceran aqui.</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-border">
          {messages.map(msg => (
            <div key={msg.id}
              className={["transition-colors", !msg.read_at ? "bg-accent/20" : ""].join(" ")}>
              <div className="flex items-start gap-3 px-5 py-3">
                {!msg.read_at && (
                  <FontAwesomeIcon icon={faCircle} className="text-blue-400 text-[8px] mt-1.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(msg.id)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{msg.name || "Anonimo"}</p>
                    <p className="text-xxs text-muted-foreground flex-shrink-0">
                      {new Date(msg.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </p>
                  </div>
                  {msg.email && <p className="text-xs text-muted-foreground truncate">{msg.email}</p>}
                  {msg.subject && <p className="text-xs text-foreground/70 truncate">{msg.subject}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{msg.message}</p>
                </div>
                <button onClick={() => deleteMsg(msg.id)} className="flex-shrink-0 text-muted-foreground hover:text-red-400 transition-colors p-1 rounded">
                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                </button>
              </div>
              {expanded === msg.id && (
                <div className="px-5 pb-4 bg-muted/30 text-sm text-foreground whitespace-pre-wrap border-t border-border">
                  <div className="pt-3 space-y-1">
                    {msg.phone && <p className="text-xs text-muted-foreground">Telefono: {msg.phone}</p>}
                    <p className="text-sm mt-2">{msg.message}</p>
                    {msg.email && (
                      <a href={`mailto:${msg.email}`}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-400 hover:underline">
                        <FontAwesomeIcon icon={faEnvelope} /> Responder a {msg.email}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Store Modal ──────────────────────────────────────────────────────────────

function StoreModal({ projectId, onClose, onSaved }: { projectId: number; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<{ has_store: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [tab, setTab] = useState<"products" | "categories" | "info">("products");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", sale_price: "", category_id: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [storeInfo, setStoreInfo] = useState({ shipping: "", returns: "", how_to_buy: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/manu-dev/store?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => {
        setStatus(d);
        if (d.store_info) setStoreInfo({ shipping: d.store_info.shipping || "", returns: d.store_info.returns || "", how_to_buy: d.store_info.how_to_buy || "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!status?.has_store) return;
    fetch(`/api/manu-dev/products?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setCategories(d.categories || []); })
      .catch(() => {});
  }, [status, projectId]);

  async function activate() {
    setActivating(true);
    const res = await fetch("/api/manu-dev/store", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => null);
    if (res?.ok) { setStatus({ has_store: true }); onSaved(); }
    setActivating(false);
  }

  async function addProduct() {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/manu-dev/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: form.name, description: form.description,
          price: form.price ? Number(form.price) : null,
          sale_price: form.sale_price ? Number(form.sale_price) : null,
          category_id: form.category_id ? Number(form.category_id) : null,
          tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setFormError(d?.error || "Error al guardar el producto");
        return;
      }
      const listRes = await fetch(`/api/manu-dev/products?project_id=${projectId}`).then(r => r.json());
      setProducts(listRes.products || []);
      setForm({ name: "", description: "", price: "", sale_price: "", category_id: "", tags: "" });
      setShowForm(false);
      onSaved();
    } catch {
      setFormError("Error de red al guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: number) {
    const res = await fetch(`/api/manu-dev/products?id=${id}&project_id=${projectId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setFormError("Error al eliminar el producto"); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
    onSaved();
  }

  async function saveInfo() {
    setSavingInfo(true);
    await fetch("/api/manu-dev/store", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, store_info: storeInfo }),
    });
    setSavingInfo(false);
    onSaved();
  }

  if (loading) return (
    <Modal title="Tienda" onClose={onClose} wide>
      <div className="flex justify-center py-8"><FontAwesomeIcon icon={faSpinner} className="animate-spin text-muted-foreground text-xl" /></div>
    </Modal>
  );

  if (!status?.has_store) return (
    <Modal title="Activar Tienda" onClose={onClose}>
      <div className="px-5 py-8 text-center space-y-4">
        <FontAwesomeIcon icon={faStore} className="text-4xl text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">Tu sitio no tiene tienda activa</p>
          <p className="text-xs text-muted-foreground mt-1">Al activar la tienda podras agregar productos, categorias e informacion de envios.</p>
          <p className="text-xs text-muted-foreground mt-1">Se redesplegara el sitio automaticamente.</p>
        </div>
        <button onClick={activate} disabled={activating}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
          {activating ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Activando...</> : "Activar Tienda"}
        </button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Tienda" onClose={onClose} wide>
      <div className="flex border-b border-border px-5">
        {(["products", "categories", "info"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={["px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"].join(" ")}>
            {t === "products" ? "Productos" : t === "categories" ? "Categorias" : "Info de la tienda"}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[55vh] px-5 py-4">
        {tab === "products" && (
          <div className="space-y-3">
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex justify-end">
              <button onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors">
                <FontAwesomeIcon icon={faPlus} /> Agregar producto
              </button>
            </div>
            {showForm && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
                {[
                  { label: "Nombre *", key: "name", type: "text" },
                  { label: "Descripcion", key: "description", type: "text" },
                  { label: "Precio", key: "price", type: "number" },
                  { label: "Precio de oferta", key: "sale_price", type: "number" },
                  { label: "Tags (separados por coma)", key: "tags", type: "text" },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                ))}
                {categories.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                    <select value={form.category_id} onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Sin categoria</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={addProduct} disabled={saving || !form.name.trim()}
                  className="w-full rounded-xl bg-foreground text-background py-2 text-sm font-semibold disabled:opacity-40">
                  {saving ? "Guardando..." : "Guardar producto"}
                </button>
              </div>
            )}
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay productos todavia.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      {p.price && <p className="text-xs text-muted-foreground">${p.price}{p.sale_price ? ` → $${p.sale_price}` : ""}</p>}
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "categories" && (
          <CategoriesTab projectId={projectId} type="product" categories={categories} setCategories={setCategories} onSaved={onSaved} />
        )}

        {tab === "info" && (
          <div className="space-y-4">
            {[
              { label: "Politica de envios", key: "shipping" },
              { label: "Politica de devoluciones", key: "returns" },
              { label: "Como comprar", key: "how_to_buy" },
            ].map(({ label, key }) => (
              <div key={key}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
                <textarea value={(storeInfo as any)[key]} onChange={e => setStoreInfo(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={4} className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
            <button onClick={saveInfo} disabled={savingInfo}
              className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold disabled:opacity-40">
              {savingInfo ? "Guardando..." : "Guardar informacion"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Blog Modal ───────────────────────────────────────────────────────────────

function BlogModal({ projectId, onClose, onSaved }: { projectId: number; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<{ has_blog: boolean; blog_config: { allow_sharing: boolean; show_author: boolean } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [tab, setTab] = useState<"posts" | "categories" | "config">("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "", content: "", featured_image: "", tags: "", category_id: "", published: false });
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({ allow_sharing: true, show_author: false });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/manu-dev/blog?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => { setStatus(d); if (d.blog_config) setConfig(d.blog_config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!status?.has_blog) return;
    fetch(`/api/manu-dev/blog-posts?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => { setPosts(d.posts || []); setCategories(d.categories || []); })
      .catch(() => {});
  }, [status, projectId]);

  async function activate() {
    setActivating(true);
    const res = await fetch("/api/manu-dev/blog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => null);
    if (res?.ok) { setStatus({ has_blog: true, blog_config: config }); onSaved(); }
    setActivating(false);
  }

  async function addPost() {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/manu-dev/blog-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId, title: form.title, summary: form.summary, content: form.content,
          featured_image: form.featured_image,
          tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          category_id: form.category_id ? Number(form.category_id) : null,
          published: form.published ? 1 : 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setFormError(d?.error || "Error al guardar la entrada");
        return;
      }
      const listRes = await fetch(`/api/manu-dev/blog-posts?project_id=${projectId}`).then(r => r.json());
      setPosts(listRes.posts || []);
      setForm({ title: "", summary: "", content: "", featured_image: "", tags: "", category_id: "", published: false });
      setShowForm(false);
      onSaved();
    } catch {
      setFormError("Error de red al guardar la entrada");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(id: number) {
    const res = await fetch(`/api/manu-dev/blog-posts?id=${id}&project_id=${projectId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setFormError("Error al eliminar la entrada"); return; }
    setPosts(prev => prev.filter(p => p.id !== id));
    onSaved();
  }

  async function saveConfig() {
    await fetch("/api/manu-dev/blog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, blog_config: config }),
    });
    onSaved();
  }

  if (loading) return (
    <Modal title="Blog" onClose={onClose} wide>
      <div className="flex justify-center py-8"><FontAwesomeIcon icon={faSpinner} className="animate-spin text-muted-foreground text-xl" /></div>
    </Modal>
  );

  if (!status?.has_blog) return (
    <Modal title="Activar Blog" onClose={onClose}>
      <div className="px-5 py-8 text-center space-y-4">
        <FontAwesomeIcon icon={faBlog} className="text-4xl text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">Tu sitio no tiene blog activo</p>
          <p className="text-xs text-muted-foreground mt-1">Al activar el blog podras publicar entradas, organizar categorias y configurar opciones.</p>
        </div>
        <button onClick={activate} disabled={activating}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
          {activating ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Activando...</> : "Activar Blog"}
        </button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Blog" onClose={onClose} wide>
      <div className="flex border-b border-border px-5">
        {(["posts", "categories", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={["px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"].join(" ")}>
            {t === "posts" ? "Entradas" : t === "categories" ? "Categorias" : "Configuracion"}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[55vh] px-5 py-4">
        {tab === "posts" && (
          <div className="space-y-3">
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex justify-end">
              <button onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors">
                <FontAwesomeIcon icon={faPlus} /> Nueva entrada
              </button>
            </div>
            {showForm && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
                {[
                  { label: "Titulo *", key: "title" },
                  { label: "Resumen", key: "summary" },
                  { label: "Imagen destacada (URL)", key: "featured_image" },
                  { label: "Tags (separados por coma)", key: "tags" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <input type="text" value={(form as any)[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                ))}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contenido</p>
                  <textarea value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={5} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                {categories.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                    <select value={form.category_id} onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Sin categoria</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.published} onChange={e => setForm(prev => ({ ...prev, published: e.target.checked }))}
                    className="h-4 w-4 accent-foreground" />
                  Publicar inmediatamente
                </label>
                <button onClick={addPost} disabled={saving || !form.title.trim()}
                  className="w-full rounded-xl bg-foreground text-background py-2 text-sm font-semibold disabled:opacity-40">
                  {saving ? "Guardando..." : "Guardar entrada"}
                </button>
              </div>
            )}
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay entradas todavia.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.published ? "Publicada" : "Borrador"}</p>
                    </div>
                    <button onClick={() => deletePost(p.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "categories" && (
          <CategoriesTab projectId={projectId} type="blog" categories={categories} setCategories={setCategories} onSaved={onSaved} />
        )}

        {tab === "config" && (
          <div className="space-y-4">
            {[
              { label: "Permitir que el lector comparta entradas", key: "allow_sharing" },
              { label: "Mostrar nombre de quien publica", key: "show_author" },
            ].map(({ label, key }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={(config as any)[key]}
                  onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-foreground" />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
            <button onClick={saveConfig}
              className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold hover:opacity-80 transition-colors">
              Guardar configuracion
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Categories Tab (shared) ──────────────────────────────────────────────────

function CategoriesTab({ projectId, type, categories, setCategories, onSaved }: {
  projectId: number;
  type: "product" | "blog";
  categories: any[];
  setCategories: (c: any[]) => void;
  onSaved: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/manu-dev/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, type, name: newName.trim() }),
    }).then(r => r.json());
    if (res.id) {
      const updated = await fetch(`/api/manu-dev/categories?project_id=${projectId}&type=${type}`).then(r => r.json());
      setCategories(updated.categories || []);
      setNewName("");
      onSaved();
    }
    setSaving(false);
  }

  async function remove(id: number) {
    await fetch(`/api/manu-dev/categories?id=${id}&project_id=${projectId}&type=${type}`, { method: "DELETE" });
    setCategories(categories.filter(c => c.id !== id));
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la categoria"
          className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <button onClick={add} disabled={saving || !newName.trim()}
          className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
          {saving ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : <FontAwesomeIcon icon={faPlus} />}
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No hay categorias.</p>
      ) : (
        <div className="space-y-1">
          {categories.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
              <span className="text-sm text-foreground">{c.name}</span>
              <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Support Modal (WhatsApp) ──────────────────────────────────────────────────

function SupportModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");

  function send() {
    if (!message.trim()) return;
    const encoded = encodeURIComponent(message.trim());
    window.open(`https://wa.me/59896082266?text=${encoded}`, "_blank", "noopener");
  }

  return (
    <Modal title="Soporte" onClose={onClose}>
      <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
        <p className="text-sm text-muted-foreground">
          Escribi tu mensaje y te contactaremos por WhatsApp.
        </p>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Describinos tu consulta o problema..."
          rows={5}
          className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors" />
      </div>
      <div className="px-5 py-4 border-t border-border">
        <button onClick={send} disabled={!message.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white px-3 py-2.5 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors">
          <FontAwesomeIcon icon={faCommentDots} /> Enviar por WhatsApp
        </button>
      </div>
    </Modal>
  );
}

// ─── AI Fix Modal ──────────────────────────────────────────────────────────────

function AiFixModal({ projectId, pages, onClose, onSaved }: {
  projectId: number;
  pages: CmsPage[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [selectedPage, setSelectedPage] = useState<CmsPage | null>(pages[0] ?? null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function applyFix() {
    if (!description.trim() || !selectedPage) return;
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch("/api/manu-dev/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          page_id: selectedPage.id,
          change_description: description.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: json.message || "Correccion aplicada. Redesplega para ver." });
        setDescription("");
        onSaved();
      } else {
        setResult({ ok: false, msg: json.error || "Error al aplicar la correccion" });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Error de red" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal title="Corregir con IA" onClose={onClose} wide>
      <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagina a corregir</p>
          <div className="flex flex-wrap gap-1.5">
            {pages.map(page => (
              <button key={page.id} onClick={() => { setSelectedPage(page); setResult(null); }}
                className={["rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  selectedPage?.id === page.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                ].join(" ")}>
                {page.title}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Describi la correccion para: <span className="text-foreground normal-case font-bold">{selectedPage?.title ?? "-"}</span>
          </p>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ej: Corrige el color del boton del hero, esta muy claro. Cambia el texto del footer..."
            rows={5} disabled={applying || !selectedPage}
            className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 transition-colors" />
        </div>
        {result && (
          <div className={["rounded-lg px-3 py-2 text-xs",
            result.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          ].join(" ")}>
            {result.msg}
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-border">
        <button onClick={applyFix} disabled={applying || !description.trim() || !selectedPage}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-3 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-colors">
          {applying
            ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Aplicando correccion...</>
            : <><FontAwesomeIcon icon={faRobot} /> Aplicar correccion con IA</>}
        </button>
      </div>
    </Modal>
  );
}

// ─── Main CmsPanel ─────────────────────────────────────────────────────────────

export default function CmsPanel({ projectId, siteUrl, onBack }: {
  projectId: number;
  siteUrl: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<CmsData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [activeModal, setActiveModal] = useState<
    null | "layout" | "pages" | "social" | "messages" | "store" | "blog" | "aifix" | "support"
  >(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");
  const [rebuildDone, setRebuildDone] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch(`/api/manu-dev/content?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => { setData(d); })
      .catch(() => {})
      .finally(() => setLoadingData(false));

    // Fetch unread count
    fetch(`/api/manu-dev/messages?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => setUnreadCount(d.unread || 0))
      .catch(() => {});
  }, [projectId]);

  function closeModal() { setActiveModal(null); }

  function handleSaved() {
    setPendingChanges(true);
    closeModal();
  }

  // Content edits (pages / AI fix) trigger their own auto-rebuild server-side
  // (see app/api/manu-dev/content/route.ts), so there's no need to flag
  // pendingChanges for a manual "Redesplegar" on top of it — but the preview
  // iframe still needs to be refreshed once that background rebuild finishes,
  // otherwise the admin sees stale content with no sign the edit worked.
  function handleContentSaved() {
    closeModal();
    waitForContentSync();
  }

  async function waitForContentSync() {
    setRebuildMsg("Aplicando cambios...");
    setRebuildDone(false);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const d = await fetch(`/api/manu-dev/content?project_id=${projectId}`).then((r) => r.json());
        if (d?.project?.status && d.project.status !== "building") {
          setRebuildMsg("¡Cambios aplicados!");
          setRebuildDone(true);
          setIframeKey((k) => k + 1);
          return;
        }
      } catch { /* keep polling */ }
    }
    // Se agoto el tiempo de espera: igual refrescamos por si termino justo despues del ultimo chequeo
    setIframeKey((k) => k + 1);
  }

  async function rebuild() {
    setRebuilding(true);
    setRebuildMsg("Iniciando redespliegue...");
    setRebuildDone(false);
    try {
      const res = await fetch("/api/manu-dev/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok || !res.body) { setRebuildMsg("Error al iniciar rebuild"); setRebuilding(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let parsed: any;
          try { parsed = JSON.parse(line.slice(6)); } catch { continue; }
          if (parsed.message) setRebuildMsg(parsed.message);
          if (parsed.status === "done") {
            setRebuildDone(true);
            setPendingChanges(false);
            setTimeout(() => setIframeKey(k => k + 1), 3000);
          }
        }
      }
    } catch (e: any) {
      setRebuildMsg(e?.message || "Error");
    } finally {
      setRebuilding(false);
    }
  }

  if (loadingData) return (
    <div className="flex h-full items-center justify-center">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-muted-foreground text-xl" />
    </div>
  );

  if (!data) return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div>
        <FontAwesomeIcon icon={faTriangleExclamation} className="text-muted-foreground text-2xl mb-2" />
        <p className="text-sm text-muted-foreground">No se pudo cargar el proyecto.</p>
        <button onClick={onBack} className="mt-3 text-xs text-muted-foreground underline">Volver al chat</button>
      </div>
    </div>
  );

  const toolbarButtons: { key: typeof activeModal; label: string; icon: any; badge?: number }[] = [
    { key: "layout", label: "Layout", icon: faPalette },
    { key: "pages", label: "Paginas", icon: faFileLines },
    { key: "social", label: "Redes", icon: faShareNodes },
    { key: "messages", label: "Mensajes", icon: faEnvelope, badge: unreadCount || undefined },
    { key: "store", label: "Tienda", icon: faStore },
    { key: "blog", label: "Blog", icon: faBlog },
    { key: "aifix", label: "Corregir con IA", icon: faRobot },
  ];

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* ── Header 1: navigation + actions ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background border-b border-border flex-shrink-0">
        <button onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Volver al chat</span>
        </button>
        <div className="flex items-center gap-2">
          <a href={siteUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-2xs" />
            Ver sitio
          </a>
          <button onClick={rebuild} disabled={rebuilding}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              rebuilding ? "bg-muted text-muted-foreground opacity-70"
                : pendingChanges ? "bg-emerald-500 text-white hover:bg-emerald-600 animate-pulse"
                : "border border-border bg-muted text-foreground hover:bg-accent"
            ].join(" ")}>
            {rebuilding
              ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> {rebuildMsg.slice(0, 25) || "Redesplegando..."}</>
              : pendingChanges
              ? <><FontAwesomeIcon icon={faRotateRight} /> Redesplegar</>
              : <><FontAwesomeIcon icon={faRotateRight} /> Redesplegar</>
            }
          </button>
          <button onClick={() => setActiveModal(activeModal === "support" ? null : "support")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 transition-colors">
            <FontAwesomeIcon icon={faHeadset} className="text-2xs" />
            Soporte
          </button>
        </div>
      </div>

      {/* rebuild status bar */}
      {rebuildDone && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-xs flex-shrink-0">
          <FontAwesomeIcon icon={faCheck} />
          {rebuildMsg}
        </div>
      )}

      {/* ── Header 2: toolbar ── */}
      <div className="flex items-center justify-center gap-0.5 px-2 py-1.5 bg-background border-b border-border overflow-x-auto flex-shrink-0">
        {toolbarButtons.map(({ key, label, icon, badge }) => (
          <button key={key} onClick={() => setActiveModal(activeModal === key ? null : key)}
            className={[
              "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
              activeModal === key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            ].join(" ")}>
            <FontAwesomeIcon icon={icon} className="text-xxs" />
            {label}
            {badge ? (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Iframe preview (fills remaining space) ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <iframe key={iframeKey} ref={iframeRef} src={siteUrl}
          className="w-full h-full border-0" title="Preview del sitio" />

        {/* ── Modals rendered over the iframe ── */}
        {activeModal === "layout" && data.design && (
          <LayoutModal
            projectId={projectId}
            initialDesign={data.design}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}

        {activeModal === "pages" && (
          <PagesModal
            projectId={projectId}
            pages={data.pages}
            onClose={closeModal}
            onSaved={handleContentSaved}
          />
        )}

        {activeModal === "social" && (
          <SocialModal
            projectId={projectId}
            onClose={closeModal}
            onSaved={() => { setPendingChanges(true); closeModal(); }}
          />
        )}

        {activeModal === "messages" && (
          <MessagesModal
            projectId={projectId}
            onClose={closeModal}
          />
        )}

        {activeModal === "store" && (
          <StoreModal
            projectId={projectId}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}

        {activeModal === "blog" && (
          <BlogModal
            projectId={projectId}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}

        {activeModal === "aifix" && (
          <AiFixModal
            projectId={projectId}
            pages={data.pages}
            onClose={closeModal}
            onSaved={handleContentSaved}
          />
        )}

        {activeModal === "support" && (
          <SupportModal onClose={closeModal} />
        )}
      </div>
    </div>
  );
}
