"use client";
import Link from "next/link";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartContext";

export default function Navbar({ storeName }: { storeName: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-14">
        <Link href="/" className="font-heading text-lg font-extrabold tracking-tight" style={{ color: "var(--color-accent)" }}>
          {storeName}
        </Link>
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="px-4 py-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all">Inicio</Link>
          <Link href="/productos" className="px-4 py-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all">Productos</Link>
          <Link href="#contacto" className="px-4 py-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all">Contacto</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold text-gray-950 flex items-center justify-center neon-glow" style={{ background: "var(--color-accent)" }}>
                {count}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-gray-400 hover:text-white">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-gray-950 border-t border-white/5 px-5 pb-4 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-300 hover:text-white">Inicio</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-300 hover:text-white">Productos</Link>
          <Link href="#contacto" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-gray-300 hover:text-white">Contacto</Link>
        </div>
      )}
    </nav>
  );
}
