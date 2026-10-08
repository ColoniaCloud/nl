import getPool from "@/lib/db-manu";

export interface EmailCampaignRecipient {
  contactId: number;
  email: string;
  name: string;
}

interface ContactRow {
  id: number;
  nombre: string;
  email: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MANUAL_CONTACTS = 10;

function mapRowsToRecipients(rows: ContactRow[]): EmailCampaignRecipient[] {
  const seenEmails = new Set<string>();
  const recipients: EmailCampaignRecipient[] = [];

  for (const c of rows) {
    const email = c.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seenEmails.has(email)) continue;
    seenEmails.add(email);
    recipients.push({ contactId: c.id, email, name: c.nombre });
  }

  return recipients;
}

export async function resolveEmailCampaignRecipients(
  userId: number,
  tagNames: string[]
): Promise<EmailCampaignRecipient[]> {
  if (!tagNames.length) return [];

  const pool = getPool();
  const orClauses = tagNames.map(() => "JSON_CONTAINS(etiquetas, ?)").join(" OR ");
  const params: (string | number)[] = [userId, ...tagNames.map((t) => JSON.stringify(t))];

  const [rows] = (await pool.execute(
    `SELECT id, nombre, email FROM mm_contacts WHERE user_id = ? AND (${orClauses})`,
    params
  )) as any;

  return mapRowsToRecipients(rows as ContactRow[]);
}

export async function resolveEmailCampaignRecipientsByIds(
  userId: number,
  contactIds: number[]
): Promise<EmailCampaignRecipient[]> {
  const ids = [...new Set(contactIds)].slice(0, MAX_MANUAL_CONTACTS);
  if (ids.length === 0) return [];

  const pool = getPool();
  const placeholders = ids.map(() => "?").join(", ");

  const [rows] = (await pool.execute(
    `SELECT id, nombre, email FROM mm_contacts WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids]
  )) as any;

  return mapRowsToRecipients(rows as ContactRow[]);
}

export { MAX_MANUAL_CONTACTS };
