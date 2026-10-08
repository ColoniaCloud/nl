import Link from "next/link";
import type { StoreConfig } from "@/lib/config";
import { ArrowRight, Sparkles, Zap, Shield } from "lucide-react";

export default function HomePage({ cfg, featured, ProductCard }: {
  cfg: StoreConfig;
  featured: any[];
  ProductCard: React.ComponentType<{ product: any }>;
}) {
  return (
    <main className="bg-gray-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 neon-gradient opacity-30" />
        <div className="absolute inset-0 neon-grid opacity-10" />
        <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-8 border border-white/10 text-gray-400">
              <Sparkles className="w-3 h-3" style={{ color: "var(--color-accent)" }} /> Nueva coleccion disponible
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight">
              <span className="neon-text">{cfg.storeName}</span>
            </h1>
            <p className="text-lg text-gray-400 mb-10 max-w-lg leading-relaxed">{cfg.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/productos" className="neon-glow inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm text-gray-950 transition-all hover:scale-105" style={{ background: "var(--color-accent)" }}>
                Explorar <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#contacto" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-sm border border-white/20 text-white/80 hover:bg-white/5 transition-all">
                Contacto
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-5 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Envio express", desc: "Despacho en 24 horas" },
            { icon: Shield, title: "Pago seguro", desc: "Proteccion garantizada" },
            { icon: Sparkles, title: "Exclusivo", desc: "Productos unicos" },
          ].map((v) => (
            <div key={v.title} className="flex items-center gap-4 bg-white/5 rounded-2xl p-5 border border-white/5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.colors.accent}15` }}>
                <v.icon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{v.title}</h3>
                <p className="text-xs text-gray-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-heading text-3xl font-extrabold tracking-tight">Lo mas <span style={{ color: "var(--color-accent)" }}>nuevo</span></h2>
            </div>
            <Link href="/productos" className="hidden md:inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="max-w-6xl mx-auto px-5 mb-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <div className="absolute inset-0 neon-gradient opacity-20" />
          <div className="relative text-center py-16 px-6">
            <h2 className="font-heading text-3xl font-extrabold mb-4 tracking-tight">Encende tu estilo</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">Descubri productos que brillan con luz propia. Envio gratis en tu primera compra.</p>
            <Link href="/productos" className="neon-glow inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm text-gray-950" style={{ background: "var(--color-accent)" }}>
              Comprar ahora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
