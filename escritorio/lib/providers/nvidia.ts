// NVIDIA NIM provider for MentorIA (OpenAI-compatible API).
// Docs: https://docs.api.nvidia.com
// Endpoint: https://integrate.api.nvidia.com/v1
import {
  Provider,
  ProviderError,
  StreamEvent,
  StreamOptions,
} from "./types";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

function getApiKey(): string {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key) throw new ProviderError("NVIDIA_NIM_API_KEY not configured", "invalid_api_key");
  return key;
}

function mapNvidiaError(status: number, bodyText: string): ProviderError {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
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
    return new ProviderError(bodyText || `nvidia error ${status}`, "overloaded", status);
  }
  return new ProviderError(bodyText || `nvidia error ${status}`, "unknown", status);
}

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
      if (!line) continue;
      if (line.startsWith("data: ")) {
        yield line.slice(6);
      } else if (line.startsWith("data:")) {
        yield line.slice(5);
      }
    }
  }
  if (buffer.startsWith("data: ")) yield buffer.slice(6);
}

export const nvidiaProvider: Provider = {
  async *streamChat(opts: StreamOptions): AsyncIterable<StreamEvent> {
    const apiKey = getApiKey();
    const body = {
      model: opts.model,
      stream: true,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    let res: Response;
    try {
      res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
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
      throw mapNvidiaError(res.status, text);
    }
    if (!res.body) throw new ProviderError("no response body", "network");

    const reader = res.body.getReader();
    let full = "";
    // 90s timeout waiting for the first chunk — protects against NVIDIA NIM cold start.
    // Resets once the first content token arrives; the rest of the stream is unlimited.
    const FIRST_CHUNK_TIMEOUT_MS = 90_000;
    let firstChunkReceived = false;
    let coldStartTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (!firstChunkReceived) reader.cancel();
    }, FIRST_CHUNK_TIMEOUT_MS);
    try {
      for await (const data of parseSSE(reader)) {
        if (data === "[DONE]") break;
        try {
          const obj = JSON.parse(data);
          const delta = obj?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (coldStartTimer) { clearTimeout(coldStartTimer); coldStartTimer = null; }
            }
            full += delta;
            yield { type: "delta", text: delta };
          }
        } catch {
          // ignore malformed chunk
        }
      }
      if (!firstChunkReceived) {
        throw new ProviderError(
          "NVIDIA NIM tardó más de 90s en responder (posible cold start). Reintentá.",
          "timeout"
        );
      }
      yield { type: "done", fullText: full };
    } finally {
      if (coldStartTimer) clearTimeout(coldStartTimer);
      try {
        reader.releaseLock();
      } catch {}
    }
  },
};
