"use client";
import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Order {
  id: number;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
}

interface OrderItem {
  id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-amber-400 bg-amber-900/30" },
  confirmed: { label: "Confirmado", color: "text-blue-400 bg-blue-900/30" },
  shipped: { label: "Enviado", color: "text-cyan-400 bg-cyan-900/30" },
  delivered: { label: "Entregado", color: "text-green-400 bg-green-900/30" },
  cancelled: { label: "Cancelado", color: "text-red-400 bg-red-900/30" },
};

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pago pendiente", color: "text-amber-400" },
  paid: { label: "Pagado", color: "text-green-400" },
  failed: { label: "Fallido", color: "text-red-400" },
  refunded: { label: "Reembolsado", color: "text-zinc-400" },
};

export default function NubiaOrdersPanel({ projectId }: { projectId: number }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, OrderItem[]>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/nubia/orders?project_id=${projectId}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function loadItems(orderId: number) {
    if (items[orderId]) return;
    const res = await fetch(`/api/nubia/orders?project_id=${projectId}&order_id=${orderId}`);
    const data = await res.json();
    setItems((p) => ({ ...p, [orderId]: data.items ?? [] }));
  }

  async function toggleExpand(orderId: number) {
    if (expanded === orderId) {
      setExpanded(null);
    } else {
      setExpanded(orderId);
      await loadItems(orderId);
    }
  }

  async function updateStatus(orderId: number, newStatus: string) {
    setUpdatingStatus(orderId);
    await fetch("/api/nubia/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, project_id: projectId, status: newStatus }),
    });
    setUpdatingStatus(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Ordenes</h2>
        <span className="text-sm text-zinc-500">{orders.length} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aun no hay ordenes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const st = STATUS_LABELS[o.status] ?? { label: o.status, color: "text-zinc-400 bg-zinc-800" };
            const ps = PAY_STATUS[o.payment_status] ?? { label: o.payment_status, color: "text-zinc-400" };
            const isExpanded = expanded === o.id;

            return (
              <div key={o.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(o.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-zinc-100">{o.order_number}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", st.color)}>{st.label}</span>
                      <span className={cn("text-xs font-medium", ps.color)}>{ps.label}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {o.customer_name || "Sin nombre"} · {o.customer_email || "Sin email"} · ${Number(o.total).toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-zinc-600">{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-700/50 p-4 space-y-4">
                    {/* Items */}
                    {items[o.id] ? (
                      <div className="space-y-2">
                        {items[o.id].map((item) => (
                          <div key={item.id} className="flex justify-between text-sm text-zinc-300">
                            <span>{item.product_name} <span className="text-zinc-500">x{item.quantity}</span></span>
                            <span>${Number(item.subtotal).toLocaleString("es-AR")}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                    )}

                    {/* Status update */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Cambiar estado:</span>
                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        disabled={updatingStatus === o.id}
                        className="text-xs bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-zinc-200 focus:outline-none"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      {updatingStatus === o.id && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
