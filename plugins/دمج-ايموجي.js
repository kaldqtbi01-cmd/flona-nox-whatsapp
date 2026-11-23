import getEmojiMixUrl from 'emoji-mixer'
import { imageToWebp } from '../lib/atlas-local-converters.js'

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const IMAGE_TIMEOUT_MS = 15_000

async function downloadMixPng(url, fetchImpl) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.gstatic.com' ||
      !parsed.pathname.startsWith('/android/keyboard/emojikitchen/')) {
    throw new Error('مصدر صورة الدمج غير مسموح.')
  }

  const response = await fetchImpl(parsed.href, {
    redirect: 'error',
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('تعذر جلب صورة الدمج؛ قد لا تكون هذه التركيبة متاحة الآن.')
  if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('image/png')) {
    throw new Error('أعاد مصدر الدمج ملفًا غير متوقع.')
  }

  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new Error('حجم صورة الدمج أكبر من الحد المسموح.')
  }
  if (!response.body) throw new Error('استجابة صورة الدمج فارغة.')

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new Error('حجم صورة الدمج أكبر من الحد المسموح.')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock?.()
  }

  if (!size) throw new Error('صورة الدمج فارغة.')
  return Buffer.concat(chunks, size)
}

export async function createEmojiStickerBuffer(leftEmoji, rightEmoji, {
  fetchImpl = fetch,
  convert = imageToWebp,
} = {}) {
  let url
  try {
    url = getEmojiMixUrl(leftEmoji, rightEmoji)
  } catch {
    throw new Error('لم أجد تركيبة مدعومة لهذين الإيموجيين؛ جرّب إيموجيين مختلفين.')
  }
  if (!url) throw new Error('لم أجد تركيبة مدعومة لهذين الإيموجيين؛ جرّب إيموجيين مختلفين.')
  const png = await downloadMixPng(url, fetchImpl)
  const webp = await convert(png)
  if (!Buffer.isBuffer(webp) || webp.length < 100 ||
      webp.subarray(0, 4).toString('ascii') !== 'RIFF' || webp.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('فشل تحويل صورة الدمج إلى ملصق WebP.')
  }
  return webp
}

const handler = async (m, { conn, text = '' }) => {
  const emojis = text.trim().split(/\s*\+\s*|\s+/u).filter(Boolean)
  if (emojis.length !== 2) return m.reply('اكتب إيموجيين بهذا الشكل: .دمج 😀+🐱')

  try {
    const webp = await createEmojiStickerBuffer(emojis[0], emojis[1])
    await conn.sendMessage(m.chat, { sticker: webp }, { quoted: m })
  } catch (error) {
    console.error('[EMOJI MIX]', error?.message || error)
    await m.reply(`❌ ${error?.message || 'تعذر إنشاء الملصق.'}`)
  }
}

handler.help = ['دمج <إيموجي>+<إيموجي>']
handler.tags = ['sticker']
handler.command = /^دمج$/i
handler.limit = 1

export default handler
