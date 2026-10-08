"use client";
import Link from "next/link";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartContext";

export default function Navbar({ storeName }: { storeName: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#faf9f7]/95 backdrop-blur-md border-b border-stone-200/60">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <div className="w-24" />
          <Link
            href="/"
            className="font-heading text-2xl font-bold tracking-tight"
            style={{ color: "var(--color-primary)" }}
          >
            {storeName}
          </Link>
          <div className="w-24 flex justify-end items-center gap-2">
            <Link href="/cart" className="relative p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ShoppingBag className="w-5 h-5 text-stone-600" />
              {count > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: "var(--color-accent)" }}
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
            <button onClick={() => setOpen(!open)} className="md:hidden p-2">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center gap-10 pb-4 text-[13px] font-medium uppercase tracking-widest text-stone-500">
          <Link href="/" className="boutique-link hover:text-stone-900 transition-colors">Inicio</Link>
          <Link href="/productos" className="boutique-link hover:text-stone-900 transition-colors">Coleccion</Link>
          <Link href="#contacto" className="boutique-link hover:text-stone-900 transition-colors">Contacto</Link>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-[#faf9f7] border-t border-stone-200 px-6 pb-6 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700 border-b border-stone-100">Inicio</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700 border-b border-stone-100">Coleccion</Link>
          <Link href="#contacto" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-stone-700">Contacto</Link>
        </div>
      )}
    </nav>
  );
}
