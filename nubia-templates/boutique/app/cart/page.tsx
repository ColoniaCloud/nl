"use client";
import Link from "next/link";
import { CartProvider, useCart } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { getConfig } from "@/lib/config";

function CartContent() {
  const { items, removeItem, updateQty, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="font-heading text-2xl font-bold text-gray-700 mb-2">Tu carrito esta vacio</h2>
        <p className="text-gray-500 mb-8">Agrega algunos productos para continuar</p>
        <Link href="/productos" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white" style={{ background: "var(--color-primary)" }}>
          Ver productos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
              <p className="text-gray-500 text-sm">${item.price.toLocaleString("es-AR")} c/u</p>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-semibold w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="font-bold">${(item.price * item.quantity).toLocaleString("es-AR")}</span>
              <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
        <h3 className="font-heading text-xl font-bold text-gray-900 mb-4">Resumen</h3>
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span>${total.toLocaleString("es-AR")}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-lg text-gray-900">
            <span>Total</span>
            <span>${total.toLocaleString("es-AR")}</span>
          </div>
        </div>
        <Link href="/checkout" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white" style={{ background: "var(--color-primary)" }}>
          Ir al checkout <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/productos" className="mt-3 flex items-center justify-center text-sm text-gray-500 hover:text-gray-700">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export default function CartPage() {
  const cfg = getConfig();
  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-8">Mi carrito</h1>
        <CartContent />
      </main>
    </CartProvider>
  );
}
