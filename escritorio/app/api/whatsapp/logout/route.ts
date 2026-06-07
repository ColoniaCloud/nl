export const runtime = "nodejs";
export const maxDuration = 15;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { waFetch } from "@/lib/wa-client";
import { upsertWaSession } from "@/lib/db-whatsapp";

export async function POST() {
  try {
    const userId = await requireWaAccess();

    await waFetch(userId, "/logout", { method: "POST" }).catch(() => {});

    await upsertWaSession(userId, {
      status:        "disconnected",
      phone:         null,
      display_name:  null,
      qr_code:       null,
      qr_expires_at: null,
      connected_at:  null,
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error cerrando sesión" }, { status: 500 });
  }
}
