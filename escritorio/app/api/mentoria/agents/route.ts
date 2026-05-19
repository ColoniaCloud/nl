import { NextResponse } from "next/server";
import { listAgentSummaries } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

// Public list of available MentorIA subagents. Returns only metadata safe for
// the client — persona prompts and curriculum details stay server-side.
export async function GET() {
  try {
    const agents = await listAgentSummaries();
    return NextResponse.json({ ok: true, agents });
  } catch (e) {
    console.error("[mentoria/agents] error:", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
