import sharp from 'sharp'
import { FFMPEG_CONFIG } from './config.js'
import { downloadAudioBuffer } from './ffmpeg.js'

const MAX_IMAGE_PIXELS = 30_000_000
const MAX_DATA_URI_CHARS = 24 * 1024 * 1024

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

export async function getThumb(url) {
  if (!url) return Buffer.alloc(0)
  try {
    const buffer = await downloadAudioBuffer(url, FFMPEG_CONFIG.maxThumbnailBytes)
    if (!buffer.length) return Buffer.alloc(0)
    const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata()
    if (!metadata.width || !metadata.height) return Buffer.alloc(0)
    return await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
  } catch { return Buffer.alloc(0) }
}

export async function createHighQualityThumbnail(_conn, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return Buffer.alloc(0)
  try {
    return await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
  } catch { return Buffer.alloc(0) }
}

function safeDataUri(value, allowedMime) {
  const text = String(value || '')
  if (text.length > MAX_DATA_URI_CHARS) return ''
  const match = text.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/i)
  if (!match || !allowedMime.includes(match[1].toLowerCase())) return ''
  return text
}

export function createMusicPlayer({ title, artist, duration, audioSrc, imageSrc, lyrics = [] } = {}) {
  const safeAudio = safeDataUri(audioSrc, ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac'])
  const safeImage = safeDataUri(imageSrc, ['image/jpeg', 'image/png', 'image/webp'])
  const rows = Array.isArray(lyrics) ? lyrics.slice(0, 400).map(line => {
    const text = typeof line === 'string' ? line : line?.text
    if (!text) return ''
    const seconds = Number(line?.time)
    const stamp = Number.isFinite(seconds) && seconds >= 0 ? `<span>${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}</span>` : ''
    return `<li>${stamp}${escapeHtml(text)}</li>`
  }).filter(Boolean).join('') : ''
  return `<!doctype html><html lang="ar"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111827;color:#f8fafc;font:16px system-ui;padding:20px}.card{max-width:560px;margin:auto;background:#1f2937;border-radius:18px;padding:18px}.cover{width:100%;max-height:320px;object-fit:cover;border-radius:12px}.muted{color:#cbd5e1}audio{width:100%;margin:16px 0}ul{list-style:none;padding:0;max-height:280px;overflow:auto}li{padding:7px 0;border-bottom:1px solid #374151}li span{color:#a78bfa;margin-inline-end:10px}</style><main class="card">${safeImage ? `<img class="cover" alt="غلاف" src="${safeImage}">` : ''}<h1>${escapeHtml(title || 'موسيقى')}</h1><p class="muted">${escapeHtml(artist || 'غير معروف')} · ${escapeHtml(duration || '')}</p>${safeAudio ? `<audio controls preload="none" src="${safeAudio}"></audio>` : '<p>المقطع الصوتي غير متاح.</p>'}<ul>${rows}</ul></main></html>`
}
