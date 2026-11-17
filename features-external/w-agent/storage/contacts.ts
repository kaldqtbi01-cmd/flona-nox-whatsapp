import { query } from './db.js';

export interface ContactInfo {
  contactJid: string;
  name: string | null;
  phone: string | null;
  isBusiness: boolean;
  createdAt: Date;
}

function mapContactRow(row: {
  jid: string;
  name: string | null;
  phone: string | null;
  is_business: boolean;
  created_at: Date;
}): ContactInfo {
  return {
    contactJid: row.jid,
    name: row.name,
    phone: row.phone,
    isBusiness: row.is_business,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Look up a contact by WhatsApp JID (or phone-form JID).
 */
export async function getContactInfo(jid: string): Promise<ContactInfo | null> {
  const result = await query<{
    jid: string;
    name: string | null;
    phone: string | null;
    is_business: boolean;
    created_at: Date;
  }>(
    `
      SELECT jid, name, phone, is_business, created_at
      FROM contacts
      WHERE jid = $1
         OR phone = $2
      LIMIT 1
    `,
    [jid, jid.split('@')[0] ?? jid],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapContactRow(row);
}

/**
 * Search contacts by name, phone, or JID substring (case-insensitive).
 */
export async function searchContacts(
  queryText: string,
  options: { limit?: number } = {},
): Promise<ContactInfo[]> {
  const trimmed = queryText.trim();
  if (!trimmed) {
    return [];
  }

  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const pattern = `%${trimmed.replace(/[%_\\]/g, '\\$&')}%`;

  const result = await query<{
    jid: string;
    name: string | null;
    phone: string | null;
    is_business: boolean;
    created_at: Date;
  }>(
    `
      SELECT jid, name, phone, is_business, created_at
      FROM contacts
      WHERE name ILIKE $1 ESCAPE '\\'
         OR phone ILIKE $1 ESCAPE '\\'
         OR jid ILIKE $1 ESCAPE '\\'
      ORDER BY name ASC NULLS LAST, phone ASC NULLS LAST
      LIMIT $2
    `,
    [pattern, limit],
  );

  return result.rows.map(mapContactRow);
}
