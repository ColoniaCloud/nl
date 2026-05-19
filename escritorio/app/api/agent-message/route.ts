import { NextResponse } from "next/server";

export const runtime = "nodejs";

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://automata.nl360.site/webhook/nl360/agent/manu-stub";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    // ✅ Importante: esta route devuelve JSON SIEMPRE (nunca redirect)
    const cookieHeader = req.headers.get("cookie") || "";

    // Ajustá el nombre si tu cookie real se llama distinto.
    const hasJwt = cookieHeader.includes("nl360_jwt=");

    if (!hasJwt) {
      // 401 JSON (NO redirect)
      return jsonError(401, "unauthorized");
    }

    const body = await req.json();

    // body esperado: { conversation_id, agent, message, state, choice_id?, ui_value? }
    const payload = {
      conversation_id: body.conversation_id,
      agent: body.agent,
      message: body.message ?? "",
      state: body.state ?? {},
      choice_id: body.choice_id ?? null,
      ui_value: body.ui_value ?? null,
      // opcional: mandar user si lo tenés en server (si no, igual ok)
      user: body.user ?? undefined,
    };

    const r = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    // Si n8n devolvió algo no-JSON, lo devolvemos como error controlado
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return jsonError(502, "n8n_returned_non_json");
    }

    // ✅ normalizar si n8n devuelve array (All Incoming Items)
    const normalized = Array.isArray(data) ? data[0] : data;

    return NextResponse.json(normalized ?? { ok: false, error: "empty_response" }, {
      status: r.status,
    });
  } catch (e: any) {
    return jsonError(500, e?.message || "server_error");
  }
}
