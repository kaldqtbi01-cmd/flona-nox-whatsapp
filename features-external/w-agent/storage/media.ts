import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { BufferJSON, downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

import { config } from '../config.js';
import { logger } from '../logger.js';
import type { IngestableMessageType } from '../bridge/message-filters.js';

const log = logger.child({ component: 'media' });

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/ogg; codecs=opus': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const TYPE_FALLBACK_EXTENSION: Record<IngestableMessageType, string> = {
  text: '.txt',
  image: '.bin',
  audio: '.bin',
  video: '.bin',
  document: '.bin',
  sticker: '.webp',
};

export function extensionForMedia(
  mime: string | undefined,
  msgType: IngestableMessageType,
): string {
  if (mime) {
    const normalized = mime.split(';')[0]?.trim().toLowerCase();
    if (normalized && MIME_EXTENSIONS[normalized]) {
      return MIME_EXTENSIONS[normalized];
    }
  }
  return TYPE_FALLBACK_EXTENSION[msgType];
}

/**
 * Persist media bytes under MEDIA_DIR and return the stored file URL/path.
 */
export async function storeMediaFile(options: {
  waMessageId: string;
  msgType: IngestableMessageType;
  mime?: string;
  buffer: Buffer;
  mediaDir?: string;
}): Promise<string> {
  const mediaDir = path.resolve(options.mediaDir ?? config.MEDIA_DIR);
  await mkdir(mediaDir, { recursive: true });

  const extension = extensionForMedia(options.mime, options.msgType);
  const fileName = `${options.waMessageId}${extension}`;
  const absolutePath = path.join(mediaDir, fileName);
  await writeFile(absolutePath, options.buffer);

  log.info({ absolutePath, bytes: options.buffer.byteLength }, 'Stored inbound media');
  return absolutePath;
}

/**
 * Download media for a serialized Baileys WAMessage using downloadMediaMessage.
 */
export async function downloadBaileysMedia(raw: unknown): Promise<{
  buffer: Buffer;
  mime?: string;
} | null> {
  const message = JSON.parse(JSON.stringify(raw), BufferJSON.reviver) as WAMessage;
  if (!message.message) {
    return null;
  }

  const buffer = await downloadMediaMessage(
    message,
    'buffer',
    {},
    {
      logger: pino({ level: 'silent' }),
      reuploadRequest: (msg) => Promise.resolve(msg),
    },
  );

  const content = message.message;
  const mime =
    content.imageMessage?.mimetype ??
    content.videoMessage?.mimetype ??
    content.audioMessage?.mimetype ??
    content.documentMessage?.mimetype ??
    content.stickerMessage?.mimetype ??
    undefined;

  return { buffer, mime: mime ?? undefined };
}

export type MediaDownloader = (raw: unknown) => Promise<{ buffer: Buffer; mime?: string } | null>;
