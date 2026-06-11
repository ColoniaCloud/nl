import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Politica de Cookies — NL360" };

const COOKIE_TYPES = [
  {
    name: "Esenciales",
    color: "emerald",
    description:
      "Necesarias para el funcionamiento basico del Servicio. Incluyen cookies de autenticacion (nl360_jwt) que mantienen tu sesion activa. No pueden desactivarse.",
    examples: ["nl360_jwt — sesion de usuario", "csrf_token — proteccion de formularios"],
  },
  {
    name: "Analiticas",
    color: "sky",
    description:
      "Nos ayudan a entender como los usuarios interactuan con el Servicio para mejorar la experiencia. Los datos son anonimizados.",
    examples: ["_ga — Google Analytics", "_gid — Google Analytics session"],
  },
  {
    name: "Preferencias",
    color: "violet",
    description:
      "Recuerdan tus ajustes y preferencias para personalizar tu experiencia en futuras visitas.",
    examples: ["sidebar_open — estado del panel lateral", "theme — preferencia de tema"],
  },
];

const colorMap: Record<string, { dot: string; bg: string; text: string }> = {
  emerald: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  sky:     { dot: "bg-sky-400",     bg: "bg-sky-500/10",     text: "text-sky-400" },
  violet:  { dot: "bg-violet-400",  bg: "bg-violet-500/10",  text: "text-violet-400" },
};

export default function CookiesPage() {
  return (
    <div className="py-12 md:py-16 max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-10"
      >
        <ArrowLeft className="size-4" /> Inicio
      </Link>

      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Legal</p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
          Politica de Cookies
        </h1>
        <p className="text-sm text-zinc-500">Ultima actualizacion: enero 2026</p>
      </div>

      {/* Intro */}
      <div className="mb-10">
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          NL360 utiliza cookies y tecnologias similares para garantizar el funcionamiento
          correcto del Servicio, analizar su uso y recordar tus preferencias. Esta politica
          explica que cookies usamos y por que.
        </p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Una cookie es un pequeno archivo de texto que se almacena en tu dispositivo cuando
          visitas un sitio web. Puedes controlar el uso de cookies a traves de la configuracion
          de tu navegador.
        </p>
      </div>

      {/* Cookie types */}
      <div className="flex flex-col gap-5 mb-12">
        {COOKIE_TYPES.map((type) => {
          const c = colorMap[type.color];
          return (
            <div
              key={type.name}
              className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>
                  {type.name}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{type.description}</p>
              <div className={`rounded-xl ${c.bg} px-4 py-3`}>
                <p className="text-xxs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Ejemplos
                </p>
                <ul className="flex flex-col gap-1">
                  {type.examples.map((ex) => (
                    <li key={ex} className="text-xs text-zinc-400 font-mono">{ex}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-white mb-3">Como controlar las cookies</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-3">
          Puedes configurar tu navegador para rechazar todas las cookies o para que te avise
          cuando se envie una cookie. Sin embargo, si deshabilitas las cookies esenciales, es
          posible que algunas partes del Servicio no funcionen correctamente.
        </p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Para mas informacion sobre como gestionar cookies en tu navegador, visita la seccion
          de ayuda del mismo.
        </p>
      </div>

      {/* Contact */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5">
        <p className="text-sm text-zinc-400">
          Preguntas sobre nuestra politica de cookies:{" "}
          <a href="mailto:legal@nl360.site" className="text-violet-400 hover:text-violet-300">
            legal@nl360.site
          </a>
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/terminos" className="text-zinc-400 hover:text-white transition-colors">
          Terminos de Servicio
        </Link>
        <Link href="/privacidad" className="text-zinc-400 hover:text-white transition-colors">
          Politica de Privacidad
        </Link>
      </div>
    </div>
  );
}
