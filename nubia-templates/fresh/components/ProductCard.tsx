"use client";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartContext";

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
    <Link href={`/producto/${product.slug}`} className="group block fresh-card bg-white rounded-3xl overflow-hidden border border-stone-100">
      {/* Image — square with rounded corners */}
      <div className="relative aspect-square overflow-hidden bg-amber-50/50">
        <img
          src={img}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        {hasDiscount && (
          <span className="fresh-badge absolute top-3 left-3 text-white" style={{ background: "var(--color-accent)" }}>
            -{Math.round((1 - product.price / product.compare_price!) * 100)}% off
          </span>
        )}
      </div>
      {/* Info — warm, friendly */}
      <div className="p-5">
        <h3 className="font-heading text-base font-semibold text-stone-800 mb-1 line-clamp-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">{product.description}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-stone-900">
              ${product.price.toLocaleString("es-AR")}
            </span>
            {hasDiscount && (
              <span className="text-xs text-stone-400 line-through">
                ${product.compare_price!.toLocaleString("es-AR")}
              </span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--color-primary)" }}
            title="Agregar"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </div>
    </Link>
  );
}
