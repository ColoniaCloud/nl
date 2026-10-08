export const runtime = "nodejs";
export const maxDuration = 10;

import { requireEmailAccess, EmailAccessError } from "@/lib/email-access";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { getEmailAccount } from "@/lib/email-transport";

export async function GET() {
  try {
    const userId = await requireEmailAccess();
    await ensureTables();
    const account = await getEmailAccount(userId);
    if (!account) return Response.json({ status: "disconnected" });

    return Response.json({
      status: account.status,
      provider: account.provider,
      fromName: account.from_name,
      fromEmail: account.from_email,
      connectedAt: account.connected_at,
    });
  } catch (e: any) {
    if (e instanceof EmailAccessError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
