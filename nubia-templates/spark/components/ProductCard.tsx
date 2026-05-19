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
    <Link href={`/producto/${product.slug}`} className="group block spark-card bg-white rounded-xl overflow-hidden border border-slate-100 hover:border-slate-300">
      {/* Image — square, clean */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        <img
          src={img}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {hasDiscount && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-bold text-white px-2.5 py-1 rounded-md" style={{ background: "var(--color-accent)" }}>
            -{Math.round((1 - product.price / product.compare_price!) * 100)}%
          </span>
        )}
      </div>
      {/* Info — modern, tight */}
      <div className="p-4">
        <h3 className="font-heading text-sm font-bold text-slate-900 truncate mb-2 tracking-tight">
          {product.name}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-base font-bold text-slate-900">
              ${product.price.toLocaleString("es-AR")}
            </span>
            {hasDiscount && (
              <span className="text-xs text-slate-400 line-through">
                ${product.compare_price!.toLocaleString("es-AR")}
              </span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
            style={{ background: "var(--color-primary)" }}
            title="Agregar al carrito"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Link>
  );
}
