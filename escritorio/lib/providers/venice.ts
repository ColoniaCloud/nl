// Venice AI provider for MentorIA (OpenAI-compatible API).
// Docs: https://docs.venice.ai
// Endpoint: https://api.venice.ai/api/v1/chat/completions (stream=true → SSE)
import {
  ChatMessage,
  Provider,
  ProviderError,
  StreamEvent,
  StreamOptions,
} from "./types";

const VENICE_BASE = process.env.VENICE_BASE_URL || "https://api.venice.ai/api/v1";

function getApiKey(): string {
  const key = process.env.VENICE_API_KEY;
  if (!key) throw new ProviderError("VENICE_API_KEY not configured", "invalid_api_key");
  return key;
}

function mapVeniceError(status: number, bodyText: string): ProviderError {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || lower.includes("invalid api key")) {
    return new ProviderError(bodyText || "invalid api key", "invalid_api_key", status);
  }
  if (status === 402 || lower.includes("insufficient") || lower.includes("credit")) {
    return new ProviderError(bodyText || "insufficient credit", "credit_balance", status);
  }
  if (status === 429) {
    return new ProviderError(bodyText || "rate limited", "rate_limit", status);
  }
  if (status === 503 || status === 529) {
    return new ProviderError(bodyText || "overloaded", "overloaded", status);
  }
  if (status >= 500) {
    return new ProviderError(bodyText || `venice error ${status}`, "overloaded", status);
  }
  return new ProviderError(bodyText || `venice error ${status}`, "unknown", status);
}

// Parse Server-Sent Events from a fetch ReadableStream.
async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (!line) continue; // blank line separator
      if (line.startsWith("data: ")) {
        yield line.slice(6);
      } else if (line.startsWith("data:")) {
        yield line.slice(5);
      }
    }
  }
  // flush
  if (buffer.startsWith("data: ")) yield buffer.slice(6);
}

export const veniceProvider: Provider = {
  async *streamChat(opts: StreamOptions): AsyncIterable<StreamEvent> {
    const apiKey = getApiKey();
    // OpenAI-compatible shape: messages[] with role+content, optional system as first message.
    const messages: ChatMessage[] = [
      { role: "user" as any, content: "" }, // placeholder replaced below
    ];
    // Actually build messages array with a leading system message.
    const body = {
      model: opts.model,
      stream: true,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    } as Record<string, unknown>;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    // suppress unused variable
    void messages;

    let res: Response;
    try {
      res = await fetch(`${VENICE_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw new ProviderError("aborted", "timeout");
      throw new ProviderError(e?.message || "network error", "network");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw mapVeniceError(res.status, text);
    }
    if (!res.body) throw new ProviderError("no response body", "network");

    const reader = res.body.getReader();
    let full = "";
    try {
      for await (const data of parseSSE(reader)) {
        if (data === "[DONE]") break;
        try {
          const obj = JSON.parse(data);
          const delta = obj?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            full += delta;
            yield { type: "delta", text: delta };
          }
        } catch {
          // ignore malformed chunk
        }
      }
      yield { type: "done", fullText: full };
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  },
};
