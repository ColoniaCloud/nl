// Unified provider interface for MentorIA subagents.
//
// Both providers (Anthropic and Venice) expose the same shape:
//   streamChat({ system, messages, model, maxTokens, signal }) -> AsyncIterable<StreamEvent>
//
// The stream yields plain-text deltas progressively, and a final "done" event.
// Errors throw with a .code property mapped to a stable set.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string };

export interface StreamOptions {
  system: string;
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface Provider {
  streamChat(opts: StreamOptions): AsyncIterable<StreamEvent>;
}

export class ProviderError extends Error {
  code:
    | "credit_balance"
    | "invalid_api_key"
    | "rate_limit"
    | "overloaded"
    | "content_policy"
    | "timeout"
    | "network"
    | "unknown";
  status?: number;
  constructor(message: string, code: ProviderError["code"], status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function mapErrorToUserMessage(err: unknown): string {
  if (err instanceof ProviderError) {
    switch (err.code) {
      case "credit_balance":
        return "El servicio de IA no tiene saldo disponible. Contacta al administrador.";
      case "invalid_api_key":
        return "La configuracion del servicio de IA es invalida. Contacta al administrador.";
      case "rate_limit":
        return "Demasiadas consultas seguidas. Espera unos segundos y reintenta.";
      case "overloaded":
        return "El servicio de IA esta saturado. Reintenta en un momento.";
      case "content_policy":
        return "Tu mensaje fue rechazado por politicas de contenido del proveedor. Reformulalo.";
      case "timeout":
        return "La respuesta tardo demasiado. Reintenta en un momento.";
      case "network":
        return "Error de red contactando al servicio de IA. Reintenta en un momento.";
      default:
        return "Ocurrio un error inesperado con el servicio de IA. Reintenta.";
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg || "Error desconocido.";
}
