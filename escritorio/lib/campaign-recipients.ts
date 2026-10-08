import getPool from "@/lib/db-manu";
import { resolveWaPhone } from "@/lib/phone-normalize";

export interface CampaignRecipient {
  contactId: number;
  jid: string;
  name: string;
  phone: string;
}

interface ContactRow {
  id: number;
  nombre: string;
  telefono: string | null;
  pais: string | null;
}

const MAX_MANUAL_CONTACTS = 10;

function mapRowsToRecipients(rows: ContactRow[]): CampaignRecipient[] {
  const seenJids = new Set<string>();
  const recipients: CampaignRecipient[] = [];

  for (const c of rows) {
    const { jid, compatible } = resolveWaPhone(c.telefono, c.pais);
    if (!compatible || !jid || seenJids.has(jid)) continue;
    seenJids.add(jid);
    recipients.push({ contactId: c.id, jid, name: c.nombre, phone: c.telefono ?? "" });
  }

  return recipients;
}

// Resuelve los contactos del usuario que matchean alguna de las etiquetas dadas
// (OR entre etiquetas) y tienen un número de WhatsApp válido, deduplicados por jid.
export async function resolveCampaignRecipients(
  userId: number,
  tagNames: string[]
): Promise<CampaignRecipient[]> {
  if (!tagNames.length) return [];

  const pool = getPool();
  const orClauses = tagNames.map(() => "JSON_CONTAINS(etiquetas, ?)").join(" OR ");
  const params: (string | number)[] = [userId, ...tagNames.map((t) => JSON.stringify(t))];

  const [rows] = (await pool.execute(
    `SELECT id, nombre, telefono, pais FROM mm_contacts WHERE user_id = ? AND (${orClauses})`,
    params
  )) as any;

  return mapRowsToRecipients(rows as ContactRow[]);
}

// Resuelve destinatarios a partir de una selección manual de contactos (hasta
// MAX_MANUAL_CONTACTS), con la misma validación de número de WhatsApp.
export async function resolveCampaignRecipientsByIds(
  userId: number,
  contactIds: number[]
): Promise<CampaignRecipient[]> {
  const ids = [...new Set(contactIds)].slice(0, MAX_MANUAL_CONTACTS);
  if (ids.length === 0) return [];

  const pool = getPool();
  const placeholders = ids.map(() => "?").join(", ");

  const [rows] = (await pool.execute(
    `SELECT id, nombre, telefono, pais FROM mm_contacts WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids]
  )) as any;

  return mapRowsToRecipients(rows as ContactRow[]);
}

export { MAX_MANUAL_CONTACTS };
