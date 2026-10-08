"use client";
import Link from "next/link";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartContext";

export default function Navbar({ storeName }: { storeName: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <Link href="/" className="font-heading text-lg font-bold text-gray-900 tracking-tight">{storeName}</Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-gray-900 transition-colors">Inicio</Link>
          <Link href="/productos" className="hover:text-gray-900 transition-colors">Productos</Link>
          <Link href="#contacto" className="hover:text-gray-900 transition-colors">Contacto</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ShoppingBag className="w-5 h-5 text-gray-700" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: "var(--color-primary)" }}>
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 pb-4 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-700 hover:text-gray-900">Inicio</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-700 hover:text-gray-900">Productos</Link>
          <Link href="#contacto" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-700 hover:text-gray-900">Contacto</Link>
        </div>
      )}
    </nav>
  );
}
