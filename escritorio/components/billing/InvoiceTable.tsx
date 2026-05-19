"use client";

import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  gateway: "coinbase" | "bank" | "manual";
  amount_usd: number;
  currency: string;
  status: "open" | "paid" | "void";
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface InvoiceTableProps {
  invoices: Invoice[];
}

const GATEWAY_LABELS: Record<string, string> = {
  coinbase: "Coinbase",
  bank: "Transferencia",
  manual: "Manual",
};

const STATUS_STYLES: Record<string, string> = {
  paid: "text-emerald-400 bg-emerald-400/10",
  open: "text-amber-400 bg-amber-400/10",
  void: "text-zinc-500 bg-zinc-500/10",
};

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-6">
        Sin facturas aun.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="pb-2 text-left text-xs text-zinc-500 font-medium">Fecha</th>
            <th className="pb-2 text-left text-xs text-zinc-500 font-medium">Metodo</th>
            <th className="pb-2 text-left text-xs text-zinc-500 font-medium">Periodo</th>
            <th className="pb-2 text-right text-xs text-zinc-500 font-medium">Monto</th>
            <th className="pb-2 text-right text-xs text-zinc-500 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="py-2.5 text-zinc-300">{fmt(inv.created_at)}</td>
              <td className="py-2.5 text-zinc-400">{GATEWAY_LABELS[inv.gateway] || inv.gateway}</td>
              <td className="py-2.5 text-zinc-400">
                {inv.period_start && inv.period_end
                  ? `${fmt(inv.period_start)} – ${fmt(inv.period_end)}`
                  : "—"}
              </td>
              <td className="py-2.5 text-right text-zinc-200 font-mono">
                ${inv.amount_usd.toFixed(2)}
              </td>
              <td className="py-2.5 text-right">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    STATUS_STYLES[inv.status]
                  )}
                >
                  {inv.status === "paid" ? "Pagado" : inv.status === "open" ? "Pendiente" : "Anulado"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
