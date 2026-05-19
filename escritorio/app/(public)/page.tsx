"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";

const FaultyTerminal = dynamic(
  () => import("@/components/lander/FaultyTerminal"),
  { ssr: false }
);

const AgentWorkflow = dynamic(
  () => import("@/components/lander/AgentWorkflow"),
  { ssr: false }
);

export default function PublicHome() {
  return (
    <div className="pb-12 md:pb-20">
      {/* Hero — full-bleed, flush to top, breaks out of 70vw container */}
      <section
        className="relative overflow-hidden min-h-screen -mt-24 flex items-center"
        style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
      >
        {/* FaultyTerminal background */}
        <div className="absolute inset-0">
          <FaultyTerminal
            tint="#2a4b6f"
            scale={1.2}
            gridMul={[2, 1]}
            digitSize={1.5}
            timeScale={0.3}
            scanlineIntensity={0.25}
            glitchAmount={1}
            flickerAmount={0.8}
            noiseAmp={1}
            curvature={0.15}
            chromaticAberration={0}
            mouseReact={true}
            mouseStrength={0.2}
            pageLoadAnimation={true}
            brightness={1}
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-zinc-950/55" />

        {/* Content — centered back to 70vw, with top padding to clear fixed header */}
        <div className="relative z-10 w-[70vw] mx-auto pt-36 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: badge + title + buttons */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.07] px-3.5 py-1.5 text-xs text-zinc-300 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Suite de agentes IA para negocios
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-8">
              Tu negocio en modo{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                automatico
              </span>
            </h1>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/agentes"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
              >
                Ver agentes <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/precio"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.20] text-zinc-200 text-sm hover:border-white/[0.35] hover:text-white transition-colors backdrop-blur-sm"
              >
                Ver precios
              </Link>
            </div>
          </div>

          {/* Right: isologotipo rotating */}
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
              alt="NL360"
              className="invert animate-spin select-none"
              style={{
                width: "clamp(160px, 18vw, 280px)",
                height: "clamp(160px, 18vw, 280px)",
                animationDuration: "14s",
                animationTimingFunction: "linear",
              }}
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 mb-0">
        {[
          { value: "4", label: "Agentes activos" },
          { value: "IA", label: "Generativa" },
          { value: "N8N", label: "Automatizaciones" },
          { value: "24/7", label: "Disponibilidad" },
        ].map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-xs text-zinc-500">{label}</div>
          </div>
        ))}
      </section>
      {/* Agent Workflow simulation */}
      <AgentWorkflow />
    </div>
  );
}
