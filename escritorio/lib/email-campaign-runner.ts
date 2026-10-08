import getPool from "@/lib/db-manu";
import { getEmailAccount, buildTransport } from "@/lib/email-transport";

const PUBLIC_URL = process.env.NL360_FRONTEND_URL || "https://nl360.site";

interface Recipient {
  id: number;
  contact_id: number;
  email: string;
}

interface MessageVariant {
  variant: number;
  subject: string;
  body_html: string;
}

interface CampaignControl {
  cancelled: boolean;
}

const activeCampaigns = new Map<number, CampaignControl>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs(): number {
  return 3000 + Math.floor(Math.random() * 12001);
}

function pickVariant(lastVariant: number): number {
  const choices = [0, 1, 2].filter((v) => v !== lastVariant);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function cancelEmailCampaign(campaignId: number): void {
  const control = activeCampaigns.get(campaignId);
  if (control) control.cancelled = true;
}

export async function runEmailCampaign(userId: number, campaignId: number): Promise<void> {
  const pool = getPool();
  const control: CampaignControl = { cancelled: false };
  activeCampaigns.set(campaignId, control);

  try {
    const account = await getEmailAccount(userId);
    if (!account || account.status !== "connected") {
      await pool.execute(`UPDATE mm_email_campaigns SET status = 'failed' WHERE id = ?`, [campaignId]);
      return;
    }
    const transport = buildTransport(account);

    const [messageRows] = (await pool.execute(
      `SELECT variant, subject, body_html FROM mm_email_campaign_messages WHERE campaign_id = ? ORDER BY variant ASC`,
      [campaignId]
    )) as any;
    const messages = messageRows as MessageVariant[];

    const [recipientRows] = (await pool.execute(
      `SELECT id, contact_id, email FROM mm_email_campaign_recipients WHERE campaign_id = ? AND status = 'pending'`,
      [campaignId]
    )) as any;
    const recipients = recipientRows as Recipient[];

    let lastVariant = -1;

    for (let i = 0; i < recipients.length; i++) {
      if (control.cancelled) break;
      const recipient = recipients[i];

      const variantIdx = pickVariant(lastVariant);
      lastVariant = variantIdx;
      const message = messages[variantIdx];

      const pixel = `<img src="${PUBLIC_URL}/api/margarita/crm/campaigns-email/track?r=${recipient.id}" width="1" height="1" style="display:none" alt="" />`;

      try {
        await transport.sendMail({
          from: account.from_name ? `"${account.from_name}" <${account.from_email}>` : account.from_email,
          to: recipient.email,
          subject: message.subject,
          html: message.body_html + pixel,
        });
        await pool.execute(
          `UPDATE mm_email_campaign_recipients SET status = 'sent', variant_used = ?, sent_at = NOW() WHERE id = ?`,
          [message.variant, recipient.id]
        );
        await pool.execute(`UPDATE mm_email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`, [campaignId]);
      } catch (e) {
        console.error(`[email-campaign] ❌ Error sending to ${recipient.email} (campaign ${campaignId}):`, e);
        await pool.execute(
          `UPDATE mm_email_campaign_recipients SET status = 'failed', error = ? WHERE id = ?`,
          [String(e), recipient.id]
        );
        await pool.execute(`UPDATE mm_email_campaigns SET failed_count = failed_count + 1 WHERE id = ?`, [campaignId]);
      }

      if (i < recipients.length - 1 && !control.cancelled) {
        await sleep(randomDelayMs());
      }
    }
  } finally {
    activeCampaigns.delete(campaignId);
    await pool.execute(
      `UPDATE mm_email_campaigns SET status = ?, completed_at = NOW() WHERE id = ? AND status = 'sending'`,
      [control.cancelled ? "cancelled" : "completed", campaignId]
    );
  }
}
