import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function PagoCanceladoPage() {
  return (
    <div className="py-12 md:py-20 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
            alt="NL360"
            className="h-10 w-10 invert mx-auto mb-5"
          />
        </div>

        <div className="rounded-2xl border border-white/[0.10] bg-zinc-900/60 backdrop-blur-sm p-8 text-center">
          <div className="flex items-center justify-center mb-5">
            <div className="rounded-full bg-zinc-500/10 border border-zinc-500/20 p-4">
              <svg
                className="size-8 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            Pago cancelado
          </h1>
          <p className="text-sm text-zinc-400 mb-2">
            No se realizo ningun cobro.
          </p>
          <p className="text-sm text-zinc-500 mb-6">
            Podes intentarlo de nuevo cuando quieras.
          </p>

          <Link
            href="/precio"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors mb-3"
          >
            Ver planes <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/workspace"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Volver al escritorio
          </Link>
        </div>
      </div>
    </div>
  );
}
