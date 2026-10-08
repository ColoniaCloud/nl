"use client";
import Link from "next/link";
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
      <div className="aspect-[3/4] overflow-hidden bg-gray-100 mb-4">
        <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
      </div>
      <h3 className="text-sm text-gray-900 mb-1 truncate">{product.name}</h3>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-900">${product.price.toLocaleString("es-AR")}</span>
        {hasDiscount && <span className="text-xs text-gray-400 line-through">${product.compare_price!.toLocaleString("es-AR")}</span>}
      </div>
      <button onClick={handleAdd} className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors">
        Agregar
      </button>
    </Link>
  );
}
