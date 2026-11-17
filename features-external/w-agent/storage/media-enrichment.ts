import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

import { config } from '../config.js';
import { logger } from '../logger.js';
import { getSetting, setSetting } from './settings.js';

const log = logger.child({ component: 'media-enrichment' });

export const MEDIA_COST_SETTINGS_KEY = 'media_enrichment_costs';

export type MediaCostKind = 'transcribe' | 'caption';

export interface MediaDailyCosts {
  /** UTC calendar date `YYYY-MM-DD`. */
  date: string;
  transcribeUsd: number;
  captionUsd: number;
}

export type TranscribeAudioFn = (
  buffer: Buffer,
  mime: string,
) => Promise<{ text: string; durationSeconds?: number }>;

export type CaptionImageFn = (buffer: Buffer, mime: string) => Promise<{ caption: string }>;

export interface MediaEnrichmentDeps {
  transcribeAudioFn?: TranscribeAudioFn;
  captionImageFn?: CaptionImageFn;
  getCosts?: () => Promise<MediaDailyCosts>;
  saveCosts?: (costs: MediaDailyCosts) => Promise<void>;
  now?: () => Date;
}

let openaiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  return (openaiClient ??= new OpenAI({ apiKey: config.OPENAI_API_KEY }));
}

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isTranscribableAudioMime(mime: string | undefined): boolean {
  if (!mime) {
    return false;
  }
  const normalized = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized === 'audio/ogg' || normalized === 'audio/opus') {
    return true;
  }
  // WhatsApp voice notes often arrive as audio/ogg; codecs=opus
  return mime.toLowerCase().includes('opus') || mime.toLowerCase().includes('ogg');
}

export function isCaptionableImageMime(mime: string | undefined): boolean {
  if (!mime) {
    return false;
  }
  const normalized = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return normalized.startsWith('image/') && normalized !== 'image/gif';
}

/**
 * Rough duration estimate for cost gating when Whisper does not return duration.
 * Assumes ~20KB/s for compressed voice notes.
 */
export function estimateAudioMinutes(byteLength: number): number {
  return Math.max(0.05, byteLength / 20_000);
}

export function estimateTranscribeCostUsd(byteLength: number, durationSeconds?: number): number {
  const minutes =
    typeof durationSeconds === 'number' && durationSeconds > 0
      ? Math.max(0.05, durationSeconds / 60)
      : estimateAudioMinutes(byteLength);
  return minutes * config.TRANSCRIBE_USD_PER_MINUTE;
}

export function estimateCaptionCostUsd(): number {
  return config.CAPTION_USD_PER_IMAGE;
}

export async function loadMediaDailyCosts(
  now: () => Date = () => new Date(),
): Promise<MediaDailyCosts> {
  const today = utcDateKey(now());
  const stored = await getSetting<Partial<MediaDailyCosts>>(MEDIA_COST_SETTINGS_KEY);
  if (stored?.date !== today) {
    return { date: today, transcribeUsd: 0, captionUsd: 0 };
  }
  return {
    date: today,
    transcribeUsd: typeof stored.transcribeUsd === 'number' ? stored.transcribeUsd : 0,
    captionUsd: typeof stored.captionUsd === 'number' ? stored.captionUsd : 0,
  };
}

export async function saveMediaDailyCosts(costs: MediaDailyCosts): Promise<void> {
  await setSetting(MEDIA_COST_SETTINGS_KEY, costs);
}

/**
 * Returns true when spending `estimatedUsd` would stay within the kind's daily cap.
 */
export async function canSpendMediaBudget(
  kind: MediaCostKind,
  estimatedUsd: number,
  deps: MediaEnrichmentDeps = {},
): Promise<{ allowed: boolean; spent: number; cap: number }> {
  const getCosts = deps.getCosts ?? (() => loadMediaDailyCosts(deps.now));
  const costs = await getCosts();
  const spent = kind === 'transcribe' ? costs.transcribeUsd : costs.captionUsd;
  const cap =
    kind === 'transcribe' ? config.TRANSCRIBE_DAILY_CAP_USD : config.CAPTION_DAILY_CAP_USD;
  return {
    allowed: spent + estimatedUsd <= cap + 1e-9,
    spent,
    cap,
  };
}

export async function recordMediaSpend(
  kind: MediaCostKind,
  costUsd: number,
  deps: MediaEnrichmentDeps = {},
): Promise<MediaDailyCosts> {
  const getCosts = deps.getCosts ?? (() => loadMediaDailyCosts(deps.now));
  const saveCosts = deps.saveCosts ?? saveMediaDailyCosts;
  const costs = await getCosts();
  const today = utcDateKey(deps.now?.() ?? new Date());
  const next: MediaDailyCosts =
    costs.date === today ? { ...costs } : { date: today, transcribeUsd: 0, captionUsd: 0 };

  if (kind === 'transcribe') {
    next.transcribeUsd += costUsd;
  } else {
    next.captionUsd += costUsd;
  }
  await saveCosts(next);
  return next;
}

