export const runtime = "nodejs";
export const maxDuration = 10;

import { requireWaAccess, WaAccessError } from "@/lib/wa-access";
import { getWaContactList } from "@/lib/db-whatsapp";

export async function GET() {
  try {
    const userId = await requireWaAccess();
    const contacts = await getWaContactList(userId);
    return Response.json({ contacts });
  } catch (e: any) {
    if (e instanceof WaAccessError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
