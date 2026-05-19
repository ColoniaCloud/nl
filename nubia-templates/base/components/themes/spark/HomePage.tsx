import Link from "next/link";
import type { StoreConfig } from "@/lib/config";
import { ArrowRight, Zap, Lock, Rocket } from "lucide-react";

export default function HomePage({ cfg, featured, ProductCard }: {
  cfg: StoreConfig;
  featured: any[];
  ProductCard: React.ComponentType<{ product: any }>;
}) {
  return (
    <main>
      <section className="spark-hero-bg spark-grid-pattern relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="spark-accent-line mb-8" />
              <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">{cfg.storeName}</h1>
              <p className="text-lg text-slate-400 mb-10 max-w-md leading-relaxed">{cfg.tagline}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/productos" className="spark-glow inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105" style={{ background: "var(--color-primary)" }}>
                  Explorar productos <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="#contacto" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/80 border border-white/20 text-sm hover:bg-white/5 transition-all">
                  Contactar
                </Link>
              </div>
              <div className="flex gap-8 mt-12 pt-8 border-t border-white/10">
                <div>
                  <div className="font-heading text-2xl font-bold text-white">100%</div>
                  <div className="text-xs text-slate-500 mt-0.5">Seguro</div>
                </div>
                <div>
                  <div className="font-heading text-2xl font-bold text-white">24h</div>
                  <div className="text-xs text-slate-500 mt-0.5">Envio rapido</div>
                </div>
                <div>
                  <div className="font-heading text-2xl font-bold text-white" style={{ color: "var(--color-accent)" }}>5&#9733;</div>
                  <div className="text-xs text-slate-500 mt-0.5">Calificacion</div>
                </div>
              </div>
            </div>
            <div className="relative hidden md:block">
              <div className="absolute -inset-4 rounded-2xl" style={{ background: `linear-gradient(135deg, ${cfg.colors.primary}20, ${cfg.colors.accent}20)` }} />
              <img src={cfg.images.hero} alt={cfg.storeName} className="relative w-full aspect-[4/3] object-cover rounded-2xl border border-white/10" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 -mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Tecnologia moderna", desc: "Productos de ultima generacion" },
            { icon: Lock, title: "Pago seguro", desc: "Encriptacion y proteccion total" },
            { icon: Rocket, title: "Envio express", desc: "Despacho inmediato a todo el pais" },
          ].map((v) => (
            <div key={v.title} className="flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.colors.primary}12` }}>
                <v.icon className="w-5 h-5" style={{ color: cfg.colors.primary }} />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-slate-900 tracking-tight">{v.title}</h3>
                <p className="text-xs text-slate-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="spark-accent-line mb-3" />
              <h2 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Lo mas nuevo</h2>
            </div>
            <Link href="/productos" className="hidden md:inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:scale-105" style={{ background: "var(--color-primary)" }}>
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 mb-16">
        <div className="spark-hero-bg spark-grid-pattern rounded-2xl overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8 p-10 md:p-14">
            <div className="flex-1">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">No te pierdas las novedades</h2>
              <p className="text-slate-400 max-w-md">Nuevos productos, ofertas exclusivas y envio gratis en tu primera compra.</p>
            </div>
            <Link href="/productos" className="spark-glow inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-sm" style={{ background: "var(--color-primary)" }}>
              Comprar ahora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
