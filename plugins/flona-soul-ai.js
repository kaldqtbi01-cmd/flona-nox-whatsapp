import { aiProviders } from '../lib/ai-providers.js'
import {
  DIALECTS,
  MOODS,
  PERSONALITIES,
  addSoulMemory,
  buildSoulPrompt,
  buildSoulSystemPrompt,
  clearSoulMemory,
  detectMood,
  getSoulMemory,
  getSoulSettings,
  getActivePersonality,
  isRepeatedReply,
  rememberReply,
  resolveDialect,
  resolveMood,
  resolvePersonality,
} from '../lib/flona-soul-engine.js'

const IN_FLIGHT = new Map()
const RATE = new Map()
const SEEN_MESSAGES = new Map()
const PREFIXES = /^[#!./-]/

function ensureDb() {
  global.db ||= {}
  global.db.data ||= {}
  global.db.data.chats ||= {}
  return global.db.data.chats
}

function getChat(m) {
  const chats = ensureDb()
  return chats[m.chat] ||= {}
}

function normalizeJid(jid) {
  return String(jid || '').split(':')[0].split('@')[0]
}

function botIsMentioned(m, botId) {
  const mentions = m.mentionedJid || m.msg?.contextInfo?.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  const botNumber = normalizeJid(botId)
  return Array.isArray(mentions) && mentions.some(jid => normalizeJid(jid) === botNumber)
}

function isReplyToBot(m, botId) {
  const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant
  return Boolean(quotedSender && botId && normalizeJid(quotedSender) === normalizeJid(botId))
}

function quotedText(m) {
  return m.quoted?.text || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || ''
}

function getRecentContext(chat) {
  return (chat.soulAI?.context || []).slice(-8).map(item => `${item.sender}: ${item.text}`).join('\n')
}

function rememberContext(chat, sender, text, reply) {
  const settings = getSoulSettings(chat)
  settings.context ||= []
  settings.context.push({ sender, text: String(text || '').slice(0, 800), reply: String(reply || '').slice(0, 800), at: Date.now() })
  settings.context = settings.context.slice(-20)
}

function withinRate(chatId, settings) {
  const now = Date.now()
  const old = RATE.get(chatId) || { start: now, count: 0 }
  if (now - old.start > settings.requests.windowMs) {
    RATE.set(chatId, { start: now, count: 1 })
    return true
  }
  if (old.count >= settings.requests.max) return false
  old.count += 1
  RATE.set(chatId, old)
  return true
}

function listLines(items) {
  return Object.entries(items).map(([key, value]) => `• ${value.label || value} — ${key}`).join('\n')
}

function adminOnly(ctx) {
  return Boolean(ctx.isAdmin || ctx.isOwner || ctx.isROwner)
}

async function saveDb() {
  if (typeof global.db?.write === 'function') await global.db.write()
}

async function send(m, conn, text) {
  return conn.sendMessage(m.chat, { text }, { quoted: m })
}

async function handleCommand(m, ctx) {
  if (!m.isGroup) return m.reply?.('❌ أوامر لوكا للمجموعات فقط')
  const { command = '', args = [], conn } = ctx
  const cmd = String(command).toLowerCase()
  const chat = getChat(m)
  const settings = getSoulSettings(chat)
  const value = args.join(' ').trim()

  const adminCommands = new Set(['شخصية', 'لهجة', 'مزاج', 'ايقاف_الذكاء', 'تشغيل_الذكاء', 'اطفاء_الذكاء', 'مسح_ذاكرة_الذكاء', 'ذاكرة_الذكاء', 'سماح_لوكا', 'استثناء_لوكا'])
  if (adminCommands.has(cmd) && !adminOnly(ctx)) return m.reply?.('❌ هذا الأمر للأدمن فقط')

  if (cmd === 'شخصيات') return send(m, conn, `🎭 شخصيات لوكا:\n${listLines(PERSONALITIES)}\n\nاستخدم: .شخصية حكيم`)
  if (cmd === 'شخصية') {
    if (!value) return send(m, conn, `الشخصية الحالية: ${PERSONALITIES[settings.personality]?.label || settings.personality}\nاستخدم .شخصيات لعرض القائمة`)
    if (value.startsWith('مخصصة ')) {
      const custom = value.slice('مخصصة '.length).trim()
      if (custom.length < 5) return send(m, conn, '❌ اكتب وصفًا أطول للشخصية المخصصة')
      settings.personality = 'custom'
      settings.customPersonality = custom.slice(0, 500)
      settings.enabled = true
      await saveDb()
      return send(m, conn, '✅ تم حفظ الشخصية المخصصة وتفعيلها لهذه المجموعة')
    }
    const key = resolvePersonality(value)
    if (!key) return send(m, conn, '❌ الشخصية غير موجودة. استخدم .شخصيات')
    settings.personality = key
    settings.enabled = true
    await saveDb()
    return send(m, conn, `✅ تم اختيار شخصية لوكا: ${PERSONALITIES[key].label}`)
  }
  if (cmd === 'لهجة') {
    if (!value || value === 'الحالية') return send(m, conn, `🗣️ اللهجة الحالية: ${DIALECTS[settings.dialect]?.label || settings.dialect}\n\n${listLines(DIALECTS)}\n\nمثال: .لهجة يمني`)
    const key = resolveDialect(value)
    if (!key) return send(m, conn, '❌ اللهجة غير موجودة. استخدم .لهجة لعرض القائمة')
    settings.dialect = key
    await saveDb()
    return send(m, conn, `✅ تم ضبط لهجة لوكا على: ${DIALECTS[key].label}`)
  }
  if (cmd === 'مزاج') {
    if (!value || value === 'الحالية') return send(m, conn, `🧠 المزاج الحالي: ${settings.mood === 'auto' ? 'تلقائي' : MOODS[settings.mood]}\n\nالمتاح: ${Object.keys(MOODS).map(key => MOODS[key]).join('، ')}`)
    const key = resolveMood(value)
    if (!key) return send(m, conn, '❌ المزاج غير موجود. مثال: .مزاج سعيد أو .مزاج تلقائي')
    settings.mood = key
    await saveDb()
    return send(m, conn, `✅ تم ضبط مزاج لوكا على: ${key === 'auto' ? 'تلقائي' : MOODS[key]}`)
  }
  if (cmd === 'ايقاف_الذكاء') {
    settings.paused = true
    await saveDb()
    return send(m, conn, '⏸️ تم تجميد ردود لوكا مؤقتًا مع الاحتفاظ بالإعدادات والذاكرة')
  }
  if (cmd === 'تشغيل_الذكاء') {
    settings.enabled = true
    settings.paused = false
    await saveDb()
    return send(m, conn, '✅ تم تشغيل لوكا واستعادة الردود')
  }
  if (cmd === 'اطفاء_الذكاء') {
    settings.enabled = false
    settings.paused = false
    await saveDb()
    return send(m, conn, '🛑 تم إطفاء لوكا بالكامل في هذه المجموعة')
  }
  if (cmd === 'مسح_ذاكرة_الذكاء') {
    clearSoulMemory(chat)
    await saveDb()
    return send(m, conn, '🧹 تم مسح ذاكرة لوكا الخاصة بهذه المجموعة')
  }
  if (cmd === 'ذاكرة_الذكاء') {
    const memory = getSoulMemory(chat)
    return send(m, conn, memory.length ? `🧠 ذاكرة لوكا:\n${memory.map(item => `• ${item}`).join('\n')}` : '🧠 لا توجد ذاكرة محفوظة مفيدة لهذه المجموعة')
  }
  if (cmd === 'حالة_الذكاء') {
    return send(m, conn, `🤖 FLONA SOUL AI — لوكا\nالحالة: ${settings.enabled ? (settings.paused ? 'مجمّدة' : 'مفعّلة') : 'متوقفة'}\nالشخصية: ${getActivePersonality(settings).label}\nاللهجة: ${DIALECTS[settings.dialect]?.label}\nالمزاج: ${settings.mood === 'auto' ? 'تلقائي' : MOODS[settings.mood]}\nالذاكرة: ${settings.memoryEnabled ? 'مفعّلة' : 'متوقفة'}\nالمزود الأساسي: Gemini Flash 3.1\nالاحتياطي: Groq`)
  }
  if (cmd === 'سماح_لوكا') {
    const jid = m.mentionedJid?.[0]
    if (!jid) return send(m, conn, 'استخدم الأمر مع منشن العضو')
    settings.allowUsers ||= []
    if (!settings.allowUsers.includes(jid)) settings.allowUsers.push(jid)
    await saveDb()
    return send(m, conn, '✅ تمت إضافة العضو إلى قائمة المسموح لهم')
  }
  if (cmd === 'استثناء_لوكا') {
    const jid = m.mentionedJid?.[0]
    if (!jid) return send(m, conn, 'استخدم الأمر مع منشن العضو')
    if (!settings.excludedUsers.includes(jid)) settings.excludedUsers.push(jid)
    await saveDb()
    return send(m, conn, '✅ تمت إضافة العضو إلى قائمة الاستثناء')
  }
}

async function getMediaPart(m) {
  const image = m.message?.imageMessage
  if (!image || typeof m.download !== 'function') return null
  try {
    const buffer = await m.download()
    if (!buffer) return null
    return { type: 'image', mimeType: image.mimetype || 'image/jpeg', data: Buffer.from(buffer).toString('base64') }
  } catch {
    return null
  }
}

let handler = async (m, ctx) => handleCommand(m, ctx)
handler.command = /^(شخصيات|شخصية|لهجة|مزاج|ايقاف_الذكاء|تشغيل_الذكاء|اطفاء_الذكاء|حالة_الذكاء|ذاكرة_الذكاء|مسح_ذاكرة_الذكاء|سماح_لوكا|استثناء_لوكا)$/i
handler.help = ['شخصيات', 'شخصية', 'لهجة', 'مزاج', 'حالة_الذكاء']
handler.tags = ['ai']
handler.group = true

handler.all = async function (m) {
  if (!m.isGroup || m.fromMe) return
  const text = m.text?.trim() || ''
  const mediaMessage = m.message?.imageMessage || m.message?.audioMessage || m.message?.stickerMessage
  if ((!text && !mediaMessage) || PREFIXES.test(text)) return
  const botId = this.user?.id
  const mentioned = botIsMentioned(m, botId)
  const replied = isReplyToBot(m, botId)
  if (!mentioned && !replied) return

  const messageId = m.key?.id
  if (messageId) {
    const previous = SEEN_MESSAGES.get(messageId)
    if (previous && Date.now() - previous < 30_000) return
    SEEN_MESSAGES.set(messageId, Date.now())
    if (SEEN_MESSAGES.size > 200) {
      for (const [key, at] of SEEN_MESSAGES) {
        if (Date.now() - at > 60_000) SEEN_MESSAGES.delete(key)
      }
    }
  }

  const chat = getChat(m)
  const settings = getSoulSettings(chat)
  if (!settings.enabled || settings.paused) return
  if (settings.allowUsers && !settings.allowUsers.includes(m.sender)) return
  if (settings.excludedUsers.includes(m.sender)) return
  if (!withinRate(m.chat, settings)) return
  if (IN_FLIGHT.has(m.chat)) return
  IN_FLIGHT.set(m.chat, true)

  try {
    const senderName = m.pushName || m.sender?.split('@')[0] || 'العضو'
    if (!text && m.message?.audioMessage) {
      await this.sendMessage(m.chat, { text: 'أقدر فهم النص والصور حاليًا، لكن تحويل الصوت إلى نص غير متاح في هذه النسخة بعد.' }, { quoted: m })
      return
    }
    const mood = detectMood(text, settings)
    const personality = getActivePersonality(settings)
    const dialect = DIALECTS[settings.dialect] || DIALECTS.auto
    const prompt = buildSoulPrompt({
      senderName,
      text,
      quotedText: quotedText(m),
      recentContext: getRecentContext(chat),
      personality: personality.style,
      dialect: dialect.instruction,
      mood: MOODS[mood],
    })
    const systemInstruction = buildSoulSystemPrompt(settings, settings.dialect === 'auto' ? '' : dialect.instruction, mood, getSoulMemory(chat))
    const imagePart = settings.allowMedia ? await getMediaPart(m) : null
    const parts = imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }]
    let result
    try {
      result = await aiProviders.geminiGenerate({ contents: [{ role: 'user', parts }], systemInstruction, temperature: 0.65, maxTokens: 500 })
    } catch {
      result = await aiProviders.ask({ task: 'chat', messages: [{ role: 'user', content: prompt }], systemInstruction, temperature: 0.65, maxTokens: 500, fallback: true })
    }
    const reply = String(result?.text || '').trim()
    if (!reply || isRepeatedReply(settings, reply)) return
    await this.sendMessage(m.chat, { text: reply }, { quoted: m })
    rememberReply(settings, reply)
    rememberContext(chat, senderName, text, reply)
    addSoulMemory(chat, text)
    await saveDb()
  } catch (error) {
    if (!String(error?.message || '').includes('429')) console.error('[FLONA SOUL]', error?.message || error)
  } finally {
    IN_FLIGHT.delete(m.chat)
  }
}

export default handler
