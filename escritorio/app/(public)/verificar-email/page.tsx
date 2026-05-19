"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error";

function VerificarEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const uid = params.get("uid") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [loginHref, setLoginHref] = useState("/login?verified=1");

  useEffect(() => {
    if (!token || !uid) {
      setErrorMsg("Enlace invalido. Faltan parametros.");
      setStatus("error");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const plan = data.pendingPlan as string | null;
          if (plan && plan !== "free") {
            setLoginHref(`/login?verified=1&next=/suscripcion%3Fplan%3D${encodeURIComponent(plan)}`);
          }
          setStatus("success");
        } else {
          setErrorMsg(data?.error || "Token invalido o expirado.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Error de conexion. Intenta de nuevo.");
        setStatus("error");
      });
  }, [token, uid]);

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
          {status === "loading" && (
            <>
              <Loader2 className="size-10 text-violet-400 animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-400">Verificando tu email...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex items-center justify-center mb-5">
                <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <CheckCircle className="size-8 text-emerald-400" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">
                Email verificado
              </h1>
              <p className="text-sm text-zinc-400 mb-6">
                Tu cuenta esta activa. Ya puedes iniciar sesion.
              </p>
              <Link
                href={loginHref}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-colors"
              >
                Iniciar sesion
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex items-center justify-center mb-5">
                <div className="rounded-full bg-red-500/10 border border-red-500/20 p-4">
                  <XCircle className="size-8 text-red-400" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">
                Verificacion fallida
              </h1>
              <p className="text-sm text-zinc-400 mb-6">{errorMsg}</p>
              <Link
                href="/registro"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-zinc-300 text-sm hover:border-white/[0.20] hover:text-white transition-colors"
              >
                Volver al registro
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <VerificarEmailInner />
    </Suspense>
  );
}
