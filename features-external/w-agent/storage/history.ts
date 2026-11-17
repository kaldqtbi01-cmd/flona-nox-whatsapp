import type { PoolClient } from 'pg';

import type { MessageDirection } from '../bridge/provider.js';
import { query, withTransaction } from './db.js';
import type { UpsertChatInput, UpsertContactInput } from './messages.js';

export interface HistoryMessageInput {
  waMessageId: string;
  chatJid: string;
  senderJid?: string;
  direction: MessageDirection;
  msgType: string;
  body?: string;
  mediaMime?: string;
  timestamp: Date;
  raw: unknown;
}

export interface BulkHistoryInput {
  contacts: UpsertContactInput[];
  chats: UpsertChatInput[];
  messages: HistoryMessageInput[];
}

export interface BulkHistoryResult {
  contactsUpserted: number;
  chatsUpserted: number;
  messagesInserted: number;
  messagesSkipped: number;
  /** Newly inserted text messages eligible for embedding. */
  insertedTextMessages: { messageId: string; text: string }[];
  /** Chat JIDs that received at least one newly inserted message. */
  affectedChatJids: string[];
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

/**
 * Idempotently bulk-upsert contacts, chats, and messages from a history sync chunk.
 */
export async function bulkPersistHistory(input: BulkHistoryInput): Promise<BulkHistoryResult> {
  return withTransaction(async (client) => {
    const contactIds = new Map<string, string>();
    const chatIds = new Map<string, string>();
    const affectedChatJids = new Set<string>();
    const insertedTextMessages: { messageId: string; text: string }[] = [];
    let messagesInserted = 0;
    let messagesSkipped = 0;

    for (const contact of input.contacts) {
      const id = await upsertContact(client, contact);
      contactIds.set(contact.jid, id);
    }

    for (const chat of input.chats) {
      const id = await upsertChat(client, chat);
      chatIds.set(chat.jid, id);
    }

    for (const message of input.messages) {
      let chatId = chatIds.get(message.chatJid);
      if (!chatId) {
        chatId = await upsertChat(client, {
          jid: message.chatJid,
          isGroup: message.chatJid.endsWith('@g.us'),
          lastMessageAt: message.timestamp,
        });
        chatIds.set(message.chatJid, chatId);
      }

      let senderId: string | null = null;
      if (message.senderJid) {
        senderId = contactIds.get(message.senderJid) ?? null;
        if (!senderId) {
          senderId = await upsertContact(client, {
            jid: message.senderJid,
            phone: message.senderJid.split('@')[0],
          });
          contactIds.set(message.senderJid, senderId);
        }
      }

      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO messages (
            wa_message_id,
            chat_id,
            sender_id,
            direction,
            msg_type,
            body,
            media_mime,
            "timestamp",
            raw_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          ON CONFLICT (wa_message_id) DO NOTHING
          RETURNING id
        `,
        [
          message.waMessageId,
          chatId,
          senderId,
          message.direction,
          message.msgType,
          message.body ?? null,
          message.mediaMime ?? null,
          message.timestamp,
          JSON.stringify(message.raw ?? {}),
        ],
      );

      const insertedId = inserted.rows[0]?.id;
      if (insertedId) {
        messagesInserted += 1;
        affectedChatJids.add(message.chatJid);
        if (message.msgType === 'text' && message.body?.trim()) {
          insertedTextMessages.push({ messageId: insertedId, text: message.body.trim() });
        }
      } else {
        messagesSkipped += 1;
      }
    }

    return {
      contactsUpserted: contactIds.size,
      chatsUpserted: chatIds.size,
      messagesInserted,
      messagesSkipped,
      insertedTextMessages,
      affectedChatJids: [...affectedChatJids],
    };
  });
}

export interface OldestChatMessage {
  waMessageId: string;
  timestamp: Date;
  fromMe: boolean;
  chatJid: string;
}

/**
 * Load the oldest persisted message for a chat (anchor for on-demand history).
 */
export async function getOldestMessageForChat(chatJid: string): Promise<OldestChatMessage | null> {
  const result = await query<{
    wa_message_id: string;
    timestamp: Date;
    from_me: boolean | null;
    chat_jid: string;
  }>(
    `
      SELECT
        m.wa_message_id,
        m.timestamp,
        COALESCE((m.raw_json -> 'key' ->> 'fromMe')::boolean, false) AS from_me,
        c.jid AS chat_jid
      FROM messages m
      INNER JOIN chats c ON c.id = m.chat_id
      WHERE c.jid = $1
      ORDER BY m.timestamp ASC
      LIMIT 1
    `,
    [chatJid],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    waMessageId: row.wa_message_id,
    timestamp: row.timestamp,
    fromMe: Boolean(row.from_me),
    chatJid: row.chat_jid,
  };
}
