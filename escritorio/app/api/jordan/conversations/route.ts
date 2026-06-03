import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, getConversations } from "@/lib/db-jordan";
import type { ToolType } from "@/app/api/jordan/chat/route";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const VALID_TOOLS: ToolType[] = ["FUNNELS", "ESTRATEGIA", "SETTERS", "CLOSERS", "DATOS", "CRM"];

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tool = req.nextUrl.searchParams.get("tool") ?? undefined;
  if (tool && !VALID_TOOLS.includes(tool as ToolType)) {
    return NextResponse.json({ error: "invalid_tool" }, { status: 400 });
  }

  const conversations = await getConversations(userId, tool);
  return NextResponse.json({ conversations });
}
