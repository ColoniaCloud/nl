import { notFound } from "next/navigation";
import { getConfig, getApiBase } from "@/lib/config";
import { CartProvider } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AddToCartButton from "@/components/AddToCartButton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

async function getProduct(apiBase: string, slug: string) {
  try {
    const res = await fetch(`${apiBase}/product/${slug}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.product ?? null;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const cfg = getConfig();
  const apiBase = getApiBase(cfg);
  const product = await getProduct(apiBase, params.slug);
  if (!product) notFound();

  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const desc = product.description_enhanced || product.description || "";

  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/productos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
              <img
                src={product.images?.[0] || "/placeholder.png"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-3 mt-4">
                {product.images.slice(1, 4).map((img: string, i: number) => (
                  <div key={i} className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border-2 border-transparent hover:border-[var(--color-primary)] transition-colors cursor-pointer">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="font-heading text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-gray-900">${product.price.toLocaleString("es-AR")}</span>
              {hasDiscount && (
                <span className="text-lg text-gray-400 line-through">${product.compare_price.toLocaleString("es-AR")}</span>
              )}
              {hasDiscount && (
                <span className="text-sm font-bold px-2 py-1 rounded-full text-white" style={{ background: "var(--color-accent)" }}>
                  -{Math.round((1 - product.price / product.compare_price) * 100)}% OFF
                </span>
              )}
            </div>

            {desc && (
              <p className="text-gray-600 leading-relaxed mb-8 whitespace-pre-line">{desc}</p>
            )}

            {(product.stock === null || product.stock > 0) ? (
              <AddToCartButton product={{ id: product.id, name: product.name, price: product.price, image: product.images?.[0] || "/placeholder.png", slug: product.slug }} />
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                Sin stock disponible
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer storeName={cfg.storeName} contact={cfg.contact} />
    </CartProvider>
  );
}
