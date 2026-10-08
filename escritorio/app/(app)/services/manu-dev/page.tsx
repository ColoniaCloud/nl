"use client";

import { useRouter } from "next/navigation";
import { Globe, ShoppingBag, Hammer } from "lucide-react";

const MOTORES = [
  {
    id: "pro",
    href: "/services/manu-dev/pro",
    icon: Globe,
    label: "Sitio Web PRO",
    description: "Sitio completo multi-página generado con Next.js. Ideal para negocios que necesitan presencia profesional.",
    tag: "Next.js · Multi-página",
    color: "from-emerald-500/10 to-emerald-500/5",
    iconColor: "text-emerald-400",
    border: "hover:border-emerald-500/40",
    wide: true,
  },
  {
    id: "nubia",
    href: "/services/nubia",
    icon: ShoppingBag,
    label: "Nubia",
    description: "Tienda online completa con catálogo, carrito y MercadoPago. Para negocios que venden productos.",
    tag: "E-commerce · MercadoPago",
    color: "from-purple-500/10 to-purple-500/5",
    iconColor: "text-purple-400",
    border: "hover:border-purple-500/40",
  },
  {
    id: "forge",
    href: "/services/forge",
    icon: Hammer,
    label: "Forge",
    description: "Tokenizá activos reales en blockchain. Ethereum, Polygon, Base y Arbitrum.",
    tag: "Blockchain · Solidity",
    color: "from-amber-500/10 to-amber-500/5",
    iconColor: "text-amber-400",
    border: "hover:border-amber-500/40",
  },
];

export default function ManuDevHomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            ¿Qué querés construir hoy?
          </h1>
          <p className="text-sm text-muted-foreground">
            Elegí el motor de generación según tu proyecto.
          </p>
        </div>

        {/* Animaciones de entrada (cards y, distinta, los iconos) */}
        <style>{`
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(18px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes iconPop {
            0%   { opacity: 0; transform: scale(0.4) rotate(-12deg); }
            60%  { opacity: 1; transform: scale(1.15) rotate(4deg); }
            100% { opacity: 1; transform: scale(1) rotate(0); }
          }
          .motor-card { opacity: 0; animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
          .motor-icon { opacity: 0; animation: iconPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
          @media (prefers-reduced-motion: reduce) {
            .motor-card, .motor-icon { animation: none; opacity: 1; }
          }
        `}</style>

        {/* Grid de motores (masonry: PRO ocupa toda la primera fila) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOTORES.map((motor, index) => {
            const Icon = motor.icon;
            return (
              <button
                key={motor.id}
                onClick={() => router.push(motor.href)}
                style={{ animationDelay: `${index * 90}ms` }}
                className={`
                  motor-card group relative text-left p-5 rounded-xl border border-border/50
                  bg-gradient-to-br ${motor.color}
                  ${motor.border}
                  ${motor.wide ? "sm:col-span-2" : ""}
                  transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                `}
              >
                {/* Icono */}
                <div className="motor-icon mb-4 text-white" style={{ animationDelay: `${index * 90 + 140}ms` }}>
                  <Icon size={24} strokeWidth={1.5} />
                </div>

                {/* Label */}
                <h2 className="text-base font-semibold text-foreground mb-1">
                  {motor.label}
                </h2>

                {/* Descripción */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {motor.description}
                </p>

                {/* Tag */}
                <span className="inline-block text-[10px] font-medium tracking-wide uppercase text-muted-foreground/60 border border-border/30 rounded px-2 py-0.5">
                  {motor.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
