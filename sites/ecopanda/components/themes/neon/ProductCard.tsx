"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCart } from "@/components/CartContext";

interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  compare_price?: number | null;
  images: string[];
  description?: string | null;
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const img = product.images?.[0] || "/placeholder.png";
  const hasDiscount = product.compare_price && product.compare_price > product.price;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    addItem({ id: product.id, name: product.name, price: product.price, image: img, slug: product.slug });
  }

  return (
    <Link href={`/producto/${product.slug}`} className="group block bg-gray-900 rounded-2xl overflow-hidden border border-white/5 neon-card hover:border-white/20 transition-all">
      <div className="relative aspect-square overflow-hidden">
        <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {hasDiscount && (
          <span className="absolute top-3 left-3 text-[10px] font-bold text-gray-950 px-2.5 py-1 rounded-full neon-glow" style={{ background: "var(--color-accent)" }}>
            -{Math.round((1 - product.price / product.compare_price!) * 100)}%
          </span>
        )}
        <button onClick={handleAdd} className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-gray-950 font-bold opacity-0 group-hover:opacity-100 transition-all neon-glow" style={{ background: "var(--color-accent)" }} title="Agregar">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white truncate mb-2">{product.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold" style={{ color: "var(--color-accent)" }}>${product.price.toLocaleString("es-AR")}</span>
          {hasDiscount && <span className="text-xs text-gray-600 line-through">${product.compare_price!.toLocaleString("es-AR")}</span>}
        </div>
      </div>
    </Link>
  );
}
