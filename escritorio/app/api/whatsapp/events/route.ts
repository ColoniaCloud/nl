export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";

const WA_URL    = process.env.WA_SERVICE_URL!;
const WA_SECRET = process.env.WA_SERVICE_SECRET!;

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireWaAccess();
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }

  const upstream = await fetch(`${WA_URL}/sessions/${userId}/events`, {
    headers: { "x-service-secret": WA_SECRET },
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "No se pudo conectar con el servicio de WhatsApp" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
