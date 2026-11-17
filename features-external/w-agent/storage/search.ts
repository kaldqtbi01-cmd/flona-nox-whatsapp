import { config } from '../config.js';
import { logger } from '../logger.js';
import { query } from './db.js';
import { embedTexts, toPgVectorLiteral, type EmbedTextsFn } from './embeddings.js';

const log = logger.child({ component: 'search' });

export interface SearchMessagesOptions {
  chatJid?: string;
  limit?: number;
}

export interface SearchMessageHit {
  messageId: string;
  waMessageId: string;
  chatJid: string;
  senderName: string;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  vectorScore: number;
  ftsScore: number;
  recencyScore: number;
  score: number;
}

export interface ChatContextMessage {
  messageId: string;
  waMessageId: string;
  senderName: string;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  /** e.g. `[2026-07-24 12:00 UTC] Alice: hello` */
  formatted: string;
}

export interface SearchDeps {
  embedTextsFn?: EmbedTextsFn;
  now?: () => Date;
}

interface VectorRow {
  message_id: string;
  wa_message_id: string;
  chat_jid: string;
  sender_name: string | null;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  distance: number | string;
}

interface FtsRow {
  message_id: string;
  wa_message_id: string;
  chat_jid: string;
  sender_name: string | null;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  rank: number | string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function recencyScore(timestamp: Date, now: Date): number {
  const ageMs = Math.max(0, now.getTime() - timestamp.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Half-life ~14 days.
  return clamp01(Math.exp(-ageDays / 14));
}

function normalizeFtsRanks(ranks: number[]): Map<number, number> {
  const max = Math.max(...ranks, 0);
  const map = new Map<number, number>();
  for (const rank of ranks) {
    map.set(rank, max > 0 ? rank / max : 0);
  }
  return map;
}

/**
 * Hybrid retrieval over chat history: pgvector cosine similarity + Postgres FTS,
 * merged and re-ranked with a recency prior.
 */
export async function searchMessages(
  queryText: string,
  options: SearchMessagesOptions = {},
  deps: SearchDeps = {},
): Promise<SearchMessageHit[]> {
  const limit = Math.max(1, options.limit ?? 20);
  const candidateLimit = Math.max(limit * 3, 30);
  const trimmed = queryText.trim();
  if (!trimmed) {
    return [];
  }

  const embed = deps.embedTextsFn ?? embedTexts;
  const now = deps.now?.() ?? new Date();
  const [queryEmbedding] = await embed([trimmed], config.EMBEDDING_MODEL);
  if (!queryEmbedding) {
    return [];
  }

  const vectorLiteral = toPgVectorLiteral(queryEmbedding);
  const vectorParams: unknown[] = [vectorLiteral, candidateLimit, config.EMBEDDING_MODEL];
  const vectorChatClause = options.chatJid ? 'AND c.jid = $4' : '';
  if (options.chatJid) {
    vectorParams.push(options.chatJid);
  }

  const vectorResult = await query<VectorRow>(
    `
      SELECT
        m.id AS message_id,
        m.wa_message_id,
        c.jid AS chat_jid,
        COALESCE(ct.name, ct.phone, m.sender_id::text, 'unknown') AS sender_name,
        m.body,
        m.timestamp,
        m.direction,
        (e.vector <=> $1::vector) AS distance
      FROM embeddings e
      INNER JOIN messages m ON m.id = e.message_id
      INNER JOIN chats c ON c.id = m.chat_id
      LEFT JOIN contacts ct ON ct.id = m.sender_id
      WHERE m.body IS NOT NULL
        AND e.model = $3
        ${vectorChatClause}
      ORDER BY e.vector <=> $1::vector
      LIMIT $2
    `,
    vectorParams,
  );

  const ftsParams: unknown[] = [trimmed, candidateLimit];
  const ftsChatClause = options.chatJid ? 'AND c.jid = $3' : '';
  if (options.chatJid) {
    ftsParams.push(options.chatJid);
  }

  const ftsResult = await query<FtsRow>(
    `
      SELECT
        m.id AS message_id,
        m.wa_message_id,
        c.jid AS chat_jid,
        COALESCE(ct.name, ct.phone, m.sender_id::text, 'unknown') AS sender_name,
        m.body,
        m.timestamp,
        m.direction,
        ts_rank_cd(
          to_tsvector('english', coalesce(m.body, '')),
          plainto_tsquery('english', $1)
        ) AS rank
      FROM messages m
      INNER JOIN chats c ON c.id = m.chat_id
      LEFT JOIN contacts ct ON ct.id = m.sender_id
      WHERE m.body IS NOT NULL
        AND to_tsvector('english', coalesce(m.body, '')) @@ plainto_tsquery('english', $1)
        ${ftsChatClause}
      ORDER BY rank DESC, m.timestamp DESC
      LIMIT $2
    `,
    ftsParams,
  );

  const ftsNorm = normalizeFtsRanks(ftsResult.rows.map((row) => Number(row.rank)));
  const merged = new Map<string, SearchMessageHit>();

  for (const row of vectorResult.rows) {
    if (!row.body) {
      continue;
    }
    const vectorScore = clamp01(1 - Number(row.distance));
    const recency = recencyScore(new Date(row.timestamp), now);
    merged.set(row.message_id, {
      messageId: row.message_id,
      waMessageId: row.wa_message_id,
      chatJid: row.chat_jid,
      senderName: row.sender_name ?? 'unknown',
      body: row.body,
      timestamp: new Date(row.timestamp),
      direction: row.direction,
      vectorScore,
      ftsScore: 0,
      recencyScore: recency,
      score: 0,
    });
  }

  for (const row of ftsResult.rows) {
    if (!row.body) {
      continue;
    }
    const ftsScore = ftsNorm.get(Number(row.rank)) ?? 0;
    const existing = merged.get(row.message_id);
    const recency = recencyScore(new Date(row.timestamp), now);
    if (existing) {
      existing.ftsScore = ftsScore;
      existing.recencyScore = Math.max(existing.recencyScore, recency);
    } else {
      merged.set(row.message_id, {
        messageId: row.message_id,
        waMessageId: row.wa_message_id,
        chatJid: row.chat_jid,
        senderName: row.sender_name ?? 'unknown',
        body: row.body,
        timestamp: new Date(row.timestamp),
        direction: row.direction,
        vectorScore: 0,
        ftsScore,
        recencyScore: recency,
        score: 0,
      });
    }
  }

  const hits = [...merged.values()].map((hit) => ({
    ...hit,
    score: 0.55 * hit.vectorScore + 0.25 * hit.ftsScore + 0.2 * hit.recencyScore,
  }));

  hits.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const top = hits.slice(0, limit);
  log.debug({ query: trimmed, chatJid: options.chatJid, hits: top.length }, 'searchMessages');
  return top;
}

function formatContextLine(message: { timestamp: Date; senderName: string; body: string }): string {
  const ts = message.timestamp
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
  return `[${ts}] ${message.senderName}: ${message.body}`;
}

/**
 * Return the last n messages in a chat, formatted with sender names and timestamps.
 */
export async function getChatContext(chatJid: string, n: number): Promise<ChatContextMessage[]> {
  const limit = Math.max(1, n);
  const result = await query<{
    message_id: string;
    wa_message_id: string;
    sender_name: string | null;
    body: string | null;
    timestamp: Date;
    direction: 'inbound' | 'outbound';
  }>(
    `
      SELECT
        m.id AS message_id,
        m.wa_message_id,
        COALESCE(ct.name, ct.phone, c.name, 'unknown') AS sender_name,
        m.body,
        m.timestamp,
        m.direction
      FROM messages m
      INNER JOIN chats c ON c.id = m.chat_id
      LEFT JOIN contacts ct ON ct.id = m.sender_id
      WHERE c.jid = $1
      ORDER BY m.timestamp DESC
      LIMIT $2
    `,
    [chatJid, limit],
  );

  // Chronological order for LLM context.
  return result.rows
    .slice()
    .reverse()
    .map((row) => {
      const body = row.body ?? '';
      const senderName = row.direction === 'outbound' ? 'Me' : (row.sender_name ?? 'unknown');
      const timestamp = new Date(row.timestamp);
      return {
        messageId: row.message_id,
        waMessageId: row.wa_message_id,
        senderName,
        body,
        timestamp,
        direction: row.direction,
        formatted: formatContextLine({ timestamp, senderName, body }),
      };
    });
}
