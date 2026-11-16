import axios from 'axios'
import { isIP } from 'node:net'

const API = {
  tiktok: 'https://tikwm.com/api/',
  instagram: 'https://api-faa.my.id/faa/igdl',
  pinterest: 'https://api-faa.my.id/faa/pin-down',
  facebook: 'https://api-faa.my.id/faa/fbdownload',
  x: 'https://api.nexray.web.id/downloader/twitter',
  youtubeSearch: 'https://api-faa.my.id/faa/youtube',
  youtubeMp3: 'https://api-faa.my.id/faa/ytmp3',
  youtubeMp4: 'https://api-faa.my.id/faa/ytmp4',
}

const HOSTS = {
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  facebook: ['facebook.com', 'fb.watch', 'fb.com'],
  x: ['x.com', 'twitter.com', 't.co'],
  youtube: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
}

const MAX_ITEMS_PER_RESULT = 10

function cleanCandidate(value) {
  return String(value || '').replace(/[.,!?;:)}\]>]+$/g, '')
}

function hostMatches(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`)
}

export function classifyPlatformLink(text) {
  const candidate = cleanCandidate(String(text || '').match(/https?:\/\/[^\s<>"']+/i)?.[0])
  if (!candidate) throw new Error('أرسل رابطًا مباشرًا من إحدى المنصات المدعومة.')

  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('الرابط غير صالح.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('صيغة الرابط غير مدعومة.')
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  for (const [platform, domains] of Object.entries(HOSTS)) {
    if (domains.some(domain => hostMatches(host, domain))) {
      parsed.hash = ''
      return { platform, url: parsed.toString() }
    }
  }
  throw new Error('الرابط غير مدعوم. المتاح: TikTok وInstagram وPinterest وFacebook وX وYouTube.')
}

function safeMediaUrl(value) {
  const raw = typeof value === 'string' ? value : value?.url
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    const host = url.hostname.toLowerCase()
    if (isIP(host) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null
    return url.toString()
  } catch {
    return null
  }
}

function requireResult(data, label) {
  if (!data || !data.status || !data.result) {
    throw new Error(data?.message || `تعذر الحصول على نتيجة من خدمة ${label}.`)
  }
  return data.result
}

async function apiGet(httpGet, base, key, value) {
  const endpoint = new URL(base)
  endpoint.searchParams.set(key, value)
  const response = await httpGet(endpoint.toString(), {
    timeout: 25_000,
    maxContentLength: 2 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024,
  })
  return response?.data
}

function media(type, url, extra = {}) {
  const safeUrl = safeMediaUrl(url)
  return safeUrl ? { type, url: safeUrl, ...extra } : null
}

function mediaList(values, type, extra = {}) {
  if (!Array.isArray(values)) values = values == null ? [] : [values]
  return values.slice(0, MAX_ITEMS_PER_RESULT).map(value => media(type, value, extra)).filter(Boolean)
}

export async function resolveAtlasMedia(text, {
  command = '',
  httpGet = (url, config) => axios.get(url, config),
} = {}) {
  const { platform, url } = classifyPlatformLink(text)
  const commandPlatform = { xdl: 'x', pindl: 'pinterest' }[String(command).toLowerCase()]
  if (commandPlatform && commandPlatform !== platform) {
    throw new Error(commandPlatform === 'x' ? 'أرسل رابطًا من منصة X لهذا الأمر.' : 'أرسل رابطًا من Pinterest لهذا الأمر.')
  }
  let data
  let result

  if (platform === 'tiktok') {
    const endpoint = new URL(API.tiktok)
    endpoint.searchParams.set('url', url)
    const response = await httpGet(endpoint.toString(), { timeout: 25_000, maxContentLength: 2 * 1024 * 1024 })
    data = response?.data
    if (Number(data?.code) !== 0 || !data?.data) throw new Error(data?.msg || 'تعذر تنزيل TikTok من الخدمة.')
    const images = mediaList(data.data.images, 'image')
    if (images.length) return images
    const video = media('video', data.data.play, { mimetype: 'video/mp4' })
    if (video) return [video]
    throw new Error('لم أجد صورة أو فيديو قابلًا للإرسال في رابط TikTok.')
  }

  if (platform === 'instagram') {
    data = await apiGet(httpGet, API.instagram, 'url', url)
    result = requireResult(data, 'Instagram')
    const type = result.metadata?.isVideo ? 'video' : 'image'
    const items = mediaList(result.url, type, type === 'video' ? { mimetype: 'video/mp4' } : {})
    if (!items.length) throw new Error('لم أجد وسائط قابلة للإرسال في رابط Instagram.')
    return items
  }

  if (platform === 'pinterest') {
    data = await apiGet(httpGet, API.pinterest, 'url', url)
    result = requireResult(data, 'Pinterest')
    const items = Array.isArray(result.medias) ? result.medias : []
    const images = items.filter(item => item?.type === 'image').slice(0, MAX_ITEMS_PER_RESULT)
    const imagePayloads = mediaList(images, 'image')
    if (imagePayloads.length) return imagePayloads
    const moving = items.find(item => item?.type === 'video' || item?.type === 'gif')
    const movingMedia = moving && media('video', moving.url, { mimetype: 'video/mp4', gifPlayback: moving.type === 'gif' })
    if (movingMedia) return [movingMedia]
    throw new Error('لم أجد وسائط قابلة للإرسال في رابط Pinterest.')
  }

  if (platform === 'facebook') {
    data = await apiGet(httpGet, API.facebook, 'url', url)
    result = requireResult(data, 'Facebook')
    const item = result.media?.video_hd || result.media?.video_sd
      ? media('video', result.media.video_hd || result.media.video_sd, { mimetype: 'video/mp4' })
      : media('image', result.media?.photo_image)
    if (!item) throw new Error('لم أجد صورة أو فيديو قابلًا للإرسال في رابط Facebook.')
    return [item]
  }

  if (platform === 'x') {
    data = await apiGet(httpGet, API.x, 'url', url)
    result = requireResult(data, 'X')
    const values = result.download_url
    if (result.type === 'image') {
      const items = mediaList(values, 'image')
      if (items.length) return items
    } else if (result.type === 'video') {
      const variants = Array.isArray(values) ? values : [values]
      const mp4 = variants.filter(item => item?.type === 'mp4')
      const ranked = ['768p', '640p', '426p']
      const selected = ranked.map(resolution => mp4.find(item => item?.resolusi === resolution)).find(Boolean) || mp4[0] || variants[0]
      const item = media('video', selected, { mimetype: 'video/mp4' })
      if (item) return [item]
    }
    throw new Error('لم أجد صورة أو فيديو قابلًا للإرسال في رابط X.')
  }

  if (platform === 'youtube') {
    const audioOnly = /^(ytmp3|ytmp3_atlas|mp3|تنزيل_صوت)$/i.test(String(command))
    const endpoint = audioOnly ? API.youtubeMp3 : API.youtubeMp4
    data = await apiGet(httpGet, endpoint, 'url', url)
    result = requireResult(data, 'YouTube')
    if (audioOnly) {
      const item = media('audio', result.mp3 || result.url, { mimetype: 'audio/mpeg', fileName: `${result.title || 'youtube'}.mp3` })
      if (item) return [item]
    } else {
      const item = media('video', result.download_url || result.url, { mimetype: 'video/mp4' })
      if (item) return [item]
    }
    throw new Error('لم تتضمن استجابة YouTube رابط وسائط صالحًا.')
  }

  throw new Error('المنصة غير مدعومة.')
}

export function createAtlasDownloadHandler(options = {}) {
  return async (m, { conn, text = '', command = '' }) => {
    const input = String(text || m.quoted?.text || m.quoted?.body || '').trim()
    try {
      const items = await resolveAtlasMedia(input, { ...options, command })
      for (const item of items) {
        const payload = { [item.type]: { url: item.url } }
        if (item.mimetype) payload.mimetype = item.mimetype
        if (item.fileName) payload.fileName = item.fileName
        if (item.gifPlayback) payload.gifPlayback = true
        if (item.caption) payload.caption = item.caption
        await conn.sendMessage(m.chat, payload, { quoted: m })
      }
      return items.length
    } catch (error) {
      const message = error?.message || 'تعذر تنزيل الوسائط.'
      if (typeof m.reply === 'function') await m.reply(`❌ ${message}`)
      return 0
    }
  }
}

export async function resolveAtlasYoutubeSearch(query, {
  audioOnly = false,
  httpGet = (url, config) => axios.get(url, config),
} = {}) {
  const searchTerm = String(query || '').trim()
  if (!searchTerm) throw new Error('اكتب اسم الفيديو أو الأغنية للبحث في YouTube.')
  if (searchTerm.length > 200) throw new Error('عبارة البحث طويلة جدًا؛ اختصرها إلى 200 حرف أو أقل.')

  const data = await apiGet(httpGet, API.youtubeSearch, 'q', searchTerm)
  const results = requireResult(data, 'بحث YouTube')
  const first = Array.isArray(results) ? results[0] : null
  if (!first) throw new Error('لم يتم العثور على نتائج في YouTube.')

  const videoUrl = first.link || first.url
  const { platform } = classifyPlatformLink(videoUrl)
  if (platform !== 'youtube') throw new Error('نتيجة البحث ليست رابط YouTube صالحًا.')

  const items = await resolveAtlasMedia(videoUrl, {
    httpGet,
    command: audioOnly ? 'ytmp3_atlas' : 'atlasdl',
  })
  const title = String(first.title || '').trim().slice(0, 180)
  return items.map(item => audioOnly || !title ? item : { ...item, caption: `🎬 ${title}` })
}

export function createAtlasYoutubeSearchHandler({ audioOnly = false, ...options } = {}) {
  return async (m, { conn, text = '' }) => {
    const query = String(text || m.quoted?.text || m.quoted?.body || '').trim()
    try {
      const items = await resolveAtlasYoutubeSearch(query, { ...options, audioOnly })
      for (const item of items) {
        const payload = { [item.type]: { url: item.url } }
        if (item.mimetype) payload.mimetype = item.mimetype
        if (item.fileName) payload.fileName = item.fileName
        if (item.caption) payload.caption = item.caption
        await conn.sendMessage(m.chat, payload, { quoted: m })
      }
      return items.length
    } catch (error) {
      const message = error?.message || 'تعذر البحث والتنزيل من YouTube.'
      if (typeof m.reply === 'function') await m.reply(`❌ ${message}`)
      return 0
    }
  }
}
