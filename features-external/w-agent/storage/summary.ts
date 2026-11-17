import OpenAI from 'openai';

import { config } from '../config.js';
import { logger } from '../logger.js';
import { query } from './db.js';

const log = logger.child({ component: 'summary' });

/** Max completion tokens for a chat summary (~500 tokens). */
export const SUMMARY_MAX_TOKENS = 500;

/** Max messages folded into a single summary update call. */
export const SUMMARY_BATCH_SIZE = 60;

const SYSTEM_PROMPT = `You maintain a rolling long-term memory summary for a WhatsApp chat.
Produce a dense summary covering:
- topics discussed
- participants and their roles
- open questions
- decisions made

Rules:
- MERGE with the previous summary; do not discard older facts unless contradicted.
- Prefer compact prose or tight bullets; stay within ~500 tokens.
- Omit greetings, small talk, and ephemeral noise.
- If there is no previous summary, create the first one from the new messages only.
- Output only the updated summary text.`;

export interface ChatSummary {
  chatJid: string;
  summary: string | null;
  updatedAt: Date | null;
  summarizedUntil: Date | null;
}

export interface SummaryMessage {
  messageId: string;
  senderName: string;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
}

export interface SummarizeInput {
  previousSummary: string | null;
  messages: SummaryMessage[];
  model: string;
}

export type SummarizeChatFn = (input: SummarizeInput) => Promise<string>;

export interface UpdateChatSummaryOptions {
  /** Summarize even when fewer than SUMMARY_EVERY_N_MESSAGES are pending. */
  force?: boolean;
  /** Override OpenAI call (tests). */
  summarizeFn?: SummarizeChatFn;
  /** Max messages to fold in this update. */
  batchSize?: number;
  threshold?: number;
}

export interface UpdateChatSummaryResult {
  updated: boolean;
  reason: 'updated' | 'below_threshold' | 'no_messages' | 'empty_model_output';
  summary: string | null;
  messagesFolded: number;
}

let openaiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  return (openaiClient ??= new OpenAI({ apiKey: config.OPENAI_API_KEY }));
}

function formatMessageLine(message: SummaryMessage): string {
  const ts = message.timestamp.toISOString();
  const sender = message.direction === 'outbound' ? 'Me' : message.senderName;
  return `[${ts}] ${sender}: ${message.body}`;
}

function buildUserPrompt(previousSummary: string | null, messages: SummaryMessage[]): string {
  const previous = previousSummary?.trim()
    ? previousSummary.trim()
    : '(none — this is the first summary)';
  const transcript = messages.map(formatMessageLine).join('\n');
  return `Previous summary:
${previous}

New messages since last summary:
${transcript}

Return the merged updated summary.`;
}

/**
 * Call OpenAI to merge previous summary + new messages into an updated summary.
 */
export async function summarizeChatWithOpenAI(input: SummarizeInput): Promise<string> {
  const response = await getOpenAIClient().chat.completions.create({
    model: input.model,
    temperature: 0.2,
    max_tokens: SUMMARY_MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input.previousSummary, input.messages) },
    ],
  });

  return response.choices[0]?.message.content?.trim() ?? '';
}

/**
 * Load the stored rolling summary for a chat (null when none yet).
 */
export async function getChatSummary(chatJid: string): Promise<ChatSummary> {
  const result = await query<{
    summary: string;
    updated_at: Date;
    summarized_until: Date | null;
  }>(
    `
      SELECT am.summary, am.updated_at, am.summarized_until
      FROM agent_memory am
      INNER JOIN chats c ON c.id = am.chat_id
      WHERE c.jid = $1
      LIMIT 1
    `,
    [chatJid],
  );

  const row = result.rows[0];
  if (!row) {
    return {
      chatJid,
      summary: null,
      updatedAt: null,
      summarizedUntil: null,
    };
  }

  return {
    chatJid,
    summary: row.summary,
    updatedAt: new Date(row.updated_at),
    summarizedUntil: row.summarized_until ? new Date(row.summarized_until) : null,
  };
}

/**
 * Count messages in a chat not yet folded into agent_memory.summary.
 */
