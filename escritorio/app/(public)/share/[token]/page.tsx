import { notFound } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SharedData = {
  ok: true;
  title: string;
  tool: string;
  toolLabel: string;
  updatedAt: string;
  expiresAt: string;
  messages: Array<{ role: string; content: string; ts?: string }>;
};

async function fetchShare(token: string, baseUrl: string): Promise<SharedData | { error: string; status: number } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/mentoria/shared/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      return d as SharedData;
    }
    const body = await res.json().catch(() => ({}));
    return { error: body?.error || "error", status: res.status };
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Build absolute URL for server-side fetch
  const host = process.env.NL360_BASE_URL || "http://localhost:3000";
  const data = await fetchShare(token, host);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Error</h1>
          <p className="text-sm text-zinc-400">No se pudo cargar el enlace compartido.</p>
        </div>
      </main>
    );
  }

  if ("error" in data) {
    if (data.status === 404) notFound();
    const msg =
      data.error === "revoked"
        ? "Este enlace fue revocado por el autor."
        : data.error === "expired"
        ? "Este enlace expiro."
        : data.error === "unavailable"
        ? "Este contenido ya no esta disponible."
        : "No se pudo cargar el enlace compartido.";
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">Enlace no disponible</h1>
          <p className="text-sm text-zinc-400">{msg}</p>
          <Link
            href="/"
            className="inline-block mt-6 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2 transition"
          >
            Ir a NL360
          </Link>
        </div>
      </main>
    );
  }

  const messages = data.messages || [];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {/* Header */}
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1">
              MentorIA · {data.toolLabel}
            </span>
            <span className="inline-block rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] uppercase tracking-widest px-3 py-1">
              Solo lectura
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 mb-2">{data.title}</h1>
          <p className="text-xs text-zinc-500">
            Actualizado el {formatDate(data.updatedAt)} · Expira el {formatDate(data.expiresAt)}
          </p>
        </header>

        {/* Messages */}
        <div className="space-y-6">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500">Esta sesion no tiene mensajes.</p>
          )}
          {messages.map((m, i) => {
            const who =
              m.role === "user" ? "Alumno"
              : m.role === "agent" ? "MentorIA"
              : "Sistema";
            const bubbleCls =
              m.role === "user"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-[#1e293b] border-sky-900/40";
            const html = marked.parse(m.content || "", { async: false }) as string;
            return (
              <div key={i} className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {who}
                </div>
                <div
                  className={`rounded-xl border ${bubbleCls} px-4 py-3 text-sm leading-relaxed text-zinc-200 prose prose-invert prose-sm max-w-none`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-zinc-800 text-center">
          <p className="text-[11px] text-zinc-500">
            Conversacion compartida desde{" "}
            <Link href="/" className="text-sky-400 hover:underline">
              NL360 MentorIA
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
