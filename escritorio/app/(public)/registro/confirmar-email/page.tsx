import Link from "next/link";
import { Mail } from "lucide-react";

export default function ConfirmarEmailPage() {
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
              <Mail className="size-8 text-violet-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            Revisa tu bandeja de entrada
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Te enviamos un email con un enlace de confirmacion. Haz clic en el
            enlace para activar tu cuenta.
          </p>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6">
            <p className="text-xs text-amber-400">
              Si no encuentras el email, revisa tu carpeta de spam o correo no
              deseado.
            </p>
          </div>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
          >
            Volver al inicio de sesion
          </Link>
        </div>
      </div>
    </div>
  );
}
