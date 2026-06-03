import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import {
  createConversation,
  getConversationMessages,
  addMessage,
  updateConversationTitle,
  getUserId,
} from "@/lib/db-jordan";
import { getAgent, loadSystemPrompt } from "@/lib/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

const MODEL = getAgent("jordan")!.model;

export type ToolType = "FUNNELS" | "ESTRATEGIA" | "SETTERS" | "CLOSERS" | "DATOS" | "CRM";
const VALID_TOOLS: ToolType[] = ["FUNNELS", "ESTRATEGIA", "SETTERS", "CLOSERS", "DATOS", "CRM"];

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthenticated(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) return true;
    const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res2.ok;
  } catch {
    return false;
  }
}

// ─── System prompts ───────────────────────────────────────────────────────────

function getJordanPrompt(tool: ToolType): string {
  const raw = loadSystemPrompt("jordan");
  const commonMatch = raw.match(/<!-- COMMON_RULES -->([\s\S]*?)<!-- \/COMMON_RULES -->/);
  const toolMatch = raw.match(new RegExp(`<!-- ${tool} -->([\\s\\S]*?)<!-- \\/${tool} -->`));
  const common = commonMatch ? commonMatch[1].trimEnd() : "";
  const toolText = toolMatch ? toolMatch[1].trim() : "";
  return toolText + common;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(raw: string): { reply: string; options: string[] } {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    const parsed = JSON.parse(cleaned);
    return {
      reply: String(parsed.reply ?? parsed.message ?? cleaned),
      options: Array.isArray(parsed.options)
        ? parsed.options.map(String).filter(Boolean)
        : [],
    };
  } catch {
    return { reply: raw.trim(), options: [] };
  }
}

// ─── Anthropic call ───────────────────────────────────────────────────────────

async function callAnthropic(
  tool: ToolType,
  history: { role: "user" | "model"; parts: string }[],
  message: string
): Promise<{ reply: string; options: string[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.parts,
    })),
    { role: "user" as const, content: message },
  ];

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: getJordanPrompt(tool),
    messages,
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  return parseResponse(raw);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await isAuthenticated(token))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, provider: "anthropic" });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await isAuthenticated(token))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    tool: ToolType;
    history: { role: "user" | "model"; parts: string }[];
    message: string;
    conversationId?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { tool, history = [], message, conversationId } = body;

  if (!tool || !VALID_TOOLS.includes(tool)) {
    return NextResponse.json({ ok: false, error: "invalid_tool" }, { status: 400 });
  }

  // ── Persistence: resolve or create conversation ──────────────────────────
  let resolvedConvId: number | undefined;
  const userId = await getUserId(token);

  if (userId) {
    if (conversationId) {
      resolvedConvId = conversationId;
    } else {
      const title = message.slice(0, 60);
      resolvedConvId = await createConversation(userId, title, tool);
    }

    // If history is empty but we have a conversation, load it from DB
    const effectiveHistory =
      history.length === 0 && resolvedConvId
        ? (await getConversationMessages(resolvedConvId)).map((m) => ({
            role: m.role === "assistant" ? ("model" as const) : ("user" as const),
            parts: m.content,
          }))
        : history;

    try {
      const { reply, options } = await callAnthropic(tool, effectiveHistory, message);
      if (!reply) {
        return NextResponse.json({ ok: false, error: "empty_response" }, { status: 502 });
      }

      // Save both messages
      await addMessage(resolvedConvId!, "user", message);
      await addMessage(resolvedConvId!, "assistant", reply);

      // Update conversation title on first message
      if (!conversationId) {
        await updateConversationTitle(resolvedConvId!, message.slice(0, 60));
      }

      return NextResponse.json({ ok: true, reply, options, provider: "anthropic", conversationId: resolvedConvId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error("[Jordan] error:", msg);
      return NextResponse.json(
        { ok: false, error: "Jordan esta experimentando dificultades. Intenta de nuevo." },
        { status: 500 }
      );
    }
  }

  // Fallback: no userId — call LLM without persistence (backward compat)
  try {
    const { reply, options } = await callAnthropic(tool, history, message);
    if (!reply) {
      return NextResponse.json({ ok: false, error: "empty_response" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, reply, options, provider: "anthropic" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[Jordan] error:", msg);
    return NextResponse.json(
      { ok: false, error: "Jordan esta experimentando dificultades. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
