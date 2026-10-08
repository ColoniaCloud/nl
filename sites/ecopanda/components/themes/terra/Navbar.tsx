"use client";
import Link from "next/link";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartContext";

export default function Navbar({ storeName }: { storeName: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-amber-50/95 backdrop-blur-xl border-b border-amber-200/60">
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-14">
        <Link href="/" className="font-heading text-lg font-bold text-amber-950 tracking-tight">{storeName}</Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-amber-800">
          <Link href="/" className="hover:text-amber-950 transition-colors">Inicio</Link>
          <Link href="/productos" className="hover:text-amber-950 transition-colors">Productos</Link>
          <Link href="#contacto" className="hover:text-amber-950 transition-colors">Contacto</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative p-2 text-amber-800 hover:text-amber-950 transition-colors">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: "var(--color-primary)" }}>
                {count}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-amber-800">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-amber-50 border-t border-amber-200/60 px-5 pb-4 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-amber-800 hover:text-amber-950">Inicio</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-amber-800 hover:text-amber-950">Productos</Link>
          <Link href="#contacto" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-amber-800 hover:text-amber-950">Contacto</Link>
        </div>
      )}
    </nav>
  );
}