export async function transcribeAudioWithWhisper(
  buffer: Buffer,
  mime: string,
): Promise<{ text: string; durationSeconds?: number }> {
  const extension =
    mime.toLowerCase().includes('opus') && !mime.toLowerCase().includes('ogg') ? 'opus' : 'ogg';
  const mimeType = mime.split(';')[0]?.trim() ?? 'audio/ogg';
  const file = await toFile(buffer, `voice.${extension}`, {
    type: mimeType,
  });

  const response = await getOpenAIClient().audio.transcriptions.create({
    file,
    model: config.WHISPER_MODEL,
    response_format: 'verbose_json',
  });

  const text = response.text.trim();
  const durationSeconds =
    typeof response.duration === 'number' && Number.isFinite(response.duration)
      ? response.duration
      : undefined;
  return { text, durationSeconds };
}

export async function captionImageWithVision(
  buffer: Buffer,
  mime: string,
): Promise<{ caption: string }> {
  const normalizedMime = mime.split(';')[0]?.trim() ?? 'image/jpeg';
  const dataUrl = `data:${normalizedMime};base64,${buffer.toString('base64')}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: config.VISION_MODEL,
    temperature: 0.2,
    max_tokens: 160,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this image in 1-2 concise sentences for later search recall. Mention notable objects, text on boards/screens, and the scene. Do not invent details.',
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  });

  const caption = response.choices[0]?.message.content?.trim() ?? '';
  return { caption };
}

/**
 * Merge an existing WhatsApp image caption with a vision-model description.
 */
export function mergeImageBody(existingCaption: string | undefined, visionCaption: string): string {
  const existing = existingCaption?.trim() ?? '';
  const vision = visionCaption.trim();
  if (!vision && !existing) {
    return '';
  }
  if (!vision) {
    return existing;
  }
  if (!existing) {
    return `[image] ${vision}`;
  }
  return `${existing}\n[image] ${vision}`;
}

export function formatVoiceTranscriptBody(transcript: string): string {
  const text = transcript.trim();
  if (!text) {
    return '';
  }
  return `[voice note] ${text}`;
}

/**
 * Transcribe a voice note when enabled and under the daily spend cap.
 */
export async function enrichAudioTranscript(
  buffer: Buffer,
  mime: string,
  deps: MediaEnrichmentDeps = {},
): Promise<{ body: string; costUsd: number } | null> {
  if (!config.TRANSCRIBE_AUDIO) {
    return null;
  }
  if (!isTranscribableAudioMime(mime)) {
    return null;
  }

  const estimated = estimateTranscribeCostUsd(buffer.byteLength);
  const budget = await canSpendMediaBudget('transcribe', estimated, deps);
  if (!budget.allowed) {
    log.warn(
      { spent: budget.spent, cap: budget.cap, estimated },
      'Skipping transcription — daily cap reached',
    );
    return null;
  }

  const transcribe = deps.transcribeAudioFn ?? transcribeAudioWithWhisper;
  try {
    const result = await transcribe(buffer, mime);
    const text = formatVoiceTranscriptBody(result.text);
    if (!text) {
      return null;
    }
    const costUsd = estimateTranscribeCostUsd(buffer.byteLength, result.durationSeconds);
    await recordMediaSpend('transcribe', costUsd, deps);
    log.info({ costUsd, chars: text.length }, 'Transcribed voice note');
    return { body: text, costUsd };
  } catch (error) {
    log.error({ err: error }, 'Voice note transcription failed');
    return null;
  }
}

/**
 * Caption an image when enabled and under the daily spend cap.
 */
export async function enrichImageCaption(
  buffer: Buffer,
  mime: string,
  existingCaption: string | undefined,
  deps: MediaEnrichmentDeps = {},
): Promise<{ body: string; costUsd: number } | null> {
  if (!config.CAPTION_IMAGES) {
    return null;
  }
  if (!isCaptionableImageMime(mime)) {
    return null;
  }

  const estimated = estimateCaptionCostUsd();
  const budget = await canSpendMediaBudget('caption', estimated, deps);
  if (!budget.allowed) {
    log.warn(
      { spent: budget.spent, cap: budget.cap, estimated },
      'Skipping image caption — daily cap reached',
    );
    return null;
  }

  const captionFn = deps.captionImageFn ?? captionImageWithVision;
  try {
    const result = await captionFn(buffer, mime);
    const body = mergeImageBody(existingCaption, result.caption);
    if (!body) {
      return null;
    }
    const costUsd = estimateCaptionCostUsd();
    await recordMediaSpend('caption', costUsd, deps);
    log.info({ costUsd, chars: body.length }, 'Captioned inbound image');
    return { body, costUsd };
  } catch (error) {
    log.error({ err: error }, 'Image captioning failed');
    return null;
  }
}
