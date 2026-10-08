import Link from "next/link";
import type { StoreConfig } from "@/lib/config";
import { ArrowRight, Star, Shield, Truck } from "lucide-react";

export default function HomePage({ cfg, featured, ProductCard }: {
  cfg: StoreConfig;
  featured: any[];
  ProductCard: React.ComponentType<{ product: any }>;
}) {
  return (
    <main>
      {/* Hero — clean centered with underline accent */}
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-36 text-center">
        <h1 className="font-heading text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-[1.05]">
          {cfg.storeName}
        </h1>
        <div className="w-16 h-1 mx-auto mb-8" style={{ background: "var(--color-primary)" }} />
        <p className="text-xl text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
          {cfg.tagline}
        </p>
        <Link
          href="/productos"
          className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-sm border-2 transition-all hover:text-white"
          style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `var(--color-primary)`; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = `var(--color-primary)`; }}
        >
          Ver productos <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Full-width hero image */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <img src={cfg.images.hero} alt={cfg.storeName} className="w-full aspect-[21/9] object-cover" />
      </section>

      {/* Value props — simple horizontal */}
      <section className="border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {[
            { icon: Truck, title: "Envio gratis", desc: "En compras mayores a $5000" },
            { icon: Shield, title: "Garantia total", desc: "30 dias de devolucion sin preguntas" },
            { icon: Star, title: "Calidad certificada", desc: "Productos verificados y autenticos" },
          ].map((v) => (
            <div key={v.title} className="flex items-center gap-4 py-4 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0">
              <v.icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{v.title}</h3>
                <p className="text-xs text-gray-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl font-bold text-gray-900 mb-3">Productos destacados</h2>
            <div className="w-12 h-0.5 mx-auto" style={{ background: "var(--color-primary)" }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.slice(0, 8).map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
          <div className="text-center mt-14">
            <Link href="/productos" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
              Ver todo el catalogo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
