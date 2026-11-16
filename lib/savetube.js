import ytdl from '@distube/ytdl-core'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const MAX_ATTEMPTS = 2

function isYouTubeUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname.toLowerCase())
  } catch { return false }
}

/** Resolve a YouTube audio-only format. No downloader service key is embedded. */
export async function savetubeRetry(videoUrl, { downloadType = 'audio', quality = '128kbps' } = {}) {
  if (downloadType !== 'audio' || !isYouTubeUrl(videoUrl)) throw new Error('الرابط أو نوع الوسائط غير مدعوم')
  let lastError
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const info = await ytdl.getInfo(videoUrl, { requestOptions: { timeout: 15_000 } })
      const formats = info.formats.filter(format => format.hasAudio && !format.hasVideo && format.url)
      if (!formats.length) throw new Error('لا يتوفر مسار صوت مباشر لهذا الفيديو')
      const wantedBitrate = Number.parseInt(String(quality), 10) || 128
      formats.sort((a, b) => Math.abs((a.audioBitrate || 0) - wantedBitrate) - Math.abs((b.audioBitrate || 0) - wantedBitrate))
      return { url: formats[0].url, quality: formats[0].audioBitrate || wantedBitrate }
    } catch (error) {
      lastError = error
      if (attempt + 1 < MAX_ATTEMPTS) await sleep(700 * (attempt + 1))
    }
  }
  throw new Error(`تعذر الحصول على رابط الصوت: ${lastError?.message || 'خطأ خدمة'}`)
}
