import OpenAI from 'openai';

import { config } from '../config.js';
import { logger } from '../logger.js';
import { query } from './db.js';

const log = logger.child({ component: 'embeddings' });

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export type EmbedTextsFn = (texts: string[], model?: string) => Promise<number[][]>;

let openaiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  return (openaiClient ??= new OpenAI({ apiKey: config.OPENAI_API_KEY }));
}

/**
 * Generate embeddings via OpenAI (batched in a single request).
 */
export async function embedTexts(
  texts: string[],
  model: string = config.EMBEDDING_MODEL,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await getOpenAIClient().embeddings.create({
    model,
    input: texts,
  });

  const sorted = [...response.data].sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}

/**
 * Format a vector for pgvector input.
 */
export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

/**
 * Upsert an embedding row for a message.
 */
export async function storeEmbedding(options: {
  messageId: string;
  embedding: number[];
  model?: string;
}): Promise<void> {
  const model = options.model ?? config.EMBEDDING_MODEL;
  await query(
    `
      INSERT INTO embeddings (message_id, vector, model)
      VALUES ($1, $2::vector, $3)
      ON CONFLICT (message_id, model) DO UPDATE
      SET vector = EXCLUDED.vector
    `,
    [options.messageId, toPgVectorLiteral(options.embedding), model],
  );
  log.debug({ messageId: options.messageId, model }, 'Stored message embedding');
}

/**
 * Embed and store a batch of message texts.
 */
export async function embedAndStoreMessages(
  items: { messageId: string; text: string }[],
  deps: { embedTextsFn?: EmbedTextsFn; model?: string } = {},
): Promise<number> {
  const usable = items.filter((item) => item.text.trim().length > 0);
  if (usable.length === 0) {
    return 0;
  }

  const model = deps.model ?? config.EMBEDDING_MODEL;
  const embed = deps.embedTextsFn ?? embedTexts;
  const vectors = await embed(
    usable.map((item) => item.text),
    model,
  );

  for (let i = 0; i < usable.length; i += 1) {
    const item = usable[i];
    const embedding = vectors[i];
    if (!item || !embedding) {
      continue;
    }
    await storeEmbedding({
      messageId: item.messageId,
      embedding,
      model,
    });
  }

  return usable.length;
}
