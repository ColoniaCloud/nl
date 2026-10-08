// Puente entre campaign-runner (que envía y sabe el waMessageId → recipient)
// y session-store (que escucha messages.update con los acks de Baileys),
// evita un import circular entre ambos módulos.

interface PendingAck {
  userId: string;
  campaignId: number;
  recipientId: number;
}

const pending = new Map<string, PendingAck>();

export function registerPendingAck(waMessageId: string, info: PendingAck): void {
  pending.set(waMessageId, info);
}

export function resolveAck(waMessageId: string): PendingAck | undefined {
  return pending.get(waMessageId);
}
