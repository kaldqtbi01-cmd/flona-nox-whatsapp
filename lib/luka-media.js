const MAX_IMAGES_PER_REQUEST = 2
const MEDIA_PATTERN = /(?:^|[\s،:])((?:صورة|صوره|صور|فيديو|مقطع(?:\s+فيديو)?|كليب|أغنية|اغنية|أغاني|اغاني|نشيد))(?=$|[\s،:؛.!؟])/u
const REQUEST_PATTERN = /(ارسل|أرسل|ارسلي|أرسلي|هات|هاتي|جيب|جيبي|أعطني|اعطني|اعطيني|عطني|وريني|أبغى|ابغى|أبي|ابي|أريد|اريد|ممكن|تقدري|تقدر|ابعت|أبعت|ودي|نفسي)/u
const ARABIC_DIGITS = Object.freeze({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' })

function westernDigits(value) {
  return String(value).replace(/[٠-٩]/g, digit => ARABIC_DIGITS[digit])
}

function cleanQuery(value) {
  return String(value || '')
    .replace(/^[\s،,:：؛.!؟?\-]+/u, '')
    .replace(/^(?:(?:من\s+)?(?:pinterest|بنترست|بينترست)|لي|لنا|من فضلك|لو سمحت|عن|حول|من)\s+/iu, '')
    .replace(/\s+(?:عشان كذا|عشان|علشان|بسبب|لأن|لان|كي|لكي)\s+[\s\S]*$/u, '')
    .replace(/\s+(?:من\s+)?(?:pinterest|بنترست|بينترست)$/iu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function parseLukaMediaRequest(text) {
  const value = String(text || '').replace(/@[\d]+/g, ' ').trim()
  if (!value || !REQUEST_PATTERN.test(value)) return null
  const mediaMatch = MEDIA_PATTERN.exec(value)
  if (!mediaMatch) return null

  const word = mediaMatch[1]
  const kind = /^(?:صورة|صوره|صور)$/u.test(word)
    ? 'image'
    : /^(?:فيديو|مقطع|كليب)/u.test(word)
      ? 'video'
      : 'song'
  const rawQuery = value.slice(mediaMatch.index + mediaMatch[0].length)
  const query = cleanQuery(rawQuery)
  const countMatch = kind === 'image' ? value.match(/([0-9٠-٩]{1,2})\s*(?:صور|صورة|صوره)/u) : null
  const requestedCount = countMatch ? Number(westernDigits(countMatch[1])) : MAX_IMAGES_PER_REQUEST

  return {
    kind,
    query,
    count: kind === 'image' ? Math.max(1, Math.min(MAX_IMAGES_PER_REQUEST, requestedCount || MAX_IMAGES_PER_REQUEST)) : 1,
  }
}

function assertPinterestImageUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('رابط صورة Pinterest غير صالح.') }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || !(host === 'pinimg.com' || host.endsWith('.pinimg.com'))) {
    throw new Error('تجاهلت نتيجة صورة ليست مستضافة على Pinterest.')
  }
  return url.toString()
}

export async function sendLukaMediaRequest({ request, m, conn, pinterestSearch, youtubeDownload }) {
  if (!request?.query) {
    const prompt = request?.kind === 'image'
      ? 'ما موضوع الصور التي تريدها؟ مثال: «لوكا أرسلي 3 صور قطط».'
      : request?.kind === 'video'
        ? 'ما اسم الفيديو الذي تريده؟ مثال: «لوكا أرسلي فيديو عن صنعاء».'
        : 'ما اسم الأغنية أو الفنان؟ مثال: «لوكا أرسلي أغنية لفيروز».'
    await conn.sendMessage(m.chat, { text: prompt }, { quoted: m })
    return
  }

  if (request.kind === 'image') {
    await conn.sendMessage(m.chat, { text: `📌 أبحث في Pinterest عن «${request.query}» وأرسل حتى ${request.count} صور.` }, { quoted: m })
    const results = await pinterestSearch(request.query, request.count)
    const valid = (Array.isArray(results) ? results : []).slice(0, request.count)
    if (!valid.length) throw new Error('لم أجد صورًا مناسبة على Pinterest؛ جرّب وصفًا آخر.')
    for (const [index, item] of valid.entries()) {
      const imageUrl = assertPinterestImageUrl(item?.image_large_url)
      const title = String(item?.title || request.query).replace(/[\r\n]+/g, ' ').slice(0, 180)
      await conn.sendMessage(m.chat, {
        image: { url: imageUrl },
        caption: `📌 Pinterest — ${index + 1}/${valid.length}\n${title}`,
      }, { quoted: m })
    }
    return
  }

  const audioOnly = request.kind === 'song'
  const label = audioOnly ? 'الأغنية' : 'الفيديو'
  await conn.sendMessage(m.chat, { text: `⏳ أبحث عن ${label} «${request.query}» وأجهزه للإرسال...` }, { quoted: m })
  const media = await youtubeDownload(request.query, { audioOnly })
  try {
    const title = String(media.title || request.query).replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 100) || 'flona-media'
    if (audioOnly) {
      await conn.sendMessage(m.chat, {
        audio: { url: media.filePath },
        mimetype: media.mimetype || 'audio/mp4',
        fileName: `${title}.m4a`,
        ptt: false,
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        video: { url: media.filePath },
        mimetype: media.mimetype || 'video/mp4',
        caption: `🎬 ${title}`,
      }, { quoted: m })
    }
  } finally {
    await media.cleanup?.()
  }
}
