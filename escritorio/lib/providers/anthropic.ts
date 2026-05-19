// Anthropic Claude provider for MentorIA.
// Uses the Messages API with streaming. Exposes the unified Provider interface.
import Anthropic from "@anthropic-ai/sdk";
import {
  ChatMessage,
  Provider,
  ProviderError,
  StreamEvent,
  StreamOptions,
} from "./types";

let clientInstance: Anthropic | null = null;
function getClient(): Anthropic {
  if (!clientInstance) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new ProviderError("ANTHROPIC_API_KEY not configured", "invalid_api_key");
    clientInstance = new Anthropic({ apiKey: key });
  }
  return clientInstance;
}

function mapAnthropicError(err: any): ProviderError {
  const status = err?.status;
  const raw = err?.error?.error?.message || err?.message || String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("credit balance") || lower.includes("insufficient")) {
    return new ProviderError(raw, "credit_balance", status);
  }
  if (lower.includes("invalid x-api-key") || lower.includes("authentication")) {
    return new ProviderError(raw, "invalid_api_key", status);
  }
  if (status === 429 || lower.includes("rate limit")) {
    return new ProviderError(raw, "rate_limit", status);
  }
  if (status === 529 || lower.includes("overloaded")) {
    return new ProviderError(raw, "overloaded", status);
  }
  if (lower.includes("content") && lower.includes("policy")) {
    return new ProviderError(raw, "content_policy", status);
  }
  return new ProviderError(raw, "unknown", status);
}

export const anthropicProvider: Provider = {
  async *streamChat(opts: StreamOptions): AsyncIterable<StreamEvent> {
    const client = getClient();
    // Anthropic expects user/assistant alternating messages with a separate system field.
    const mapped = opts.messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    }));
    let stream;
    try {
      stream = client.messages.stream(
        {
          model: opts.model,
          system: opts.system,
          messages: mapped,
          max_tokens: opts.maxTokens ?? 4096,
        },
        { signal: opts.signal }
      );
    } catch (e) {
      throw mapAnthropicError(e);
    }

    let full = "";
    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          if (text) {
            full += text;
            yield { type: "delta", text };
          }
        }
      }
      yield { type: "done", fullText: full };
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },
};
