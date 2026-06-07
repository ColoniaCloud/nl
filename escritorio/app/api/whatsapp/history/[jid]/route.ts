export const runtime = "nodejs";
export const maxDuration = 10;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { getWaHistory } from "@/lib/db-whatsapp";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jid: string }> }
) {
  try {
    const userId = await requireWaAccess();
    const { jid } = await params;

    if (!jid) return Response.json({ error: "jid requerido" }, { status: 400 });

    const messages = await getWaHistory(userId, decodeURIComponent(jid));
    return Response.json({ messages });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
