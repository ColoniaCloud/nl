"use client";
import { useState } from "react";
import { useCart } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import { CartProvider } from "@/components/CartContext";
import BankTransferInfo from "@/components/payment/BankTransferInfo";
import MercadoPagoButton from "@/components/payment/MercadoPagoButton";
import CoinbaseButton from "@/components/payment/CoinbaseButton";
import { Loader2, ArrowLeft, CreditCard, Building2, CircleDollarSign } from "lucide-react";
import Link from "next/link";
import { getConfig, getApiBase } from "@/lib/config";

function CheckoutForm() {
  const { items, total, clearCart } = useCart();
  const cfg = getConfig();
  const apiBase = getApiBase(cfg);
  const { payments } = cfg;

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [payMethod, setPayMethod] = useState<string>(() => {
    if (payments.mercadopago.enabled) return "mercadopago";
    if (payments.bankTransfer.enabled) return "bank_transfer";
    if (payments.coinbase.enabled) return "coinbase";
    return "bank_transfer";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Tu carrito esta vacio.</p>
        <Link href="/productos" className="mt-4 inline-block text-sm underline" style={{ color: "var(--color-primary)" }}>Ver productos</Link>
      </div>
    );
  }

  async function createOrder() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          shipping_address: form.address,
          notes: form.notes,
          payment_method: payMethod,
          items: items.map((i) => ({ product_id: i.id, product_name: i.name, product_price: i.price, quantity: i.quantity })),
          subtotal: total,
          total,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la orden");
      return data.order_number as string;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!form.name || !form.email) { setError("Nombre y email son obligatorios."); return; }
    if (payMethod === "bank_transfer") {
      const num = await createOrder();
      if (num) {
        clearCart();
        window.location.href = `/confirmacion?order=${num}&status=pending`;
      }
    } else {
      const num = await createOrder();
      if (num) setOrderNumber(num);
    }
  }

  const enabledMethods = [
    payments.mercadopago.enabled && { id: "mercadopago", label: "MercadoPago", icon: CreditCard },
    payments.bankTransfer.enabled && { id: "bank_transfer", label: "Transferencia bancaria", icon: Building2 },
    payments.coinbase.enabled && { id: "coinbase", label: "Cripto (Coinbase)", icon: CircleDollarSign },
  ].filter(Boolean) as Array<{ id: string; label: string; icon: any }>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Form */}
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Tus datos</h2>
          <div className="space-y-4">
            {[
              { key: "name", label: "Nombre completo *", type: "text" },
              { key: "email", label: "Email *", type: "email" },
              { key: "phone", label: "Telefono", type: "tel" },
              { key: "address", label: "Direccion de envio", type: "text" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-shadow"
                  style={{ "--tw-ring-color": "var(--color-primary)" } as any}
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Metodo de pago</h2>
          <div className="space-y-2">
            {enabledMethods.map((m) => (
              <button
                key={m.id}
                onClick={() => setPayMethod(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                  payMethod === m.id ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <m.icon className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                <span className="font-medium text-gray-800">{m.label}</span>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 ${payMethod === m.id ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-gray-300"}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order summary + payment action */}
      <div className="space-y-6">
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Tu pedido</h2>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-gray-700">
                <span>{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                <span>${(item.price * item.quantity).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>${total.toLocaleString("es-AR")}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

        {/* Payment actions */}
        {!orderNumber ? (
          <div>
            {payMethod === "bank_transfer" && (
              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-white text-lg disabled:opacity-60"
                style={{ background: "var(--color-primary)" }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? "Procesando..." : "Confirmar pedido"}
              </button>
            )}
            {(payMethod === "mercadopago" || payMethod === "coinbase") && (
              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-white text-lg disabled:opacity-60"
                style={{ background: "var(--color-secondary)" }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? "Creando orden..." : "Continuar con el pago"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {payMethod === "bank_transfer" && payments.bankTransfer.details && (
              <BankTransferInfo details={payments.bankTransfer.details} amount={total} />
            )}
            {payMethod === "mercadopago" && payments.mercadopago.publicKey && (
              <MercadoPagoButton apiBase={apiBase} orderNumber={orderNumber} amount={total} publicKey={payments.mercadopago.publicKey} />
            )}
            {payMethod === "coinbase" && (
              <CoinbaseButton apiBase={apiBase} orderNumber={orderNumber} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const cfg = getConfig();
  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al carrito
        </Link>
        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-10">Checkout</h1>
        <CheckoutForm />
      </main>
    </CartProvider>
  );
}
