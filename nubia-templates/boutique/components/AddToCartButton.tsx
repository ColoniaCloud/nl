"use client";
import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "./CartContext";
import Link from "next/link";

interface Props {
  product: { id: number; name: string; price: number; image: string; slug: string };
}

export default function AddToCartButton({ product }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleAdd}
        className="flex items-center justify-center gap-3 py-4 px-8 rounded-xl font-semibold text-white text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: added ? "#22c55e" : "var(--color-primary)" }}
      >
        {added ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
        {added ? "Agregado al carrito" : "Agregar al carrito"}
      </button>
      <Link
        href="/checkout"
        className="flex items-center justify-center gap-2 py-4 px-8 rounded-xl font-semibold border-2 text-gray-700 hover:bg-gray-50 transition-colors text-lg"
        style={{ borderColor: "var(--color-secondary)" }}
        onClick={() => addItem(product)}
      >
        Comprar ahora
      </Link>
    </div>
  );
}
