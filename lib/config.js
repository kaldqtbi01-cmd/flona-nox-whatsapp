export const FFMPEG_CONFIG = Object.freeze({
  executable: process.env.FFMPEG_PATH || 'ffmpeg',
  timeoutMs: 45_000,
  maxInputBytes: 30 * 1024 * 1024,
  maxOutputBytes: 24 * 1024 * 1024,
  maxThumbnailBytes: 6 * 1024 * 1024,
  maxRedirects: 3,
})
