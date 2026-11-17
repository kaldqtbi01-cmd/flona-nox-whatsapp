import { query } from './db.js';
import { getChatIdByJid } from './chats.js';

export type OutboxStatus = 'pending' | 'approved' | 'sent' | 'rejected' | 'failed' | 'cancelled';

export interface OutboxItem {
  id: string;
  chatId: string;
  chatJid: string;
  chatName: string | null;
  body: string;
  status: OutboxStatus;
  requiresApproval: boolean;
  createdAt: Date;
  sentAt: Date | null;
}

export interface DraftReplyInput {
  chatJid: string;
  body: string;
  /**
   * Defaults to true. The outbound pipeline always forces approval;
   * this flag is kept for storage-level callers/tests.
   */
  requiresApproval?: boolean;
  /** Initial status (default `pending`). Use `approved` for auto-send chats. */
  status?: OutboxStatus;
}

function mapOutboxRow(row: {
  id: string;
  chat_id: string;
  chat_jid: string;
  chat_name: string | null;
  body: string;
  status: OutboxStatus;
  requires_approval: boolean;
  created_at: Date;
  sent_at: Date | null;
}): OutboxItem {
  return {
    id: row.id,
    chatId: row.chat_id,
    chatJid: row.chat_jid,
    chatName: row.chat_name,
    body: row.body,
    status: row.status,
    requiresApproval: row.requires_approval,
    createdAt: new Date(row.created_at),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  };
}

/**
 * Insert a staged reply into the outbox (does not send on WhatsApp).
 * Prefer `draftReplyAndNotify` from the agent outbound pipeline.
 */
export async function draftReply(input: DraftReplyInput): Promise<OutboxItem> {
  const body = input.body.trim();
  if (!body) {
    throw new Error('draft_reply body must be non-empty');
  }

  const chatId = await getChatIdByJid(input.chatJid);
  if (!chatId) {
    throw new Error(`Unknown chatJid: ${input.chatJid}`);
  }

  const requiresApproval = input.requiresApproval ?? true;
  const status = input.status ?? 'pending';
  const result = await query<{
    id: string;
    chat_id: string;
    chat_jid: string;
    chat_name: string | null;
    body: string;
    status: OutboxStatus;
    requires_approval: boolean;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `
      INSERT INTO outbox (chat_id, body, status, requires_approval)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        chat_id,
        $5::text AS chat_jid,
        (SELECT name FROM chats WHERE id = $1) AS chat_name,
        body,
        status,
        requires_approval,
        created_at,
        sent_at
    `,
    [chatId, body, status, requiresApproval, input.chatJid],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to insert outbox draft');
  }

  return mapOutboxRow(row);
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  const result = await query<{
    id: string;
    chat_id: string;
    chat_jid: string;
    chat_name: string | null;
    body: string;
    status: OutboxStatus;
    requires_approval: boolean;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `
      SELECT
        o.id,
        o.chat_id,
        c.jid AS chat_jid,
        c.name AS chat_name,
        o.body,
        o.status,
        o.requires_approval,
        o.created_at,
        o.sent_at
      FROM outbox o
      INNER JOIN chats c ON c.id = o.chat_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? mapOutboxRow(row) : null;
}

export async function listOutbox(
  options: {
    status?: OutboxStatus | OutboxStatus[];
    limit?: number;
  } = {},
): Promise<OutboxItem[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const statuses = options.status
    ? Array.isArray(options.status)
      ? options.status
      : [options.status]
    : undefined;

  const result = await query<{
    id: string;
    chat_id: string;
    chat_jid: string;
    chat_name: string | null;
    body: string;
    status: OutboxStatus;
    requires_approval: boolean;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `
      SELECT
        o.id,
        o.chat_id,
        c.jid AS chat_jid,
        c.name AS chat_name,
        o.body,
        o.status,
        o.requires_approval,
        o.created_at,
        o.sent_at
      FROM outbox o
      INNER JOIN chats c ON c.id = o.chat_id
      WHERE ($1::text[] IS NULL OR o.status = ANY($1::text[]))
      ORDER BY o.created_at ASC
      LIMIT $2
    `,
    [statuses ?? null, limit],
  );

  return result.rows.map(mapOutboxRow);
}

export async function updateOutboxBody(id: string, body: string): Promise<OutboxItem | null> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('outbox body must be non-empty');
  }
  const result = await query<{
    id: string;
    chat_id: string;
    chat_jid: string;
    chat_name: string | null;
    body: string;
    status: OutboxStatus;
    requires_approval: boolean;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `
      UPDATE outbox o
      SET body = $2
      FROM chats c
      WHERE o.id = $1
        AND o.chat_id = c.id
        AND o.status = 'pending'
      RETURNING
        o.id,
        o.chat_id,
        c.jid AS chat_jid,
        c.name AS chat_name,
        o.body,
        o.status,
        o.requires_approval,
        o.created_at,
        o.sent_at
    `,
    [id, trimmed],
  );
  const row = result.rows[0];
  return row ? mapOutboxRow(row) : null;
}

export async function setOutboxStatus(
  id: string,
  status: OutboxStatus,
  options: { fromStatuses?: OutboxStatus[] } = {},
): Promise<OutboxItem | null> {
  const fromStatuses = options.fromStatuses ?? ['pending', 'approved', 'failed'];
  const result = await query<{
    id: string;
    chat_id: string;
    chat_jid: string;
    chat_name: string | null;
    body: string;
    status: OutboxStatus;
    requires_approval: boolean;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `
      UPDATE outbox o
      SET
        status = $2,
        sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE o.sent_at END
      FROM chats c
      WHERE o.id = $1
        AND o.chat_id = c.id
        AND o.status = ANY($3::text[])
      RETURNING
        o.id,
        o.chat_id,
        c.jid AS chat_jid,
        c.name AS chat_name,
        o.body,
        o.status,
        o.requires_approval,
        o.created_at,
        o.sent_at
    `,
    [id, status, fromStatuses],
  );
  const row = result.rows[0];
  return row ? mapOutboxRow(row) : null;
}

export async function approveOutbox(id: string): Promise<OutboxItem | null> {
  return setOutboxStatus(id, 'approved', { fromStatuses: ['pending'] });
}

export async function rejectOutbox(id: string): Promise<OutboxItem | null> {
  return setOutboxStatus(id, 'rejected', { fromStatuses: ['pending'] });
}

/**
 * Immediate send is gated until the safety/approval pipeline is enabled.
 * Callers should use {@link draftReply} instead.
 */
export function sendReply(_input: {
  chatJid: string;
  body: string;
}): Promise<{ sent: false; gated: true; reason: string }> {
  return Promise.resolve({
    sent: false,
    gated: true,
    reason:
      'send_reply is gated: immediate WhatsApp send is disabled until the safety approval flow is enabled. Use draft_reply to stage a message in the outbox.',
  });
}
