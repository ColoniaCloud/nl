import { getConfig, getApiBase } from "@/lib/config";
import { CartProvider } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { ShoppingBag } from "lucide-react";

async function getProducts(apiBase: string, category?: string) {
  try {
    const url = category ? `${apiBase}/products?category=${category}` : `${apiBase}/products`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return { products: [], categories: [] };
    return await res.json();
  } catch {
    return { products: [], categories: [] };
  }
}

export default async function ProductosPage({ searchParams }: { searchParams: { category?: string } }) {
  const cfg = getConfig();
  const apiBase = getApiBase(cfg);
  const { products, categories } = await getProducts(apiBase, searchParams.category);

  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="w-6 h-6" style={{ color: "var(--color-primary)" }} />
          <h1 className="font-heading text-3xl font-bold text-gray-900">Todos los productos</h1>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <a
              href="/productos"
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                !searchParams.category
                  ? "text-white border-transparent"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
              style={!searchParams.category ? { background: "var(--color-primary)", borderColor: "var(--color-primary)" } : {}}
            >
              Todo
            </a>
            {categories.map((cat: { slug: string; name: string }) => (
              <a
                key={cat.slug}
                href={`/productos?category=${cat.slug}`}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  searchParams.category === cat.slug
                    ? "text-white border-transparent"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
                style={searchParams.category === cat.slug ? { background: "var(--color-primary)", borderColor: "var(--color-primary)" } : {}}
              >
                {cat.name}
              </a>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay productos disponibles todavia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer storeName={cfg.storeName} contact={cfg.contact} />
    </CartProvider>
  );
}
