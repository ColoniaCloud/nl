import Link from "next/link";
import type { StoreConfig } from "@/lib/config";
import { ArrowRight, Leaf, Heart, Truck } from "lucide-react";

export default function HomePage({ cfg, featured, ProductCard }: {
  cfg: StoreConfig;
  featured: any[];
  ProductCard: React.ComponentType<{ product: any }>;
}) {
  return (
    <main>
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="fresh-badge mb-6" style={{ background: `${cfg.colors.primary}15`, color: cfg.colors.primary }}>
              <Leaf className="w-3 h-3" /> Natural y autentico
            </div>
            <h1 className="font-heading text-4xl md:text-6xl font-bold text-stone-900 mb-6 leading-[1.15]">{cfg.storeName}</h1>
            <p className="text-lg text-stone-500 mb-8 max-w-md leading-relaxed">{cfg.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/productos" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white transition-transform hover:scale-105 active:scale-95" style={{ background: "var(--color-primary)" }}>
                Ver productos <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#contacto" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold border-2 transition-colors" style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                Contactanos
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 fresh-blob opacity-20" style={{ background: cfg.colors.primary }} />
            <img src={cfg.images.hero} alt={cfg.storeName} className="relative w-full aspect-[4/3] object-cover rounded-3xl shadow-lg" />
          </div>
        </div>
      </section>

      <section className="py-14" style={{ background: `${cfg.colors.primary}08` }}>
        <div className="max-w-6xl mx-auto px-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Leaf, title: "100% natural", desc: "Productos frescos y de origen confiable" },
            { icon: Heart, title: "Hecho con amor", desc: "Cada producto es cuidadosamente seleccionado" },
            { icon: Truck, title: "Envio a domicilio", desc: "Recibe tus pedidos frescos en tu puerta" },
          ].map((v) => (
            <div key={v.title} className="flex items-start gap-4 bg-white rounded-2xl p-6 border border-stone-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.colors.primary}15` }}>
                <v.icon className="w-5 h-5" style={{ color: cfg.colors.primary }} />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-stone-800 mb-1">{v.title}</h3>
                <p className="text-sm text-stone-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-20">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="fresh-wave mb-3" />
              <h2 className="font-heading text-3xl font-bold text-stone-900">Nuestros productos</h2>
            </div>
            <Link href="/productos" className="hidden md:inline-flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: "var(--color-primary)" }}>
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {featured.slice(0, 8).map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
          <div className="text-center mt-10 md:hidden">
            <Link href="/productos" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Ver todos los productos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 mb-16">
        <div className="relative overflow-hidden rounded-3xl min-h-[280px] flex items-center">
          <img src={cfg.images.banner} alt="Coleccion" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cfg.colors.primary}dd 0%, ${cfg.colors.secondary}bb 100%)` }} />
          <div className="relative px-10 py-12 max-w-lg">
            <h2 className="font-heading text-3xl font-bold text-white mb-3">Lo mejor de la temporada</h2>
            <p className="text-white/80 mb-6 leading-relaxed">Descubre productos seleccionados especialmente para ti.</p>
            <Link href="/productos" className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full font-semibold text-sm transition-transform hover:scale-105" style={{ color: cfg.colors.primary }}>
              Explorar ahora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
