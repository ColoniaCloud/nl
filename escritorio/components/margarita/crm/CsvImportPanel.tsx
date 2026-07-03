"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  X, Download, Upload, Loader2, FileText, CheckCircle2, AlertCircle,
} from "lucide-react";

type ImportContact = {
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  optin: number;
  fecha_contactado: string | null;
  pais: string | null;
  ciudad: string | null;
  direccion: string | null;
  etiquetas: string[];
  notas: string | null;
  source: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  // Se llama una vez al terminar la importacion para refrescar la tabla.
  onComplete: () => Promise<void> | void;
};

// Tamano de lote enviado al backend en cada request.
const BATCH_SIZE = 500;
// Maximo total de contactos por archivo.
const MAX_CONTACTS = 5000;
// Maximo tamano de archivo aceptado (evita congelar el tab parseando CSVs enormes).
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Columnas esperadas en el CSV (en este orden para la plantilla)
const COLUMNS = [
  "nombre",
  "empresa",
  "email",
  "telefono",
  "pais",
  "ciudad",
  "direccion",
  "optin",
  "fecha_contactado",
  "etiquetas",
  "notas",
] as const;

const TEMPLATE_ROWS = [
  [
    "Juan Perez",
    "Cafe Central",
    "juan@cafecentral.com",
    "+54 9 11 1234 5678",
    "Argentina",
    "Buenos Aires",
    "Av. Corrientes 1234",
    "si",
    "2026-06-18",
    "gastronomia; prospecto",
    "Interesado en menu digital",
  ],
  [
    "Maria Gomez",
    "Boutique Maria",
    "maria@boutique.com",
    "+54 9 351 765 4321",
    "Argentina",
    "Cordoba",
    "",
    "no",
    "",
    "moda",
    "",
  ],
];

// Escapa un valor para CSV (comillas dobles si contiene coma, comilla o salto)
function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Parser de CSV que respeta comillas dobles y saltos de linea dentro de campos
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalizar saltos de linea
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  // Ultimo campo / fila
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const TRUE_VALUES = new Set(["si", "sí", "yes", "true", "1", "x", "y"]);

