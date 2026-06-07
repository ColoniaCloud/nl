export const runtime = "nodejs";
export const maxDuration = 30;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { waFetch } from "@/lib/wa-client";
import { upsertWaSession, getWaSession } from "@/lib/db-whatsapp";

export async function GET() {
  try {
    const userId = await requireWaAccess();

    await upsertWaSession(userId, { status: "qr_pending" });
    await waFetch(userId, "/start", { method: "POST" });

    const session = await getWaSession(userId);
    return Response.json(session ?? { status: "qr_pending" });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
