"use client";

import { useRouter } from "next/navigation";
import { Globe, FileText, ShoppingBag, Zap } from "lucide-react";

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
  },
  {
    id: "landing",
    href: "/services/manu-dev/landing",
    icon: FileText,
    label: "Landing Page",
    description: "Una sola página HTML+CSS con navegación por anclas. Lista en minutos, sin build de Next.js.",
    tag: "HTML · Una página",
    color: "from-blue-500/10 to-blue-500/5",
    iconColor: "text-blue-400",
    border: "hover:border-blue-500/40",
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
    icon: Zap,
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

        {/* Grid de motores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOTORES.map((motor) => {
            const Icon = motor.icon;
            return (
              <button
                key={motor.id}
                onClick={() => router.push(motor.href)}
                className={`
                  group relative text-left p-5 rounded-xl border border-border/50
                  bg-gradient-to-br ${motor.color}
                  ${motor.border}
                  transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                `}
              >
                {/* Icono */}
                <div className={`mb-4 ${motor.iconColor}`}>
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
