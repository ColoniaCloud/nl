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
    <Link href={`/producto/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100 mb-4">
        <img src={img} alt={product.name} className="w-full h-full object-cover boutique-img-zoom" />
        {hasDiscount && (
          <span className="absolute top-3 left-3 text-[11px] font-semibold text-white px-3 py-1 tracking-wide uppercase" style={{ background: "var(--color-accent)" }}>
            -{Math.round((1 - product.price / product.compare_price!) * 100)}%
          </span>
        )}
        <button onClick={handleAdd} className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:scale-110" style={{ color: "var(--color-primary)" }} title="Agregar al carrito">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-1">
        <h3 className="font-heading text-base font-semibold text-stone-900 group-hover:text-[var(--color-primary)] transition-colors">{product.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-700">${product.price.toLocaleString("es-AR")}</span>
          {hasDiscount && <span className="text-xs text-stone-400 line-through">${product.compare_price!.toLocaleString("es-AR")}</span>}
        </div>
      </div>
    </Link>
  );
}
