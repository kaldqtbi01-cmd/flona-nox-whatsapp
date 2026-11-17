import type { PoolClient } from 'pg';

import type { IngestableMessageType } from '../bridge/message-filters.js';
import { withTransaction } from './db.js';

export interface UpsertContactInput {
  jid: string;
  name?: string;
  phone?: string;
  isBusiness?: boolean;
}

export interface UpsertChatInput {
  jid: string;
  name?: string;
  isGroup: boolean;
  lastMessageAt: Date;
}

export interface InsertMessageInput {
  waMessageId: string;
  chatId: string;
  senderId: string | null;
  direction: 'inbound' | 'outbound';
  msgType: IngestableMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  timestamp: Date;
  raw: unknown;
}

export interface PersistedMessageIds {
  contactId: string | null;
  chatId: string;
  messageId: string | null;
  inserted: boolean;
}

async function upsertContact(client: PoolClient, input: UpsertContactInput): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO contacts (jid, name, phone, is_business)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (jid) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, contacts.name),
        phone = COALESCE(EXCLUDED.phone, contacts.phone),
        is_business = EXCLUDED.is_business
      RETURNING id
    `,
    [input.jid, input.name ?? null, input.phone ?? null, input.isBusiness ?? false],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Failed to upsert contact for jid=${input.jid}`);
  }
  return id;
}

async function upsertChat(client: PoolClient, input: UpsertChatInput): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO chats (jid, name, is_group, last_message_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (jid) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, chats.name),
        is_group = EXCLUDED.is_group,
        last_message_at = GREATEST(chats.last_message_at, EXCLUDED.last_message_at)
      RETURNING id
    `,
    [input.jid, input.name ?? null, input.isGroup, input.lastMessageAt],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Failed to upsert chat for jid=${input.jid}`);
  }
  return id;
}

async function insertMessage(
  client: PoolClient,
  input: InsertMessageInput,
): Promise<{ id: string; inserted: boolean }> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO messages (
        wa_message_id,
        chat_id,
        sender_id,
        direction,
        msg_type,
        body,
        media_url,
        media_mime,
        "timestamp",
        raw_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING id
    `,
    [
      input.waMessageId,
      input.chatId,
      input.senderId,
      input.direction,
      input.msgType,
      input.body ?? null,
      input.mediaUrl ?? null,
      input.mediaMime ?? null,
      input.timestamp,
      JSON.stringify(input.raw ?? {}),
    ],
  );

  if (result.rows[0]?.id) {
    return { id: result.rows[0].id, inserted: true };
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM messages WHERE wa_message_id = $1`,
    [input.waMessageId],
  );
  const existingId = existing.rows[0]?.id;
  if (!existingId) {
    throw new Error(`Message conflict without existing row for wa_message_id=${input.waMessageId}`);
  }
  return { id: existingId, inserted: false };
}

export interface PersistInboundMessageInput {
  contact: UpsertContactInput;
  chat: UpsertChatInput;
  message: Omit<InsertMessageInput, 'chatId' | 'senderId'>;
}

/**
 * Upsert contact + chat and insert the message (deduped by wa_message_id).
 */
export async function persistInboundMessage(
  input: PersistInboundMessageInput,
): Promise<PersistedMessageIds> {
  return withTransaction(async (client) => {
    const contactId = await upsertContact(client, input.contact);
    const chatId = await upsertChat(client, input.chat);
    const { id: messageId, inserted } = await insertMessage(client, {
      ...input.message,
      chatId,
      senderId: contactId,
    });

    return { contactId, chatId, messageId, inserted };
  });
}
