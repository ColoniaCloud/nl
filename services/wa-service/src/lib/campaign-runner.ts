import { getSession, emitEvent } from "../session-store";
import { registerPendingAck } from "./campaign-ack-registry";

export interface CampaignRecipient {
  recipientId: number;
  jid: string;
}

interface CampaignControl {
  cancelled: boolean;
}

const activeCampaigns = new Map<number, CampaignControl>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Delay aleatorio entre envíos, uniforme en [3000, 15000] ms.
function randomDelayMs(): number {
  return 3000 + Math.floor(Math.random() * 12001);
}

// Elige una variante (0-2) distinta a la última usada, para que nunca se
// repita el mismo mensaje dos veces seguidas.
function pickVariant(lastVariant: number): number {
  const choices = [0, 1, 2].filter((v) => v !== lastVariant);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function cancelCampaign(campaignId: number): void {
  const control = activeCampaigns.get(campaignId);
  if (control) control.cancelled = true;
}

export async function runCampaign(
  userId: string,
  campaignId: number,
  recipients: CampaignRecipient[],
  messages: [string, string, string],
  imageUrl?: string
): Promise<void> {
  const control: CampaignControl = { cancelled: false };
  activeCampaigns.set(campaignId, control);

  let lastVariant = -1;

  try {
    for (let i = 0; i < recipients.length; i++) {
      if (control.cancelled) break;

      const recipient = recipients[i];
      const session = getSession(userId);
      if (!session || session.status !== "connected") {
        await emitEvent(userId, "CAMPAIGN_MESSAGE_FAILED", {
          campaignId,
          recipientId: recipient.recipientId,
          error: "Sesión de WhatsApp no conectada",
        });
        continue;
      }

      const variant = pickVariant(lastVariant);
      lastVariant = variant;
      const text = messages[variant];

      try {
        const result = imageUrl
          ? await session.socket.sendMessage(recipient.jid, {
              image: { url: `${process.env.NL360_URL}${imageUrl}` },
              caption: text,
            })
          : await session.socket.sendMessage(recipient.jid, { text });
        const waMessageId = result?.key?.id;
        if (waMessageId) {
          registerPendingAck(waMessageId, { userId, campaignId, recipientId: recipient.recipientId });
        }
        await emitEvent(userId, "CAMPAIGN_MESSAGE_SENT", {
          campaignId,
          recipientId: recipient.recipientId,
          variantUsed: variant + 1,
          waMessageId: waMessageId ?? null,
        });
      } catch (e) {
        console.error(`[campaign] ❌ Error sending to ${recipient.jid} (campaign ${campaignId}):`, e);
        await emitEvent(userId, "CAMPAIGN_MESSAGE_FAILED", {
          campaignId,
          recipientId: recipient.recipientId,
          error: String(e),
        });
      }

      if (i < recipients.length - 1 && !control.cancelled) {
        await sleep(randomDelayMs());
      }
    }
  } finally {
    activeCampaigns.delete(campaignId);
    await emitEvent(userId, control.cancelled ? "CAMPAIGN_CANCELLED" : "CAMPAIGN_COMPLETED", { campaignId });
  }
}
