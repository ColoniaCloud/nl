"use client";
import Link from "next/link";
import { ShoppingBag, Menu, X, Leaf } from "lucide-react";
import { useState } from "react";
import { useCart } from "./CartContext";

export default function Navbar({ storeName }: { storeName: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#fefdfb]/95 backdrop-blur-md shadow-sm">
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-16">
        {/* Logo with leaf accent */}
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
          <span className="font-heading text-xl font-bold text-stone-800">{storeName}</span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">Inicio</Link>
          <Link href="/productos" className="hover:text-[var(--color-primary)] transition-colors">Productos</Link>
          <Link href="#contacto" className="hover:text-[var(--color-primary)] transition-colors">Contacto</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative flex items-center gap-2 px-4 py-2 rounded-full hover:bg-green-50 transition-colors"
          >
            <ShoppingBag className="w-5 h-5 text-stone-600" />
            {count > 0 && (
              <span
                className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ background: "var(--color-primary)" }}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-green-50">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#fefdfb] border-t border-green-100 px-5 pb-4 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700 hover:text-[var(--color-primary)]">Inicio</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700 hover:text-[var(--color-primary)]">Productos</Link>
          <Link href="#contacto" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700 hover:text-[var(--color-primary)]">Contacto</Link>
        </div>
      )}
    </nav>
  );
}
