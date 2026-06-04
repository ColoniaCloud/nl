"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ContactsTable, Contact } from "@/components/margarita/crm/ContactsTable";
import { ContactSheet } from "@/components/margarita/crm/ContactSheet";
import { ScrapePanel } from "@/components/margarita/crm/ScrapePanel";
import type { ContactData } from "@/components/margarita/crm/ContactForm";
import {
  Users, Search, Plus, Sparkles, RefreshCw,
  CheckCircle2, CalendarDays, Send, Bot, X,
  Wrench, ChevronRight, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marked } from "marked";

export const dynamic = "force-dynamic";

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  tools?: { name: string; status: "running" | "done" | "error"; result?: any }[];
}

const TOOL_LABELS: Record<string, string> = {
  search_leads: "Buscando leads...",
  get_lead: "Obteniendo perfil...",
  analyze_lead: "Analizando lead con IA...",
  create_email_template: "Generando template HTML...",
  create_sales_funnel: "Creando funnel con Jordan...",
  update_lead: "Actualizando lead...",
  create_tag: "Creando etiqueta...",
  assign_tag: "Asignando etiqueta...",
};

const AGENT_SUGGESTIONS = [
  "Analizá todos los leads sin score y etiquetá los mejores",
  "¿Cuáles son mis leads con mayor urgencia?",
  "Creá un email de bienvenida para el primer lead",
  "Buscá leads del rubro gastronomía",
  "Creá un funnel High Ticket para mis leads calificados",
];

