import Link from "next/link";
import { getConfig, getApiBase } from "@/lib/config";
import { CartProvider } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { ArrowRight, Truck, ShieldCheck, Gem } from "lucide-react";

async function getFeaturedProducts(apiBase: string) {
  try {
    const res = await fetch(`${apiBase}/products?featured=1`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const cfg = getConfig();
  const apiBase = getApiBase(cfg);
  const featured = await getFeaturedProducts(apiBase);

  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main>
        {/* Hero — full-bleed image with overlay */}
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
          <img
            src={cfg.images.hero}
            alt={cfg.storeName}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
          <div className="relative text-center px-6 max-w-2xl mx-auto">
            <p
              className="text-xs font-semibold uppercase tracking-[0.3em] mb-6 text-white/70"
            >
              Bienvenido a
            </p>
            <h1 className="font-heading text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1]">
              {cfg.storeName}
            </h1>
            <p className="text-lg text-white/80 mb-10 max-w-lg mx-auto leading-relaxed">
              {cfg.tagline}
            </p>
            <Link
              href="/productos"
              className="inline-flex items-center gap-3 px-10 py-4 bg-white text-stone-900 font-semibold text-sm uppercase tracking-wider hover:bg-stone-100 transition-colors"
            >
              Explorar coleccion
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Value propositions — icons, not emojis */}
        <section className="border-b border-stone-200">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Truck, title: "Envio express", desc: "Despacho en 24-48 horas a todo el pais" },
              { icon: ShieldCheck, title: "Compra segura", desc: "Tu pago protegido con encriptacion total" },
              { icon: Gem, title: "Calidad premium", desc: "Productos cuidadosamente seleccionados" },
            ].map((v) => (
              <div key={v.title} className="flex items-center gap-4 justify-center md:justify-start">
                <v.icon className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-accent)" }} />
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-stone-900">{v.title}</h3>
                  <p className="text-xs text-stone-500">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured products */}
        {featured.length > 0 && (
          <section className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-3" style={{ color: "var(--color-accent)" }}>
                Seleccion exclusiva
              </p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-stone-900">
                Productos destacados
              </h2>
              <div className="boutique-separator mx-auto mt-4" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {featured.slice(0, 8).map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div className="text-center mt-14">
              <Link
                href="/productos"
                className="inline-flex items-center gap-3 border-b-2 pb-1 font-semibold text-sm uppercase tracking-wider transition-colors"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
              >
                Ver toda la coleccion
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}

        {/* Collection banner — full-width image */}
        <section className="relative h-[50vh] min-h-[300px] flex items-center overflow-hidden">
          <img
            src={cfg.images.collection}
            alt="Coleccion"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative max-w-6xl mx-auto px-6 text-center">
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-6">
              Nueva temporada
            </h2>
            <Link
              href="/productos"
              className="inline-flex items-center gap-2 px-8 py-3 border-2 border-white text-white text-sm uppercase tracking-wider font-semibold hover:bg-white hover:text-stone-900 transition-all"
            >
              Descubrir ahora
            </Link>
          </div>
        </section>
      </main>
      <Footer storeName={cfg.storeName} contact={cfg.contact} />
    </CartProvider>
  );
}
