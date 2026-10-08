import { Router } from "express";
import { getSession } from "../session-store";
import { runCampaign, cancelCampaign, CampaignRecipient } from "../lib/campaign-runner";

const router = Router();

function isValidJID(jid: string): boolean {
  return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid);
}

router.post("/:userId/campaigns/start", async (req, res) => {
  const { userId } = req.params;
  const session = getSession(userId);
  if (!session || session.status !== "connected")
    return res.status(400).json({ error: "Sesión no conectada" });

  const { campaignId, recipients, messages, imageUrl } = req.body as {
    campaignId: number;
    recipients: CampaignRecipient[];
    messages: [string, string, string];
    imageUrl?: string;
  };

  if (!campaignId || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: "campaignId y recipients son requeridos" });
  }
  if (!Array.isArray(messages) || messages.length !== 3 || messages.some((m) => typeof m !== "string" || !m.trim())) {
    return res.status(400).json({ error: "Se requieren 3 variantes de mensaje" });
  }
  for (const r of recipients) {
    if (!r.jid || !isValidJID(r.jid) || !r.recipientId) {
      return res.status(400).json({ error: `Destinatario inválido: ${JSON.stringify(r)}` });
    }
  }

  res.status(202).json({ ok: true });

  runCampaign(userId, campaignId, recipients, messages, imageUrl).catch((e) => {
    console.error(`[campaign] ❌ runCampaign crashed for campaign ${campaignId}:`, e);
  });
});

router.post("/:userId/campaigns/:campaignId/cancel", async (req, res) => {
  const campaignId = Number(req.params.campaignId);
  if (!campaignId) return res.status(400).json({ error: "campaignId inválido" });
  cancelCampaign(campaignId);
  res.json({ ok: true });
});

export default router;
