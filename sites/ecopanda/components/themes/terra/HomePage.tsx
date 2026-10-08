import Link from "next/link";
import type { StoreConfig } from "@/lib/config";
import { ArrowRight, Sun, Heart, Leaf } from "lucide-react";

export default function HomePage({ cfg, featured, ProductCard }: {
  cfg: StoreConfig;
  featured: any[];
  ProductCard: React.ComponentType<{ product: any }>;
}) {
  return (
    <main className="bg-amber-50/30">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="flex flex-col justify-center py-16 md:py-28 md:pr-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 bg-amber-100 text-amber-700 w-fit">
              <Sun className="w-3 h-3" /> Hecho con amor
            </div>
            <h1 className="font-heading text-4xl md:text-6xl font-bold text-amber-950 mb-6 leading-[1.1]">{cfg.storeName}</h1>
            <p className="text-lg text-amber-800/60 mb-10 max-w-md leading-relaxed">{cfg.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/productos" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm transition-all hover:scale-105" style={{ background: "var(--color-primary)" }}>
                Explorar <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#contacto" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold border-2 text-sm transition-colors" style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                Contacto
              </Link>
            </div>
          </div>
          <div className="relative hidden md:block">
            <img src={cfg.images.hero} alt={cfg.storeName} className="w-full h-full object-cover min-h-[500px]" />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-amber-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-5 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Leaf, title: "Natural", desc: "Ingredientes de origen confiable" },
            { icon: Heart, title: "Artesanal", desc: "Elaborado con dedicacion" },
            { icon: Sun, title: "Sustentable", desc: "Comprometidos con el planeta" },
          ].map((v) => (
            <div key={v.title} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100">
                <v.icon className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-amber-950">{v.title}</h3>
                <p className="text-xs text-amber-700/60">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-amber-950 mb-2">Nuestros productos</h2>
            <p className="text-amber-700/50 text-sm">Seleccionados especialmente para ti</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {featured.slice(0, 8).map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
          <div className="text-center mt-12">
            <Link href="/productos" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Ver todo el catalogo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Banner */}
      <section className="max-w-6xl mx-auto px-5 mb-16">
        <div className="relative overflow-hidden rounded-3xl min-h-[260px] flex items-center">
          <img src={cfg.images.banner} alt="Coleccion" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cfg.colors.primary}dd 0%, ${cfg.colors.secondary}99 100%)` }} />
          <div className="relative px-10 py-12 max-w-lg">
            <h2 className="font-heading text-3xl font-bold text-white mb-3">De la tierra a tu hogar</h2>
            <p className="text-white/80 mb-6 leading-relaxed">Productos artesanales que cuentan una historia.</p>
            <Link href="/productos" className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full font-semibold text-sm hover:scale-105 transition-transform" style={{ color: cfg.colors.primary }}>
              Descubrir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
