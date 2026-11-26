import { aiProviders } from '../lib/ai-providers.js'
import { createChatQueue } from '../lib/ai-queue.js'
import { downloadYoutubeBySearch } from '../lib/youtube-search-download.js'
import { parseLukaMediaRequest, sendLukaMediaRequest } from '../lib/luka-media.js'
import { pinterestScraper } from './بينترست.js'
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
  resolveResponseLength,
} from '../lib/flona-soul-engine.js'

const CHAT_QUEUE = createChatQueue({ maxDepth: 20 })
const RATE = new Map()
const SEEN_MESSAGES = new Map()
const PREFIXES = /^[#!./-]/
let lastProviderSuccess = null

function providerStateLine(label, state) {
  const availability = !state.configured
    ? 'المفتاح غير مضبوط'
    : state.cooldownMs > 0
      ? `في تبريد (${Math.ceil(state.cooldownMs / 1000)} ث)`
      : 'المفتاح مضبوط، لا يوجد تبريد'
  return `${label}: ${availability} — النموذج المضبوط: ${state.model || 'غير محدد'}`
}

function ensureDb() {
  global.db ||= {}
  global.db.data ||= {}
  global.db.data.chats ||= {}
  return global.db.data.chats
}

const GLOBAL_STYLE_KEYS = Object.freeze(['personality', 'customPersonality', 'dialect', 'mood', 'sarcasm', 'emotion', 'intensity'])

function getChat(m) {
  const chats = ensureDb()
  return chats[m.chat] ||= {}
}

function jidVariants(jid) {
  const value = String(jid || '').trim().toLowerCase()
  if (!value) return []
  const base = value.split(':')[0]
  const number = base.split('@')[0]
  return [value, base, number, `${number}@s.whatsapp.net`, `${number}@lid`]
}
function whatsappPhoneNumber(value) {
  const raw = String(value || '').trim()
  if (/@lid(?:$|:)/i.test(raw)) return ''
  const local = raw.split('@')[0].split(':')[0]
  const digits = local.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? digits : ''
}
function isSoulCreator(m, groupMetadata) {
  const creatorNumber = String(global.db?.data?.soulAICreatorNumber || '').replace(/\D/g, '')
  if (!creatorNumber) return false
  if (whatsappPhoneNumber(m.sender) === creatorNumber) return true
  const senderIds = new Set(jidVariants(m.sender))
  return (groupMetadata?.participants || []).some(participant => {
    const ids = [participant?.id, participant?.jid, participant?.lid].flatMap(jidVariants)
    if (!ids.some(id => senderIds.has(id))) return false
    return [participant?.phoneNumber, participant?.id, participant?.jid].some(value => whatsappPhoneNumber(value) === creatorNumber)
  })
}
function botIdentitySources(user, groupMetadata) {
  const sources = [user?.id, user?.jid, user?.lid]
  const userNumbers = sources.flatMap(jidVariants).filter(value => !value.includes('@'))
  for (const participant of groupMetadata?.participants || []) {
    const participantSources = [participant?.id, participant?.jid, participant?.phoneNumber]
    const participantNumbers = participantSources.flatMap(jidVariants).filter(value => !value.includes('@'))
    if (userNumbers.some(number => participantNumbers.includes(number))) {
      sources.push(participant.id, participant.jid, participant.lid, participant.phoneNumber)
    }
  }
  return sources.flatMap(jidVariants)
}
function botIsMentioned(m, user, groupMetadata) {
  const mentions = m.mentionedJid || m.msg?.contextInfo?.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  const botIds = botIdentitySources(user, groupMetadata)
  return Array.isArray(mentions) && mentions.some(jid => jidVariants(jid).some(candidate => botIds.includes(candidate)))
}
function isReplyToBot(m, user, groupMetadata) {
  const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant
  const botIds = botIdentitySources(user, groupMetadata)
  return Boolean(quotedSender && botIds.some(candidate => jidVariants(quotedSender).includes(candidate)))
}

function quotedText(m) {
  return m.quoted?.text || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || ''
}

function getRecentContext(chat) {
  return (chat.soulAI?.context || []).slice(-8).flatMap(item => {
    const turns = []
    if (item.text) turns.push(`[رسالة سابقة من ${item.sender}]: ${item.text}`)
    if (item.reply) turns.push(`[رد لوكا على تلك الرسالة]: ${item.reply}`)
    return turns
  }).join('\n')
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

function ownerOrDeveloper(ctx) {
  return Boolean(ctx.isOwner || ctx.isROwner)
}

async function saveDb() {
  if (typeof global.db?.write === 'function') await global.db.write()
}

async function send(m, conn, text) {
  return conn.sendMessage(m.chat, { text }, { quoted: m })
}

function getEffectiveSoulSettings(chat) {
  const settings = getSoulSettings(chat)
  const shared = global.db?.data?.soulAIGlobalStyle
  if (shared && typeof shared === 'object') {
    for (const key of GLOBAL_STYLE_KEYS) {
      if (Object.hasOwn(shared, key)) settings[key] = shared[key]
    }
  }
  return settings
}

function updateGlobalSoulStyle(chat, changes) {
  const db = global.db.data
  const current = getEffectiveSoulSettings(chat)
  db.soulAIGlobalStyle ||= Object.fromEntries(GLOBAL_STYLE_KEYS.map(key => [key, current[key]]))
  Object.assign(db.soulAIGlobalStyle, changes)
  for (const group of Object.values(db.chats || {})) {
    if (!group?.soulAI || typeof group.soulAI !== 'object') continue
    for (const key of GLOBAL_STYLE_KEYS) {
      if (Object.hasOwn(db.soulAIGlobalStyle, key)) group.soulAI[key] = db.soulAIGlobalStyle[key]
    }
  }
  Object.assign(getSoulSettings(chat), db.soulAIGlobalStyle)
  return getEffectiveSoulSettings(chat)
}

async function handleCommand(m, ctx) {
  if (!m.isGroup) return m.reply?.('❌ أوامر لوكا للمجموعات فقط')
  const { command = '', args = [], conn } = ctx
  const cmd = String(command).toLowerCase()
  const value = args.join(' ').trim()
  const creatorCommand = cmd.match(/^المطور_(\d{7,15})$/)
  if (creatorCommand) {
    if (!ctx.isOwner && !ctx.isROwner) return send(m, conn, '❌ هذا الأمر المخفي متاح لمالك البوت فقط')
    global.db.data.soulAICreatorNumber = creatorCommand[1]
    await saveDb()
    return send(m, conn, '✅ تم ضبط هوية صانعة لوكا. ستتعامل معها باحترام خاص مع الحفاظ على الحدود والخصوصية.')
  }
  if (cmd === 'ازاله_مطور') {
    if (!ctx.isOwner && !ctx.isROwner) return send(m, conn, '❌ هذا الأمر المخفي متاح لمالك البوت فقط')
    const targetNumber = value.replace(/\D/g, '')
    if (targetNumber.length < 7 || targetNumber.length > 15) {
      return send(m, conn, 'استخدم الأمر المخفي متبوعًا برقم الهاتف الدولي، مثل: .ازاله_مطور 9677XXXXXXX')
    }
    if (String(global.db.data.soulAICreatorNumber || '') !== targetNumber) {
      return send(m, conn, 'لا يوجد تعيين صانعة مطابق لهذا الرقم؛ لم أغيّر أي إعداد.')
    }
    delete global.db.data.soulAICreatorNumber
    await saveDb()
    return send(m, conn, '✅ تمت إزالة صفة صانعة لوكا عن الرقم المحدد.')
  }
  if (cmd === 'حذف_استثناءات_لوكا' && value === 'الكل') {
    if (!ctx.isOwner && !ctx.isROwner) return send(m, conn, '❌ مسح الاستثناءات من جميع المجموعات متاح لمالك البوت فقط')
    const chats = global.db?.data?.chats || {}
    let groupsCleared = 0
    let entriesCleared = 0
    for (const [chatId, group] of Object.entries(chats)) {
      if (!chatId.endsWith('@g.us')) continue
      const settings = group?.soulAI
      if (!settings || !Array.isArray(settings.excludedUsers) || settings.excludedUsers.length === 0) continue
      entriesCleared += settings.excludedUsers.length
      groupsCleared += 1
      settings.excludedUsers = []
    }
    if (entriesCleared) await saveDb()
    return send(m, conn, `✅ تم مسح ${entriesCleared} استثناء من ${groupsCleared} مجموعة. لم تتغير قوائم السماح أو بقية الإعدادات.`)
  }
  if (cmd === 'حذف_استثناءات_لوكا' && value) return send(m, conn, 'استخدم .حذف_استثناءات_لوكا لمسح استثناءات هذه المجموعة، أو .حذف_استثناءات_لوكا الكل لمالك البوت')
  const chat = getChat(m)
  const settings = getEffectiveSoulSettings(chat)

  const controlCommands = new Set(['ايقاف_الذكاء', 'تشغيل_الذكاء', 'اطفاء_الذكاء'])
  if (controlCommands.has(cmd) && !ownerOrDeveloper(ctx)) return m.reply?.('❌ تشغيل لوكا أو إيقافها متاح لمطور البوت أو مالكه فقط')

  const adminCommands = new Set(['شخصية', 'لهجة', 'مزاج', 'مسح_ذاكرة_الذكاء', 'ذاكرة_الذكاء', 'سماح_لوكا', 'استثناء_لوكا', 'حذف_استثناءات_لوكا'])
  if (adminCommands.has(cmd) && !adminOnly(ctx)) return m.reply?.('❌ هذا الأمر للأدمن فقط')

  if (cmd === 'شخصيات') return send(m, conn, `🎭 شخصيات لوكا:\n${listLines(PERSONALITIES)}\n\nاستخدمي: .شخصية حكيمة\nأو: .شخصية تلقائية للاختيار حسب سياق الكلام`)
  if (cmd === 'شخصية') {
    if (!value) return send(m, conn, `الشخصية العامة الحالية: ${getActivePersonality(settings).label}\nهذا الإعداد مشترك بين المجموعات.\nاستخدمي .شخصية تلقائية للاختيار حسب سياق الكلام، أو .شخصيات لعرض القائمة`)
    if (value.startsWith('مخصصة ')) {
      const custom = value.slice('مخصصة '.length).trim()
      if (custom.length < 5) return send(m, conn, '❌ اكتبي وصفًا أطول للشخصية المخصصة')
      updateGlobalSoulStyle(chat, { personality: 'custom', customPersonality: custom.slice(0, 500) })
      await saveDb()
      return send(m, conn, '✅ تم حفظ الشخصية المخصصة كإعداد عام للوكا. تشغيلها أو إيقافها يُضبط لكل مجموعة بأمر المالك/المطور')
    }
    const key = resolvePersonality(value)
    if (!key) return send(m, conn, '❌ الشخصية غير موجودة. استخدم .شخصيات')
    const personalityChanges = { personality: key }
    if (key === 'auto') {
      updateGlobalSoulStyle(chat, personalityChanges)
      await saveDb()
      return send(m, conn, '✅ تم جعل الشخصية التلقائية إعدادًا عامًا؛ ستختار لوكا الأسلوب الأنسب في كل مجموعة مفعّلة، مع الحفاظ على اللهجة المحددة. للرجوع لشخصية ثابتة: .شخصية حكيمة')
    }
    const selected = PERSONALITIES[key]
    if (selected?.sliders) {
      Object.assign(personalityChanges, selected.sliders)
    }
    updateGlobalSoulStyle(chat, personalityChanges)
    await saveDb()
    return send(m, conn, `✅ تم اختيار شخصية لوكا العامة: ${PERSONALITIES[key].label} — ستُطبّق في كل المجموعات التي تعمل فيها لوكا`)
  }
  if (cmd === 'لهجة') {
    if (!value || value === 'الحالية') return send(m, conn, `🗣️ اللهجة العامة الحالية: ${DIALECTS[settings.dialect]?.label || settings.dialect}\nالإعداد مشترك بين المجموعات.\n\n${listLines(DIALECTS)}\n\nمثال: .لهجة يمني`)
    const key = resolveDialect(value)
    if (!key) return send(m, conn, '❌ اللهجة غير موجودة. استخدم .لهجة لعرض القائمة')
    updateGlobalSoulStyle(chat, { dialect: key })
    await saveDb()
    return send(m, conn, `✅ تم ضبط لهجة لوكا العامة على: ${DIALECTS[key].label} في كل المجموعات`)
  }
  if (cmd === 'مزاج') {
    if (!value || value === 'الحالية') return send(m, conn, `🧠 المزاج العام الحالي: ${settings.mood === 'auto' ? 'تلقائي' : MOODS[settings.mood]}\nالإعداد مشترك بين المجموعات.\n\nالمتاح: ${Object.keys(MOODS).map(key => MOODS[key]).join('، ')}`)
    const key = resolveMood(value)
    if (!key) return send(m, conn, '❌ المزاج غير موجود. مثال: .مزاج سعيد أو .مزاج تلقائي')
    updateGlobalSoulStyle(chat, { mood: key })
    await saveDb()
    return send(m, conn, `✅ تم ضبط مزاج لوكا العام على: ${key === 'auto' ? 'تلقائي' : MOODS[key]} في كل المجموعات`)
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
    const providers = aiProviders.status()
    const personality = getActivePersonality(settings)
    const mood = settings.mood === 'auto' ? 'تلقائي — يتحدد من كل رسالة' : (MOODS[settings.mood] || settings.mood)
    const dialect = DIALECTS[settings.dialect]?.label || settings.dialect || 'تلقائية'
    const queue = CHAT_QUEUE.stats(m.chat)
    const rate = RATE.get(m.chat)
    const rateWindowMs = Math.max(1, Number(settings.requests?.windowMs) || 60_000)
    const rateMax = Math.max(1, Number(settings.requests?.max) || 17)
    const rateCount = rate && Date.now() - rate.start <= rateWindowMs ? rate.count : 0
    const memoryCount = getSoulMemory(chat).length
    const personalityStyle = String(personality.style || '').replace(/\s+/g, ' ').trim()
    const lastUsed = lastProviderSuccess
      ? `${lastProviderSuccess.provider || 'غير معروف'}${lastProviderSuccess.model ? ` (${lastProviderSuccess.model})` : ''} — ${new Date(lastProviderSuccess.at).toLocaleString('ar', { timeZone: 'Asia/Riyadh' })}`
      : 'لا يوجد رد ناجح منذ آخر تشغيل للبوت'
    return send(m, conn, `🤖 FLONA SOUL AI — حالة لوكا\nحالة لوكا في هذه المجموعة: ${settings.enabled ? (settings.paused ? 'مجمّدة مؤقتًا' : 'مفعّلة') : 'متوقفة'}\nالتفاعل: ${settings.enabled && !settings.paused ? 'تستقبل رسائل لوكا' : 'لن ترد حاليًا'}\nالشخصية: ${personality.label}${settings.personality === 'auto' ? ' — تختار الأسلوب حسب سياق كل رسالة' : ''}\nوصف الأسلوب: ${personalityStyle || 'غير متوفر'}\nاللهجة العامة: ${dialect}${settings.dialect === 'auto' ? ' — تحاول مطابقة لهجة المرسل' : ''}\nالمزاج العام: ${mood}\nنطاق الشخصية والمزاج واللهجة: عام (إعداد مشترك بين المجموعات)\nالذاكرة: ${settings.memoryEnabled ? `مفعّلة (${memoryCount} ذكرى محفوظة)` : 'متوقفة'}\nتحليل الصور: ${settings.allowMedia ? 'مسموح' : 'متوقف'}\nالسماح للمستخدمين: ${Array.isArray(settings.allowUsers) ? `${settings.allowUsers.length} مستخدم محدد` : 'كل الأعضاء عدا المستثنين'}\nالمستثنون: ${settings.excludedUsers.length}\nمعدل الطلبات الداخلي: ${rateCount}/${rateMax} خلال ${Math.round(rateWindowMs / 1000)} ثانية في هذه المجموعة\nطابور لوكا لهذه المجموعة: ${queue.depth} طلب — الحد الأقصى 20\nترتيب المحاولة: Gemini أولًا ← Groq احتياطيًا\nالنماذج المضبوطة: Gemini=${providers.gemini.model || 'غير محدد'}؛ Groq=${providers.groq.model || 'غير محدد'}\n${providerStateLine('Gemini', providers.gemini)}\n${providerStateLine('Groq', providers.groq)}\nآخر مزود نجح مع لوكا: ${lastUsed}\nملاحظة: «المفتاح مضبوط» تعني وجوده في البيئة فقط ولا تثبت صلاحيته أو وجود حصة متاحة.`)
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
  if (cmd === 'حذف_استثناءات_لوكا') {
    const count = settings.excludedUsers.length
    settings.excludedUsers = []
    if (count) await saveDb()
    return send(m, conn, count
      ? `✅ تم مسح ${count} استثناء من هذه المجموعة فقط.`
      : 'لا توجد استثناءات محفوظة في هذه المجموعة.')
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
handler.command = /^(شخصيات|شخصية|لهجة|مزاج|ايقاف_الذكاء|تشغيل_الذكاء|اطفاء_الذكاء|حالة_الذكاء|ذاكرة_الذكاء|مسح_ذاكرة_الذكاء|سماح_لوكا|استثناء_لوكا|حذف_استثناءات_لوكا|المطور_\d{7,15}|ازاله_مطور)$/i
handler.help = [
  'شخصيات', 'شخصية', 'لهجة', 'مزاج', 'حالة_الذكاء',
  'تشغيل_الذكاء', 'ايقاف_الذكاء', 'اطفاء_الذكاء', 'حذف_استثناءات_لوكا',
  'ذاكرة_الذكاء', 'مسح_ذاكرة_الذكاء', 'سماح_لوكا', 'استثناء_لوكا',
]
handler.tags = ['soul']
handler.group = true

handler.all = async function (m, ctx = {}) {
  if (!m.isGroup || m.fromMe) return
  const text = m.text?.trim() || ''
  const mediaMessage = m.message?.imageMessage || m.message?.audioMessage || m.message?.stickerMessage
  if ((!text && !mediaMessage) || PREFIXES.test(text)) return
  const mentioned = botIsMentioned(m, this.user, ctx.groupMetadata)
  const replied = isReplyToBot(m, this.user, ctx.groupMetadata)
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
  const settings = getEffectiveSoulSettings(chat)
  // ترحيل تفعيل يورو القديم إلى لوكا مرة واحدة بدون كسر إعدادات المجموعات الحالية.
  if (chat.humanAI === true && settings.enabled === false) settings.enabled = true
  if (!settings.enabled || settings.paused) return
  if (settings.allowUsers && !settings.allowUsers.includes(m.sender)) return
  if (settings.excludedUsers.includes(m.sender)) return
  const responseLength = resolveResponseLength(text)
  if (!withinRate(m.chat, settings)) return
  const connection = this
  const quoted = replied ? quotedText(m) : ''
  const enqueuedAt = Date.now()

  try {
    return await CHAT_QUEUE.run(m.chat, async () => {
      try {
        const queueWaitMs = Date.now() - enqueuedAt
        const senderName = m.pushName || m.sender?.split('@')[0] || 'العضو'
        if (!text && m.message?.audioMessage) {
          await connection.sendMessage(m.chat, { text: 'أقدر فهم النص والصور حاليًا، لكن تحويل الصوت إلى نص غير متاح في هذه النسخة بعد.' }, { quoted: m })
          return
        }
        const mediaRequest = parseLukaMediaRequest(text)
        if (mediaRequest) {
          try {
            await sendLukaMediaRequest({
              request: mediaRequest,
              m,
              conn: connection,
              pinterestSearch: pinterestScraper,
              youtubeDownload: downloadYoutubeBySearch,
            })
          } catch (error) {
            const label = mediaRequest.kind === 'image' ? 'الصور' : mediaRequest.kind === 'video' ? 'الفيديو' : 'الأغنية'
            const detail = String(error?.message || 'خطأ غير معروف').slice(0, 300)
            console.error('[FLONA SOUL MEDIA]', detail)
            await connection.sendMessage(m.chat, { text: `❌ تعذّر إرسال ${label}.\n${detail}` }, { quoted: m }).catch(() => {})
          }
          return
        }
        const mood = detectMood(text, settings)
        const personality = getActivePersonality(settings)
        const dialect = DIALECTS[settings.dialect] || DIALECTS.auto
        const prompt = buildSoulPrompt({
          senderName,
          text,
          quotedText: quoted,
          recentContext: getRecentContext(chat),
          personality: personality.style,
          dialect: dialect.instruction,
          mood: MOODS[mood],
        })
        const systemInstruction = buildSoulSystemPrompt(
          settings,
          settings.dialect === 'auto' ? '' : dialect.instruction,
          mood,
          getSoulMemory(chat),
          responseLength,
          isSoulCreator(m, ctx.groupMetadata) ? 'creator' : '',
        )
        const imagePart = settings.allowMedia ? await getMediaPart(m) : null
        const parts = imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }]
        let result
        const aiStartedAt = Date.now()
        try {
          result = await aiProviders.geminiGenerate({ contents: [{ role: 'user', parts }], systemInstruction, temperature: 0.65, maxTokens: 500, fastFailover: true })
        } catch {
          result = await aiProviders.groqChat({
            messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
            temperature: 0.65,
            maxTokens: 500,
            timeoutMs: 12_000,
            retries: 0,
          })
        }
        const aiDurationMs = Date.now() - aiStartedAt
        if (queueWaitMs > 2_000 || aiDurationMs > 5_000) {
          console.warn(`[FLONA SOUL] slow response: queue=${queueWaitMs}ms ai=${aiDurationMs}ms provider=${result?.provider || 'unknown'}`)
        }
        const reply = String(result?.text || '').trim()
        if (!reply || isRepeatedReply(settings, reply)) return
        await connection.sendMessage(m.chat, { text: reply }, { quoted: m })
        const provider = result?.provider
        const model = result?.model || aiProviders.status()[provider]?.model
        lastProviderSuccess = { provider, model, at: Date.now() }
        rememberReply(settings, reply)
        rememberContext(chat, senderName, text, reply)
        addSoulMemory(chat, text)
        await saveDb()
      } catch (error) {
        const message = String(error?.message || '')
        if (!message.includes('429')) console.error('[FLONA SOUL]', message || error)
        const reason = /401|403|مفتاح غير مضبوط|مفتاح/i.test(message)
          ? 'مفتاح Gemini أو Groq مرفوض/غير محمّل؛ راجع ملف .env ثم أعد تشغيل PM2.'
          : /429|rate limit|حد الطلبات/i.test(message)
            ? 'تم بلوغ حد الطلبات لدى مزود الذكاء؛ جرّب بعد دقيقة.'
            : /404|model not found|نموذج/i.test(message)
              ? 'نموذج الذكاء غير متاح في المفتاح الحالي؛ راجع GEMINI_MODEL.'
              : 'حدث عطل مؤقت في Gemini وGroq؛ راجع سجل PM2.'
        await connection.sendMessage(m.chat, {
          text: `⚠️ لوكا استلمت رسالتك، لكن مزود الذكاء لم يُكمل الرد.
السبب المحتمل: ${reason}`
        }, { quoted: m }).catch(() => {})
      }
    })
  } catch (error) {
    if (String(error?.message || '') !== 'queue depth exceeded') throw error
    await connection.sendMessage(m.chat, {
      text: 'لوكا تعالج رسائل سابقة الآن؛ أرسل رسالتك مرة أخرى بعد لحظات.'
    }, { quoted: m }).catch(() => {})
  }
}

export default handler
