import axios from 'axios'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
const INTERACTIONS_URL = `${API_ROOT}/interactions`
const MODEL = 'gemini-omni-1.2-flash'
const CREATE_TIMEOUT_MS = 240000
const FILE_POLL_TIMEOUT_MS = 120000
const FILE_POLL_INTERVAL_MS = 5000
const CHAT_COOLDOWN_MS = 60000
const MAX_PROMPT_LENGTH = 1200
const MAX_VIDEO_BYTES = 64 * 1024 * 1024

const activeChats = new Set()
const lastRequestAt = new Map()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function parseRequest(text) {
  let prompt = String(text || '').trim()
  let duration = 5
  const durationMatch = prompt.match(/^(\d{1,2})\s*(?:s|ث)\s+([\s\S]+)$/i)

  if (durationMatch) {
    duration = Number(durationMatch[1])
    prompt = durationMatch[2].trim()
  }

  if (duration < 3 || duration > 15) {
    throw new Error('المدة المسموحة من 3 إلى 15 ثانية. مثال: .فيديوز 8s وصف الفيديو')
  }
  if (!prompt) {
    throw new Error('أرسل وصف الفيديو بعد الأمر. مثال: .فيديوز 5s طائرة تحلّق فوق صنعاء وقت الغروب')
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`اختصر وصف الفيديو إلى ${MAX_PROMPT_LENGTH} حرف أو أقل.`)
  }

  return { prompt, duration }
}

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    const error = new Error('أضف GEMINI_API_KEY إلى ملف .env على الخادم ثم أعد تشغيل البوت.')
    error.userMessage = error.message
    throw error
  }
  return key
}

function apiConfig(apiKey, extra = {}) {
  return {
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    maxContentLength: MAX_VIDEO_BYTES,
    maxBodyLength: 2 * 1024 * 1024,
    ...extra,
  }
}

async function createVideoInteraction(prompt, duration, apiKey) {
  const response = await axios.post(INTERACTIONS_URL, {
    model: MODEL,
    input: prompt,
    store: false,
    response_format: {
      type: 'video',
      delivery: 'uri',
      aspect_ratio: '9:16',
      duration: `${duration}s`,
      resolution: '720p',
    },
  }, apiConfig(apiKey, { timeout: CREATE_TIMEOUT_MS }))

  const interaction = response.data
  if (interaction?.status === 'failed') {
    throw new Error(interaction?.error?.message || 'فشل Gemini في إنشاء الفيديو.')
  }
  if (interaction?.status && interaction.status !== 'completed') {
    throw new Error(`انتهى الطلب بحالة ${interaction.status} قبل جاهزية الفيديو.`)
  }
  return interaction
}

function findVideoOutput(interaction) {
  const modelOutput = (interaction?.steps || [])
    .filter(step => step?.type === 'model_output')
    .flatMap(step => Array.isArray(step.content) ? step.content : [])
  const video = modelOutput.find(part => part?.type === 'video' || part?.mime_type?.startsWith('video/'))
    || interaction?.output_video

  if (video?.data) return { buffer: Buffer.from(video.data, 'base64') }
  if (video?.uri) return { uri: video.uri }
  throw new Error('اكتمل رد Gemini لكن لم أجد ملف الفيديو في النتيجة.')
}

function getValidatedVideoUrl(uri) {
  let url
  try {
    url = new URL(uri, `${API_ROOT}/`)
  } catch {
    throw new Error('أعاد Gemini رابط فيديو غير صالح.')
  }

  if (url.origin !== 'https://generativelanguage.googleapis.com' || !url.pathname.startsWith('/v1beta/files/')) {
    throw new Error('رفضت الإضافة رابط تنزيل غير تابع لخدمة Google الرسمية.')
  }
  return url
}

