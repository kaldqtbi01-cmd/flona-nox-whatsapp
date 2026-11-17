import { query } from './db.js';

export interface ChatListItem {
  chatJid: string;
  name: string | null;
  isGroup: boolean;
  lastMessageAt: Date | null;
}

/**
 * List chats ordered by most recent activity.
 */
export async function listChats(options: { limit?: number } = {}): Promise<ChatListItem[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const result = await query<{
    jid: string;
    name: string | null;
    is_group: boolean;
    last_message_at: Date | null;
  }>(
    `
      SELECT jid, name, is_group, last_message_at
      FROM chats
      ORDER BY last_message_at DESC NULLS LAST, name ASC NULLS LAST
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    chatJid: row.jid,
    name: row.name,
    isGroup: row.is_group,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
  }));
}

/**
 * Resolve a chat UUID by JID.
 */
export async function getChatIdByJid(chatJid: string): Promise<string | null> {
  const result = await query<{ id: string }>(`SELECT id FROM chats WHERE jid = $1`, [chatJid]);
  return result.rows[0]?.id ?? null;
}

/**
 * Load a single chat by JID.
 */
export async function getChatByJid(chatJid: string): Promise<ChatListItem | null> {
  const result = await query<{
    jid: string;
    name: string | null;
    is_group: boolean;
    last_message_at: Date | null;
  }>(
    `
      SELECT jid, name, is_group, last_message_at
      FROM chats
      WHERE jid = $1
      LIMIT 1
    `,
    [chatJid],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    chatJid: row.jid,
    name: row.name,
    isGroup: row.is_group,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
  };
}

/**
 * Human-readable chat label for owner notifications.
 */
export function formatChatLabel(
  chat: Pick<ChatListItem, 'chatJid' | 'name'> | null | undefined,
): string {
  if (!chat) {
    return 'unknown chat';
  }
  if (chat.name?.trim()) {
    return `${chat.name.trim()} (${chat.chatJid})`;
  }
  return chat.chatJid;
}
