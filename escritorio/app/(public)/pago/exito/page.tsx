import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function PagoExitoPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

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
            <div className="rounded-full bg-violet-500/10 border border-violet-500/20 p-4">
              <Clock className="size-8 text-violet-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            Pago recibido
          </h1>
          <p className="text-sm text-zinc-400 mb-2">
            Estamos verificando tu suscripcion. Esto puede tardar entre 1 y 10 minutos.
          </p>
          <p className="text-sm text-zinc-500 mb-6">
            Cuando se confirme, tu plan se actualizara automaticamente. No necesitas hacer nada mas.
          </p>

          <Link
            href="/workspace"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors mb-4"
          >
            Ir a mi cuenta <ArrowRight className="size-4" />
          </Link>

          {session_id && (
            <p className="text-[11px] text-zinc-600 mb-3">
              Referencia: <span className="font-mono">{session_id}</span>
            </p>
          )}

          <p className="text-xs text-zinc-600">
            ¿Pasaron mas de 15 minutos y tu plan no se activó?{" "}
            <Link
              href="/enterprise"
              className="text-zinc-400 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              Contactanos con la referencia
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
