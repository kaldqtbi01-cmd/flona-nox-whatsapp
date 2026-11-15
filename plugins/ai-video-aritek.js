import axios from 'axios'

const API_BASE = 'https://text2video.aritek.app'
const PROXY_BASE = 'https://text-to-video-mj.vercel.app/video'
const REQUEST_TIMEOUT_MS = 30000
const GENERATION_TIMEOUT_MS = 90000
const POLL_INTERVAL_MS = 3000
const CHAT_COOLDOWN_MS = 60000

const activeChats = new Set()
const lastRequestAt = new Map()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function getCredentials() {
  const authorization = process.env.ARITEK_AUTHORIZATION
  const sign = process.env.ARITEK_SIGN
  const deviceID = process.env.ARITEK_DEVICE_ID

  if (!authorization || !sign || !deviceID) {
    const error = new Error('خدمة إنشاء الفيديو غير مهيأة على الخادم؛ يلزم ضبط متغيرات ARITEK المطلوبة.')
    error.userMessage = error.message
    throw error
  }

  return { authorization, sign, deviceID }
}

function getHeaders(credentials, contentType) {
  return {
    'User-Agent': 'okhttp/5.1.0',
    'Accept-Encoding': 'gzip',
    authorization: credentials.authorization,
    sign: credentials.sign,
    pt: process.env.ARITEK_PT || '',
    v: '72',
    deviceid: credentials.deviceID,
    'Content-Type': contentType,
  }
}

async function postForm(path, fields, credentials) {
  const body = new URLSearchParams(fields).toString()
  const response = await axios.post(`${API_BASE}${path}`, body, {
    headers: getHeaders(credentials, 'application/x-www-form-urlencoded'),
    timeout: REQUEST_TIMEOUT_MS,
  })
  return response.data
}

async function postJson(path, data, credentials) {
  const response = await axios.post(`${API_BASE}${path}`, data, {
    headers: getHeaders(credentials, 'application/json; charset=utf-8'),
    timeout: REQUEST_TIMEOUT_MS,
  })
  return response.data
}

function createProxyUrl(originalUrl) {
  const source = new URL(originalUrl)
  if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password) {
    throw new Error('رابط الفيديو الذي أعادته الخدمة غير صالح.')
  }

  const proxy = new URL(PROXY_BASE)
  proxy.searchParams.set('url', source.toString())
  return proxy.toString()
}

async function generateVideo(prompt, credentials) {
  const safety = await postForm('/nsfw', {
    prompt,
    ctry_target: 'others',
    versionCode: '72',
    deviceID: credentials.deviceID,
    isPremium: '0',
  }, credentials)

  if (Number(safety?.code) !== 0 || !safety?.success) {
    throw new Error('تعذّر التحقق من وصف الفيديو لدى الخدمة.')
  }

  const flagged = safety?.data?.[0]?.nsfw
  if (flagged === true || flagged === 1 || flagged === 'true') {
    throw new Error('الوصف غير مقبول لدى فلتر الخدمة؛ عدّل الوصف وحاول مجددًا.')
  }

  const generated = await postJson('/txt2videov3', {
    ai_sound: 1,
    aspect_ratio: 'auto',
    ctry_target: 'others',
    deviceID: credentials.deviceID,
    isPremium: 0,
    prompt,
    used: [],
    versionCode: 72,
  }, credentials)

  if (Number(generated?.code) !== 0) {
    throw new Error('رفضت خدمة الفيديو بدء التوليد؛ تحقق من صلاحية الخدمة وحاول لاحقًا.')
  }

  const videoKey = generated?.key
  if (!videoKey) throw new Error('لم تُرجع خدمة الفيديو معرّف المهمة.')

  const deadline = Date.now() + GENERATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const result = await postJson('/video', { keys: [videoKey] }, credentials)
      const videoUrl = result?.datas?.[0]?.url
      if (Number(result?.code) === 0 && videoUrl) {
        return createProxyUrl(videoUrl)
      }
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) throw error
      // قد تتأخر خدمة الحالة؛ نتابع المحاولة إلى انتهاء المهلة.
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('انتهى وقت انتظار الفيديو قبل أن يصبح جاهزًا؛ جرّب مرة أخرى لاحقًا.')
}

function userFacingError(error) {
  if (error?.userMessage) return error.userMessage
  const status = error?.response?.status
  if (status === 401 || status === 403) {
    return 'رفضت الخدمة بيانات الدخول؛ راجع إعدادات ARITEK على الخادم.'
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'تأخر رد خدمة الفيديو؛ حاول مرة أخرى بعد قليل.'
  }
  return error?.message || 'تعذّر إنشاء الفيديو؛ حاول مرة أخرى لاحقًا.'
}

const handler = async (m, { conn, text }) => {
  const prompt = String(text || '').trim()
  if (!prompt) {
    return m.reply('🎬 أرسل وصف الفيديو بعد الأمر.\nمثال: .فيديوز قط يركض في حديقة بأسلوب سينمائي')
  }
  if (prompt.length > 600) return m.reply('الوصف طويل؛ اختصره إلى 600 حرف أو أقل.')

  let credentials
  try {
    credentials = getCredentials()
  } catch (error) {
    return m.reply(userFacingError(error))
  }

  const now = Date.now()
  const previous = lastRequestAt.get(m.chat) || 0
  if (activeChats.has(m.chat)) return m.reply('⏳ يوجد طلب فيديو قيد التنفيذ في هذه المجموعة.')
  if (now - previous < CHAT_COOLDOWN_MS) {
    const seconds = Math.ceil((CHAT_COOLDOWN_MS - (now - previous)) / 1000)
    return m.reply(`انتظر ${seconds} ثانية قبل طلب فيديو آخر في هذه المجموعة.`)
  }

  activeChats.add(m.chat)
  lastRequestAt.set(m.chat, now)
  try {
    await m.react?.('⏳')
    await m.reply('🎬 وصل طلبك، جاري إنشاء الفيديو. قد يستغرق ذلك دقيقة إلى دقيقة ونصف.')

    const videoUrl = await generateVideo(prompt, credentials)
    await conn.sendMessage(m.chat, {
      video: { url: videoUrl },
      mimetype: 'video/mp4',
      caption: `🎬 تم إنشاء الفيديو\n📝 ${prompt}`,
    }, { quoted: m })
    await m.react?.('✅')
  } catch (error) {
    await m.react?.('❌')
    return m.reply(`❌ ${userFacingError(error)}`)
  } finally {
    activeChats.delete(m.chat)
  }
}

handler.command = /^(فيديوز|توليد_فيديو|توليد-فيديو|text2video)$/i
handler.help = ['فيديوز <وصف>', 'توليد_فيديو <وصف>']
handler.tags = ['ai']
handler.group = true
handler.admin = true

export default handler