export async function countUnsummarizedMessages(chatJid: string): Promise<number> {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM messages m
      INNER JOIN chats c ON c.id = m.chat_id
      LEFT JOIN agent_memory am ON am.chat_id = c.id
      WHERE c.jid = $1
        AND m.body IS NOT NULL
        AND TRIM(m.body) <> ''
        AND (
          am.summarized_until IS NULL
          OR m.timestamp > am.summarized_until
        )
    `,
    [chatJid],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function loadUnsummarizedMessages(
  chatJid: string,
  limit: number,
): Promise<{ chatId: string; messages: SummaryMessage[] } | null> {
  const chatResult = await query<{ id: string }>(`SELECT id FROM chats WHERE jid = $1`, [chatJid]);
  const chatId = chatResult.rows[0]?.id;
  if (!chatId) {
    return null;
  }

  const result = await query<{
    message_id: string;
    sender_name: string | null;
    body: string;
    timestamp: Date;
    direction: 'inbound' | 'outbound';
  }>(
    `
      SELECT
        m.id AS message_id,
        COALESCE(ct.name, ct.phone, c.name, 'unknown') AS sender_name,
        m.body,
        m.timestamp,
        m.direction
      FROM messages m
      INNER JOIN chats c ON c.id = m.chat_id
      LEFT JOIN contacts ct ON ct.id = m.sender_id
      LEFT JOIN agent_memory am ON am.chat_id = c.id
      WHERE c.jid = $1
        AND m.body IS NOT NULL
        AND TRIM(m.body) <> ''
        AND (
          am.summarized_until IS NULL
          OR m.timestamp > am.summarized_until
        )
      ORDER BY m.timestamp ASC
      LIMIT $2
    `,
    [chatJid, limit],
  );

  return {
    chatId,
    messages: result.rows.map((row) => ({
      messageId: row.message_id,
      senderName: row.sender_name ?? 'unknown',
      body: row.body,
      timestamp: new Date(row.timestamp),
      direction: row.direction,
    })),
  };
}

async function upsertChatSummary(options: {
  chatId: string;
  summary: string;
  summarizedUntil: Date;
}): Promise<void> {
  await query(
    `
      INSERT INTO agent_memory (chat_id, summary, summarized_until, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (chat_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        summarized_until = EXCLUDED.summarized_until,
        updated_at = NOW()
    `,
    [options.chatId, options.summary, options.summarizedUntil],
  );
}

/**
 * Update agent_memory.summary for a chat by merging new messages with the previous summary.
 * Runs automatically when enough new messages accumulate, or immediately when `force` is set.
 */
export async function updateChatSummary(
  chatJid: string,
  options: UpdateChatSummaryOptions = {},
): Promise<UpdateChatSummaryResult> {
  const threshold = options.threshold ?? config.SUMMARY_EVERY_N_MESSAGES;
  const batchSize = options.batchSize ?? SUMMARY_BATCH_SIZE;
  const force = options.force ?? false;
  const summarize = options.summarizeFn ?? summarizeChatWithOpenAI;

  const pending = await countUnsummarizedMessages(chatJid);
  if (pending === 0) {
    const current = await getChatSummary(chatJid);
    return {
      updated: false,
      reason: 'no_messages',
      summary: current.summary,
      messagesFolded: 0,
    };
  }

  if (!force && pending < threshold) {
    const current = await getChatSummary(chatJid);
    return {
      updated: false,
      reason: 'below_threshold',
      summary: current.summary,
      messagesFolded: 0,
    };
  }

  const loaded = await loadUnsummarizedMessages(chatJid, batchSize);
  if (!loaded || loaded.messages.length === 0) {
    const current = await getChatSummary(chatJid);
    return {
      updated: false,
      reason: 'no_messages',
      summary: current.summary,
      messagesFolded: 0,
    };
  }

  const previous = await getChatSummary(chatJid);
  const merged = (
    await summarize({
      previousSummary: previous.summary,
      messages: loaded.messages,
      model: config.SUMMARY_MODEL,
    })
  ).trim();

  if (!merged) {
    return {
      updated: false,
      reason: 'empty_model_output',
      summary: previous.summary,
      messagesFolded: 0,
    };
  }

  const last = loaded.messages[loaded.messages.length - 1];
  if (!last) {
    return {
      updated: false,
      reason: 'no_messages',
      summary: previous.summary,
      messagesFolded: 0,
    };
  }

  await upsertChatSummary({
    chatId: loaded.chatId,
    summary: merged,
    summarizedUntil: last.timestamp,
  });

  log.info(
    {
      chatJid,
      messagesFolded: loaded.messages.length,
      hadPrevious: Boolean(previous.summary),
    },
    'Updated chat summary',
  );

  return {
    updated: true,
    reason: 'updated',
    summary: merged,
    messagesFolded: loaded.messages.length,
  };
}

/**
 * True when a chat has enough unsummarized messages to warrant an update.
 */
export async function chatNeedsSummaryUpdate(
  chatJid: string,
  threshold: number = config.SUMMARY_EVERY_N_MESSAGES,
): Promise<boolean> {
  const pending = await countUnsummarizedMessages(chatJid);
  return pending >= threshold;
}

/** Exported for tests — builds the user prompt passed to the model. */
export function buildSummaryUserPromptForTests(
  previousSummary: string | null,
  messages: SummaryMessage[],
): string {
  return buildUserPrompt(previousSummary, messages);
}