async function downloadVideoFile(uri, apiKey) {
  const videoUrl = getValidatedVideoUrl(uri)
  const fileMatch = videoUrl.pathname.match(/^\/v1beta\/files\/([^/:]+)(?::download)?$/)
  if (!fileMatch) throw new Error('تعذر استخراج معرّف ملف الفيديو من رابط Gemini.')

  const fileId = decodeURIComponent(fileMatch[1])
  const fileInfoUrl = `${API_ROOT}/files/${encodeURIComponent(fileId)}`
  const deadline = Date.now() + FILE_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const statusResponse = await axios.get(fileInfoUrl, apiConfig(apiKey))
    const state = String(statusResponse.data?.state || '').toUpperCase()
    if (state === 'ACTIVE') break
    if (state === 'FAILED') throw new Error('فشل تجهيز ملف الفيديو لدى Google.')
    await sleep(FILE_POLL_INTERVAL_MS)
  }

  if (Date.now() >= deadline) {
    throw new Error('تأخر تجهيز ملف الفيديو لدى Google؛ انتهت مهلة الانتظار.')
  }

  if (!videoUrl.pathname.endsWith(':download')) videoUrl.pathname += ':download'
  if (!videoUrl.searchParams.has('alt')) videoUrl.searchParams.set('alt', 'media')

  const downloadResponse = await axios.get(videoUrl.toString(), apiConfig(apiKey, {
    responseType: 'arraybuffer',
    timeout: 90000,
  }))
  const buffer = Buffer.from(downloadResponse.data)
  if (!buffer.length) throw new Error('أعاد Google ملف فيديو فارغًا.')
  if (buffer.length > MAX_VIDEO_BYTES) throw new Error('حجم الفيديو أكبر من الحد الذي يمكن للبوت إرساله.')
  return buffer
}

async function generateVideo(prompt, duration, apiKey) {
  const interaction = await createVideoInteraction(prompt, duration, apiKey)
  const output = findVideoOutput(interaction)
  const buffer = output.buffer || await downloadVideoFile(output.uri, apiKey)

  if (buffer.length > MAX_VIDEO_BYTES) throw new Error('حجم الفيديو أكبر من الحد الذي يمكن للبوت إرساله.')
  return buffer
}

function userFacingError(error) {
  if (error?.userMessage) return error.userMessage
  if (error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN') {
    return 'تعذر الوصول إلى Google API عبر DNS؛ تحقق من اتصال الخادم ثم حاول لاحقًا.'
  }

  const status = error?.response?.status
  const providerMessage = error?.response?.data?.error?.message
  if (status === 401 || status === 403) {
    return 'رفضت Google مفتاح Gemini أو صلاحية الفوترة؛ تحقق من المفتاح ومن تفعيل الخطة المدفوعة.'
  }
  if (status === 429) {
    return 'وصلت إلى حد الاستخدام أو الحصة المتاحة في Gemini؛ تحقق من الحصة والفوترة قبل إعادة المحاولة.'
  }
  if (status === 400 && providerMessage) return `رفض Gemini الطلب: ${providerMessage}`
  if (providerMessage) return `تعذر إنشاء الفيديو: ${providerMessage}`
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'تأخر رد Gemini؛ لم أعد إرسال الطلب تلقائيًا لتجنب احتساب توليد مكرر. تحقق من حالة Google AI Studio قبل المحاولة مجددًا.'
  }
  return error?.message || 'تعذر إنشاء الفيديو؛ حاول مرة أخرى لاحقًا.'
}

const handler = async (m, { conn, text }) => {
  let request
  try {
    request = parseRequest(text)
  } catch (error) {
    return m.reply(error.message)
  }

  let apiKey
  try {
    apiKey = getApiKey()
  } catch (error) {
    return m.reply(error.message)
  }

  const chat = m.chat
  const now = Date.now()
  const previous = lastRequestAt.get(chat) || 0
  if (activeChats.has(chat)) return m.reply('⏳ يوجد طلب فيديو قيد التنفيذ في هذه المحادثة.')
  if (now - previous < CHAT_COOLDOWN_MS) {
    const seconds = Math.ceil((CHAT_COOLDOWN_MS - (now - previous)) / 1000)
    return m.reply(`انتظر ${seconds} ثانية قبل طلب فيديو آخر.`)
  }

  activeChats.add(chat)
  lastRequestAt.set(chat, now)
  try {
    await m.react?.('⏳')
    await m.reply(`🎬 وصل طلبك. جارٍ إنشاء فيديو عمودي بدقة 720p ومدته ${request.duration} ثوانٍ. ملاحظة: التوليد مدفوع لدى Google.`)

    const video = await generateVideo(request.prompt, request.duration, apiKey)
    await conn.sendMessage(chat, {
      video,
      mimetype: 'video/mp4',
      caption: `🎬 فيديو Gemini\n⏱️ ${request.duration} ثوانٍ\n📝 ${request.prompt}`,
    }, { quoted: m })
    await m.react?.('✅')
  } catch (error) {
    await m.react?.('❌')
    return m.reply(`❌ ${userFacingError(error)}`)
  } finally {
    activeChats.delete(chat)
  }
}

handler.command = /^(فيديوز|توليد_فيديو|توليد-فيديو|text2video)$/i
handler.help = ['فيديوز <وصف>', 'فيديوز <3-15>s <وصف>']
handler.tags = ['ai']
handler.group = true
handler.admin = true

export default handler