export default function CRMPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<(ContactData & { id?: number }) | null>(null);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, optin: 0, thisMonth: 0 });

  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentSending, setAgentSending] = useState(false);
  const agentEndRef = useRef<HTMLDivElement>(null);

  const LIMIT = 50;

  const fetchContacts = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), ...(q ? { search: q } : {}) });
      const res = await fetch(`/api/margarita/crm/contacts?${params}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        console.error("Error cargando contactos CRM:", res.status);
        return;
      }
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } finally { setLoading(false); }
  }, [page, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/margarita/crm/contacts?limit=1000", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        console.error("Error cargando stats CRM:", res.status);
        return;
      }
      const allData = await res.json();
      const all = allData.contacts || [];
      const optinCount = all.filter((c: Contact) => c.optin).length;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const thisMonthCount = all.filter((c: Contact) => c.fecha_contactado && c.fecha_contactado >= monthStart).length;
      setStats({ total: allData.total || 0, optin: optinCount, thisMonth: thisMonthCount });
    } catch {}
  }, []);

  useEffect(() => { fetchContacts(page, search); }, [page, search]);
  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { agentEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentMessages]);

  function openEdit(c: Contact) {
    const tags = Array.isArray(c.etiquetas) ? c.etiquetas
      : c.etiquetas ? (() => { try { return JSON.parse(c.etiquetas as any); } catch { return []; } })() : [];
    setEditingContact({
      id: c.id, nombre: c.nombre || "", empresa: c.empresa || "",
      email: c.email || "", telefono: c.telefono || "", optin: Boolean(c.optin),
      fecha_contactado: c.fecha_contactado ? new Date(c.fecha_contactado).toISOString().split("T")[0] : "",
      pais: c.pais || "", ciudad: c.ciudad || "", direccion: c.direccion || "",
      etiquetas: tags, notas: c.notas || "",
      website: (c as any).website || "", rubro: (c as any).rubro || "",
      status: (c as any).status || "nuevo",
    });
    setSheetOpen(true);
  }

  async function handleSave(data: ContactData) {
    const url = editingContact?.id ? `/api/margarita/crm/contacts/${editingContact.id}` : "/api/margarita/crm/contacts";
    const method = editingContact?.id ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error"); }
    await fetchContacts(page, search);
    await fetchStats();
  }

  async function handleDelete(id: number) {
    if (!confirm("Eliminar este contacto?")) return;
    await fetch(`/api/margarita/crm/contacts/${id}`, { method: "DELETE" });
    await fetchContacts(page, search);
    await fetchStats();
  }

  async function handleImport(scraped: any[]) {
    const res = await fetch("/api/margarita/crm/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: scraped }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error al importar"); }
    await fetchContacts(1, search);
    setPage(1);
    await fetchStats();
  }

  function addAgentMsg(role: "user" | "assistant", content: string, extra?: Partial<AgentMessage>): string {
    const id = `am-${Date.now()}-${Math.random()}`;
    setAgentMessages((prev) => [...prev, { id, role, content, ...extra }]);
    return id;
  }

  function updateAgentMsg(id: string, updates: Partial<AgentMessage>) {
    setAgentMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m));
  }

  async function sendAgentMessage(text: string) {
    if (!text.trim() || agentSending) return;
    setAgentSending(true);
    addAgentMsg("user", text);
    setAgentInput("");
    const history = agentMessages.map((m) => ({ role: m.role, content: m.content }));
    const assistantId = addAgentMsg("assistant", "", { streaming: true, tools: [] });

    try {
      const res = await fetch("/api/margarita/crm/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.body) throw new Error("Sin stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let textAccum = "";
      let currentTools: AgentMessage["tools"] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              textAccum += data.text;
              updateAgentMsg(assistantId, { content: textAccum, streaming: true, tools: currentTools });
            } else if (data.type === "tool_start") {
              currentTools = [...(currentTools || []), { name: data.tool, status: "running" }];
              updateAgentMsg(assistantId, { content: textAccum, tools: currentTools, streaming: true });
            } else if (data.type === "tool_done") {
              currentTools = (currentTools || []).map((t) =>
                t.name === data.tool && t.status === "running" ? { ...t, status: "done", result: data.result } : t
              );
              updateAgentMsg(assistantId, { content: textAccum, tools: currentTools, streaming: true });
              if (["update_lead", "assign_tag", "analyze_lead"].includes(data.tool)) {
                fetchContacts(page, search);
              }
            } else if (data.type === "tool_error") {
              currentTools = (currentTools || []).map((t) =>
                t.name === data.tool && t.status === "running" ? { ...t, status: "error" } : t
              );
              updateAgentMsg(assistantId, { content: textAccum, tools: currentTools, streaming: true });
            } else if (data.type === "done") {
              updateAgentMsg(assistantId, { content: textAccum, streaming: false, tools: currentTools });
            } else if (data.error) {
              updateAgentMsg(assistantId, { content: `Error: ${data.error}`, streaming: false });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      updateAgentMsg(assistantId, { content: `Error: ${err.message}`, streaming: false });
    } finally {
      setAgentSending(false);
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20">
                <Users className="size-4 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold">CRM</h1>
                <p className="text-xs text-muted-foreground">Margarita Mkt</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScrapeOpen(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="size-3.5 text-emerald-400" /> Buscador IA
              </button>
              <button
                onClick={() => { setEditingContact(null); setSheetOpen(true); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Plus className="size-3.5" /> Nuevo lead
              </button>
              <button
                onClick={() => setAgentOpen(!agentOpen)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                  agentOpen ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                )}
              >
                <Bot className="size-3.5" />
                {agentOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: <Users className="size-3.5 text-muted-foreground" />, value: stats.total, label: "Total leads" },
              { icon: <CheckCircle2 className="size-3.5 text-emerald-400" />, value: stats.optin, label: "Con optin" },
              { icon: <CalendarDays className="size-3.5 text-blue-400" />, value: stats.thisMonth, label: "Este mes" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card/50 px-4 py-3 flex items-center gap-3">
                {s.icon}
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-2.5 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
              placeholder="Buscar por nombre, empresa, rubro..."
              className="pl-8 h-8 text-sm bg-muted border-border"
            />
          </div>
          {search && (
            <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted px-2 py-1 rounded-md">
              "{search}" <X className="size-3" />
            </button>
          )}
          <button onClick={() => fetchContacts(page, search)} className="ml-auto p-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <span className="text-xs text-muted-foreground">{total} leads</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && contacts.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
              <div className="flex gap-1">{[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${d}ms` }} />)}</div>
              Cargando...
            </div>
          ) : (
            <ContactsTable
              contacts={contacts} total={total} page={page} limit={LIMIT}
              onEdit={openEdit} onDelete={handleDelete}
              onView={(c) => router.push(`/services/margarita/crm/contacts/${c.id}`)}
              onPageChange={(p) => { setPage(p); fetchContacts(p, search); }}
            />
          )}
        </div>
      </div>

      {/* Agent panel */}
      {agentOpen && (
        <div className="w-[380px] flex-shrink-0 border-l border-border flex flex-col bg-card/30">
          <div className="flex-shrink-0 flex items-center gap-2 px-4 h-12 border-b border-border">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
              <Bot className="size-3.5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Agente CRM</p>
              <p className="text-xs text-muted-foreground">con acceso a todos tus leads</p>
            </div>
            <button onClick={() => setAgentOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {agentMessages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">Puedo ayudarte a gestionar leads, analizar prospectos, crear emails y funnels.</p>
                <div className="space-y-1.5">
                  {AGENT_SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendAgentMessage(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-white/[0.05] hover:border-emerald-500/40 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                      <ChevronRight className="size-3 text-emerald-400 flex-shrink-0" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {agentMessages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "user" ? (
                  <div className="bg-emerald-600 text-white rounded-xl sm:rounded-2xl sm:rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%] space-y-2">
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="space-y-1">
                        {msg.tools.map((t, i) => (
                          <div key={i} className={cn(
                            "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border",
                            t.status === "running" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                            t.status === "done" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            "bg-red-500/10 border-red-500/20 text-red-400"
                          )}>
                            <Wrench className="size-3 flex-shrink-0" />
                            <span>{t.status === "running" ? TOOL_LABELS[t.name] || t.name : t.name}</span>
                            {t.status === "running" && (
                              <span className="flex gap-0.5 ml-auto">
                                {[0, 150, 300].map((d) => <span key={d} className="w-1 h-1 rounded-full bg-current animate-pulse" style={{ animationDelay: `${d}ms` }} />)}
                              </span>
                            )}
                            {t.status === "done" && <CheckCircle2 className="size-3 ml-auto flex-shrink-0" />}
                            {t.status === "done" && t.result?.contacts && (
                              <span className="ml-1 text-xs opacity-70">{t.result.contacts.length} encontrados</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.streaming && !msg.content ? (
                      <div className="flex gap-1 py-2 px-1">
                        {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${d}ms` }} />)}
                      </div>
                    ) : msg.content ? (
                      <div className="text-sm text-foreground">
                        <div
                          className="prose prose-sm prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: String(marked(msg.content)) }}
                        />
                        {msg.streaming && <span className="inline-block w-1.5 h-3.5 bg-current opacity-60 animate-pulse ml-0.5" />}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            <div ref={agentEndRef} />
          </div>

          <div className="flex-shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAgentMessage(agentInput); } }}
                placeholder="Pedile algo al agente..."
                rows={1}
                disabled={agentSending}
                className="flex-1 resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 min-h-[36px] sm:min-h-[42px] max-h-[100px] overflow-y-auto"
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 100)}px`; }}
              />
              <button
                onClick={() => sendAgentMessage(agentInput)}
                disabled={agentSending || !agentInput.trim()}
                className="flex h-9 w-9 sm:h-[42px] sm:w-[42px] flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {agentSending ? (
                  <span className="flex gap-0.5">
                    {[0, 150, 300].map((d) => <span key={d} className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: `${d}ms` }} />)}
                  </span>
                ) : <Send className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Enter para enviar · Shift+Enter para nueva linea</p>
          </div>
        </div>
      )}

      <ContactSheet open={sheetOpen} onClose={() => setSheetOpen(false)} contact={editingContact} onSave={handleSave} />
      <ScrapePanel open={scrapeOpen} onClose={() => setScrapeOpen(false)} onImport={handleImport} />
    </div>
  );
}
