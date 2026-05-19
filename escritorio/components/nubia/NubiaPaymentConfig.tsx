"use client";
import { useState, useEffect } from "react";
import { Loader2, Save, Eye, EyeOff, CheckCircle, Landmark, CreditCard, Bitcoin, HelpCircle, X, ExternalLink } from "lucide-react";

interface PayConfig {
  bank_transfer_enabled: number;
  bank_transfer_details: string | null;
  mercadopago_enabled: number;
  mercadopago_access_token: string | null;
  mercadopago_public_key: string | null;
  mercadopago_country: string | null;
  mercadopago_currency: string | null;
  coinbase_enabled: number;
  coinbase_api_key: string | null;
  coinbase_webhook_secret: string | null;
}

// Campos que el servidor devuelve enmascarados
type MaskedField = "mercadopago_access_token" | "coinbase_api_key" | "coinbase_webhook_secret";
const MASKED_FIELDS: MaskedField[] = ["mercadopago_access_token", "coinbase_api_key", "coinbase_webhook_secret"];

const COUNTRIES = [
  { code: "AR", label: "Argentina (ARS)", currency: "ARS" },
  { code: "MX", label: "Mexico (MXN)", currency: "MXN" },
  { code: "CO", label: "Colombia (COP)", currency: "COP" },
  { code: "CL", label: "Chile (CLP)", currency: "CLP" },
  { code: "BR", label: "Brasil (BRL)", currency: "BRL" },
  { code: "UY", label: "Uruguay (UYU)", currency: "UYU" },
  { code: "PE", label: "Peru (PEN)", currency: "PEN" },
];

function isMasked(val: string | null | undefined) {
  return typeof val === "string" && val.startsWith("***");
}

