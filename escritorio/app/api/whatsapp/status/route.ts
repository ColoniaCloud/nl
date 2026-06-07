export const runtime = "nodejs";
export const maxDuration = 10;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { getWaSession } from "@/lib/db-whatsapp";

export async function GET() {
  try {
    const userId = await requireWaAccess();
    const session = await getWaSession(userId);
    return Response.json(session ?? { status: "disconnected" });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
