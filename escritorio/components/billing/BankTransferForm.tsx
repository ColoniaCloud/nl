"use client";

import { useState, useRef } from "react";
import { Upload, FileCheck, Loader2 } from "lucide-react";
import type { PlanConfig, BillingCycle } from "@/lib/billing-plans";

interface BankTransferFormProps {
  plan: PlanConfig;
  cycle: BillingCycle;
  username: string;
  onSuccess: () => void;
}

export default function BankTransferForm({
  plan,
  cycle,
  username,
  onSuccess,
}: BankTransferFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const price = cycle === "annual" ? plan.annualUsd : plan.monthlyUsd;
  const reference = username ? `NL360-${username.toUpperCase()}` : "—";

  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "Ver instrucciones";
  const bankAccount = process.env.NEXT_PUBLIC_BANK_ACCOUNT || "—";
  const bankHolder = process.env.NEXT_PUBLIC_BANK_HOLDER || "NL360";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("planId", plan.id);
    form.append("billingCycle", cycle);
    form.append("receipt", file);

    try {
      const res = await fetch("/api/billing/checkout/bank", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Error al enviar comprobante.");
      } else {
        onSuccess();
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Bank details */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4 space-y-2 text-sm">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Datos bancarios
        </p>
        <div className="flex justify-between">
          <span className="text-zinc-500">Banco</span>
          <span className="text-zinc-200">{bankName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Titular</span>
          <span className="text-zinc-200">{bankHolder}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Cuenta / IBAN</span>
          <span className="text-zinc-200 font-mono text-xs">{bankAccount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Referencia</span>
          <code className="text-violet-300 font-mono text-xs bg-violet-500/10 px-2 py-0.5 rounded">
            {reference}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Monto a transferir</span>
          <span className="text-white font-semibold">${price} USD</span>
        </div>
        <p className="text-xs text-zinc-500 pt-1">
          Incluye exactamente la referencia en el concepto de la transferencia.
        </p>
      </div>

      {/* Receipt upload */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Comprobante de pago
        </p>
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border border-dashed border-white/[0.12] bg-zinc-900/30 p-6 text-center hover:border-violet-500/40 transition-colors"
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
              <FileCheck className="size-4" />
              <span className="truncate max-w-[200px]">{file.name}</span>
            </div>
          ) : (
            <>
              <Upload className="size-5 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">
                Haz click para subir el comprobante
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                JPG, PNG, WEBP o PDF — max 10 MB
              </p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        className="w-full rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Enviar comprobante
      </button>
    </form>
  );
}