export function CsvImportPanel({ open, onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  function reset() {
    setFileName(null);
    setParsed([]);
    setError(null);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate() {
    const lines = [
      COLUMNS.join(","),
      ...TEMPLATE_ROWS.map((r) => r.map(csvEscape).join(",")),
    ];
    // BOM para que Excel reconozca UTF-8
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-contactos-margarita.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setParsed([]);
    setFileName(file.name);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El maximo permitido es ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`);
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
      if (rows.length < 2) {
        setError("El archivo no tiene filas de datos. Usa la plantilla como referencia.");
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const nombreIdx = idx("nombre");
      if (nombreIdx === -1) {
        setError('Falta la columna "nombre" en el encabezado. Descarga la plantilla para ver el formato correcto.');
        return;
      }

      const get = (row: string[], name: string): string => {
        const i = idx(name);
        return i === -1 ? "" : (row[i] ?? "").trim();
      };

      const contacts: ImportContact[] = [];
      let invalidEmails = 0;
      let invalidDates = 0;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const nombre = (row[nombreIdx] ?? "").trim();
        if (!nombre) continue;
        const etiquetasRaw = get(row, "etiquetas");
        const etiquetas = etiquetasRaw
          ? etiquetasRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean)
          : [];

        const rawEmail = get(row, "email");
        const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;
        if (rawEmail && !email) invalidEmails++;

        const rawDate = get(row, "fecha_contactado");
        const fecha_contactado = rawDate && ISO_DATE_RE.test(rawDate) ? rawDate : null;
        if (rawDate && !fecha_contactado) invalidDates++;

        contacts.push({
          nombre,
          empresa: get(row, "empresa") || null,
          email,
          telefono: get(row, "telefono") || null,
          pais: get(row, "pais") || null,
          ciudad: get(row, "ciudad") || null,
          direccion: get(row, "direccion") || null,
          optin: TRUE_VALUES.has(get(row, "optin").toLowerCase()) ? 1 : 0,
          fecha_contactado,
          etiquetas,
          notas: get(row, "notas") || null,
          source: "csv",
        });
      }

      if (contacts.length === 0) {
        setError("No se encontraron contactos validos (cada fila necesita un nombre).");
        return;
      }
      const notices: string[] = [];
      if (contacts.length > MAX_CONTACTS) {
        notices.push(`El archivo tiene ${contacts.length} contactos. Se importaran los primeros ${MAX_CONTACTS}.`);
      }
      if (invalidEmails > 0) {
        notices.push(`${invalidEmails} email(s) con formato invalido fueron omitidos.`);
      }
      if (invalidDates > 0) {
        notices.push(`${invalidDates} fecha(s) de contacto invalidas (formato esperado AAAA-MM-DD) fueron omitidas.`);
      }
      if (notices.length > 0) setError(notices.join(" "));
      setParsed(contacts.slice(0, MAX_CONTACTS));
    } catch (e: any) {
      setError(e?.message || "No se pudo leer el archivo.");
    }
  }

  async function handleImport() {
    if (parsed.length === 0) return;
    setImporting(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const total = parsed.length;
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = parsed.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/margarita/crm/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: batch }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error al importar (lote ${Math.floor(i / BATCH_SIZE) + 1})`);
        }
        const data = await res.json();
        imported += data.imported ?? 0;
        skipped += data.skipped ?? 0;
        setProgress(Math.round(Math.min(i + BATCH_SIZE, total) / total * 100));
      }
      setResult({ imported, skipped });
      setParsed([]);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      await onComplete();
    } catch (e: any) {
      setError(e?.message || "Error al importar los contactos.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col outline-none">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-100">
                Importar contactos desde CSV
              </Dialog.Title>
              <p className="text-xs text-zinc-500 mt-0.5">
                Carga un archivo CSV con tus contactos · Hasta 5000 por archivo
              </p>
            </div>
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-zinc-100 transition-colors rounded-md p-1 hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5 space-y-4 overflow-y-auto">

            {/* Plantilla */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-start gap-3">
              <FileText className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">Plantilla de ejemplo</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Descarga la plantilla para ver las columnas que el sistema acepta.
                  La unica columna obligatoria es <span className="text-zinc-300 font-medium">nombre</span>.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-emerald-700/60 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 transition-colors"
                >
                  <Download className="size-3.5" /> Descargar plantilla CSV
                </button>
              </div>
            </div>

            {/* Carga de archivo */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-zinc-700 hover:border-emerald-600/60 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors px-4 py-6 flex flex-col items-center gap-2 text-center"
              >
                <Upload className="size-5 text-zinc-400" />
                <span className="text-sm text-zinc-300">
                  {fileName ? fileName : "Selecciona un archivo CSV"}
                </span>
                <span className="text-xs text-zinc-500">
                  {fileName ? "Click para elegir otro archivo" : "o arrastra el archivo aqui"}
                </span>
              </button>
            </div>

            {/* Errores */}
            {error && (
              <div className="rounded-md bg-red-950/40 border border-red-800/40 px-3 py-2 flex items-start gap-2 text-xs text-red-300">
                <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Resultado */}
            {result && (
              <div className="rounded-md bg-emerald-950/40 border border-emerald-800/40 px-3 py-2 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="size-3.5 flex-shrink-0" />
                <span>
                  {result.imported} contacto(s) importado(s) correctamente
                  {result.skipped > 0 && ` · ${result.skipped} omitido(s)`}.
                </span>
              </div>
            )}

            {/* Progreso */}
            {importing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Importando contactos...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Preview */}
            {parsed.length > 0 && (
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-medium">
                    {parsed.length} contacto(s) listos para importar
                  </span>
                  {parsed.length > 100 && (
                    <span className="text-2xs text-zinc-500">Mostrando primeros 100</span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/60">
                  {parsed.slice(0, 100).map((c, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-2">
                      <span className="text-sm text-zinc-200 truncate flex-1">{c.nombre}</span>
                      {c.empresa && <span className="text-xs text-zinc-500 truncate max-w-[40%]">{c.empresa}</span>}
                      {c.email && <span className="text-xs text-zinc-600 truncate max-w-[40%]">{c.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} className="text-zinc-400 hover:text-zinc-100">
              Cerrar
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsed.length === 0 || importing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {importing
                ? <><Loader2 className="size-4 animate-spin mr-2" /> Importando...</>
                : <><Download className="size-4 mr-2" /> Importar {parsed.length > 0 ? parsed.length : ""}</>}
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