export default function NubiaPaymentConfig({ projectId }: { projectId: number }) {
  const [config, setConfig] = useState<Partial<PayConfig>>({});
  const [bankDetails, setBankDetails] = useState({ bank: "", account: "", cbu: "", alias: "", holder: "" });
  // Tracks which masked fields have been configured (server-side) vs overridden by user
  const [configuredFields, setConfiguredFields] = useState<Set<MaskedField>>(new Set());
  // New values typed by user for masked fields (empty = don't overwrite)
  const [newSecrets, setNewSecrets] = useState<Partial<Record<MaskedField, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/nubia/payment-config?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        const cfg = d.config ?? {};
        setConfig(cfg);
        if (cfg.bank_transfer_details) {
          try { setBankDetails(JSON.parse(cfg.bank_transfer_details)); } catch { /* ignore */ }
        }
        // Mark which secret fields are already configured (server returned a masked value)
        const configured = new Set<MaskedField>();
        for (const field of MASKED_FIELDS) {
          if (isMasked(cfg[field])) configured.add(field);
        }
        setConfiguredFields(configured);
        setLoading(false);
      });
  }, [projectId]);

  async function save() {
    setSaving(true);
    // Build payload: include new secrets only if user typed something; omit masked server values
    const payload: any = {
      project_id: projectId,
      bank_transfer_enabled: config.bank_transfer_enabled,
      bank_transfer_details: JSON.stringify(bankDetails),
      mercadopago_enabled: config.mercadopago_enabled,
      mercadopago_public_key: config.mercadopago_public_key,
      mercadopago_country: config.mercadopago_country,
      mercadopago_currency: config.mercadopago_currency,
      coinbase_enabled: config.coinbase_enabled,
    };
    // Only include secret fields if the user entered a new value
    for (const field of MASKED_FIELDS) {
      const newVal = newSecrets[field];
      if (newVal && newVal.trim()) {
        payload[field] = newVal.trim();
      }
      // If user left it empty and it was configured, don't send — API preserves existing
    }

    await fetch("/api/nubia/payment-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // After save, any field that had a new secret is now "configured"
    const updated = new Set(configuredFields);
    for (const field of MASKED_FIELDS) {
      if (newSecrets[field]?.trim()) updated.add(field);
    }
    setConfiguredFields(updated);
    setNewSecrets({});

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const [helpModal, setHelpModal] = useState<"mercadopago" | "coinbase" | null>(null);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Metodos de pago</h2>

      {/* Bank Transfer */}
      <Section
        title="Transferencia bancaria"
        icon={<Landmark className="w-5 h-5" />}
        enabled={Boolean(config.bank_transfer_enabled)}
        onToggle={(v) => setConfig((p) => ({ ...p, bank_transfer_enabled: v ? 1 : 0 }))}
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "holder", label: "Titular" },
            { key: "bank", label: "Banco" },
            { key: "account", label: "Numero de cuenta" },
            { key: "cbu", label: "CBU / CCI / CLABE" },
            { key: "alias", label: "Alias" },
          ].map(({ key, label }) => (
            <div key={key} className={key === "cbu" ? "col-span-2" : ""}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input
                value={(bankDetails as any)[key]}
                onChange={(e) => setBankDetails((p) => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* MercadoPago */}
      <Section
        title="MercadoPago"
        icon={<CreditCard className="w-5 h-5" />}
        enabled={Boolean(config.mercadopago_enabled)}
        onToggle={(v) => setConfig((p) => ({ ...p, mercadopago_enabled: v ? 1 : 0 }))}
        onHelp={() => setHelpModal("mercadopago")}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Pais</label>
            <select
              value={config.mercadopago_country ?? "AR"}
              onChange={(e) => {
                const country = COUNTRIES.find((c) => c.code === e.target.value);
                setConfig((p) => ({ ...p, mercadopago_country: e.target.value, mercadopago_currency: country?.currency }));
              }}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500"
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <SecretField
            label="Access Token (privado)"
            fieldKey="mercadopago_access_token"
            isConfigured={configuredFields.has("mercadopago_access_token")}
            newValue={newSecrets.mercadopago_access_token || ""}
            show={showTokens.mp_at}
            onToggleShow={() => setShowTokens((p) => ({ ...p, mp_at: !p.mp_at }))}
            onChange={(v) => setNewSecrets((p) => ({ ...p, mercadopago_access_token: v }))}
            placeholder="APP_USR-..."
          />
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Public Key</label>
            <input
              value={config.mercadopago_public_key || ""}
              onChange={(e) => setConfig((p) => ({ ...p, mercadopago_public_key: e.target.value }))}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-emerald-500"
              placeholder="APP_USR-..."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Las notificaciones IPN se reciben automaticamente en tu tienda.
          </p>
        </div>
      </Section>

      {/* Coinbase */}
      <Section
        title="Coinbase Commerce (Cripto)"
        icon={<Bitcoin className="w-5 h-5" />}
        enabled={Boolean(config.coinbase_enabled)}
        onToggle={(v) => setConfig((p) => ({ ...p, coinbase_enabled: v ? 1 : 0 }))}
        onHelp={() => setHelpModal("coinbase")}
      >
        <div className="space-y-3">
          <SecretField
            label="API Key"
            fieldKey="coinbase_api_key"
            isConfigured={configuredFields.has("coinbase_api_key")}
            newValue={newSecrets.coinbase_api_key || ""}
            show={showTokens.cb_api}
            onToggleShow={() => setShowTokens((p) => ({ ...p, cb_api: !p.cb_api }))}
            onChange={(v) => setNewSecrets((p) => ({ ...p, coinbase_api_key: v }))}
            placeholder="Tu Coinbase Commerce API Key"
          />
          <SecretField
            label="Webhook Secret"
            fieldKey="coinbase_webhook_secret"
            isConfigured={configuredFields.has("coinbase_webhook_secret")}
            newValue={newSecrets.coinbase_webhook_secret || ""}
            show={showTokens.cb_wh}
            onToggleShow={() => setShowTokens((p) => ({ ...p, cb_wh: !p.cb_wh }))}
            onChange={(v) => setNewSecrets((p) => ({ ...p, coinbase_webhook_secret: v }))}
            placeholder="Shared Webhook Secret de Coinbase"
          />
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Webhook URL para Coinbase:</p>
            <code className="text-xs text-emerald-400 break-all">
              https://nl360.site/api/nubia/storefront/[tu-subdominio]/payment/webhook/coinbase
            </code>
          </div>
        </div>
      </Section>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "Guardado!" : "Guardar configuracion"}
      </button>

      {/* Help Modals */}
      {helpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {helpModal === "mercadopago" ? "Como obtener las credenciales de MercadoPago" : "Como obtener las credenciales de Coinbase Commerce"}
              </h3>
              <button onClick={() => setHelpModal(null)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
            </div>

            {helpModal === "mercadopago" && (
              <div className="space-y-3 text-sm text-zinc-300">
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 1: Crear una aplicacion</p>
                  <p>Ingresa a <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-1">MercadoPago Developers <ExternalLink className="w-3 h-3" /></a> e inicia sesion con tu cuenta.</p>
                  <p>Haz clic en <strong className="text-zinc-100">Crear aplicacion</strong>.</p>
                  <p>Selecciona <strong className="text-zinc-100">Pagos online</strong> como tipo de producto y marca <strong className="text-zinc-100">CheckoutPro</strong>.</p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 2: Obtener credenciales de produccion</p>
                  <p>Una vez creada la aplicacion, ve a <strong className="text-zinc-100">Credenciales de produccion</strong>.</p>
                  <p>Copia el <strong className="text-zinc-100">Access Token</strong> (empieza con <code className="text-xs bg-zinc-700 px-1 rounded">APP_USR-</code>) y pegalo en el campo correspondiente.</p>
                  <p>Copia la <strong className="text-zinc-100">Public Key</strong> (tambien empieza con <code className="text-xs bg-zinc-700 px-1 rounded">APP_USR-</code>).</p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 3: Seleccionar tu pais</p>
                  <p>Asegurate de seleccionar el pais correcto en el selector de arriba. Esto determina la moneda de cobro.</p>
                </div>
                <div className="rounded-lg bg-amber-900/30 border border-amber-700/50 p-3">
                  <p className="text-amber-400 text-xs font-medium">Importante: Usa las credenciales de <strong>produccion</strong>, no las de prueba/sandbox, para que los cobros sean reales.</p>
                </div>
              </div>
            )}

            {helpModal === "coinbase" && (
              <div className="space-y-3 text-sm text-zinc-300">
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 1: Crear cuenta en Coinbase Commerce</p>
                  <p>Ingresa a <a href="https://commerce.coinbase.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-1">Coinbase Commerce <ExternalLink className="w-3 h-3" /></a> y crea una cuenta o inicia sesion.</p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 2: Obtener API Key</p>
                  <p>Ve a <strong className="text-zinc-100">Settings &gt; API Keys</strong>.</p>
                  <p>Haz clic en <strong className="text-zinc-100">Create an API Key</strong>.</p>
                  <p>Copia la clave generada y pegala en el campo <strong className="text-zinc-100">API Key</strong>.</p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Paso 3: Configurar Webhook</p>
                  <p>En <strong className="text-zinc-100">Settings &gt; Webhook subscriptions</strong>, haz clic en <strong className="text-zinc-100">Add an endpoint</strong>.</p>
                  <p>Pega esta URL como endpoint:</p>
                  <code className="block text-xs bg-zinc-700 rounded px-2 py-1 text-emerald-400 break-all">
                    https://nl360.site/api/nubia/storefront/TU-SUBDOMINIO/payment/webhook/coinbase
                  </code>
                  <p>Copia el <strong className="text-zinc-100">Shared Secret</strong> que genera Coinbase y pegalo en el campo <strong className="text-zinc-100">Webhook Secret</strong>.</p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                  <p className="font-medium text-emerald-400">Criptomonedas soportadas</p>
                  <p>Tu tienda podra recibir pagos en Bitcoin, Ethereum, USDC, DAI y otras criptomonedas soportadas por Coinbase Commerce.</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setHelpModal(null)}
              className="w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, enabled, onToggle, onHelp, children }: {
  title: string; icon: React.ReactNode; enabled: boolean;
  onToggle: (v: boolean) => void; onHelp?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggle(!enabled)}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <span className="text-muted-foreground">{icon}</span>
          <span className="flex-1 font-medium text-foreground">{title}</span>
          <div className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? "bg-emerald-600" : "bg-muted"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </button>
        {onHelp && (
          <button onClick={onHelp} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-400 transition-colors" title="Como obtener las credenciales">
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>
      {enabled && (
        <div className="border-t border-border p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function SecretField({ label, fieldKey, isConfigured, newValue, show, onToggleShow, onChange, placeholder }: {
  label: string;
  fieldKey: string;
  isConfigured: boolean;
  newValue: string;
  show: boolean;
  onToggleShow: () => void;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {isConfigured && !newValue && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="w-3 h-3" />
            Configurado
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={newValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isConfigured ? "Dejar vacio para mantener el actual" : placeholder}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 pr-10 text-sm text-foreground font-mono focus:outline-none focus:border-emerald-500 placeholder:text-muted-foreground/50"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
