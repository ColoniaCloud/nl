export const runtime = "nodejs";
export const maxDuration = 15;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { waFetch } from "@/lib/wa-client";
import { saveWaMessage } from "@/lib/db-whatsapp";

export async function POST(req: Request) {
  try {
    const userId = await requireWaAccess();
    const { jid, text } = await req.json();

    if (!jid || !text)
      return Response.json({ error: "jid y text requeridos" }, { status: 400 });

    await waFetch(userId, "/send", {
      method: "POST",
      body: JSON.stringify({ jid, text }),
    });

    await saveWaMessage({
      wa_id:     `out_${userId}_${jid}_${Date.now()}`,
      user_id:   userId,
      direction: "outbound",
      jid,
      body:      text,
      media_url: null,
      mimetype:  null,
      ts:        new Date(),
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error enviando mensaje" }, { status: 500 });
  }
}
