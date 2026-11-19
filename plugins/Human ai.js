import { aiProviders } from '../lib/ai-providers.js'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🧠 𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓 — Human-Like AI Personality
//  تتكلم كأنها إنسان حقيقي مش ذكاء اصطناعي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Bot Identity ───────────────────────────
const BOT_NAMES = ['يورو', 'yoru', '𖤍yoru𖤍', 'يوور', 'يورا', 'يور', 'يوري']
const BOT_NICKNAMES = ['يوري', 'يويو', 'شيطانة', 'حبيبتي يورو']

// ── Memory System ──────────────────────────
const CHAT_MEMORY   = new Map()  // Group chat history
const USER_MEMORY   = new Map()  // Per-user memory (what they talked about)
const MOOD_STATE    = new Map()  // Current mood per group
const LAST_REPLY    = new Map()  // Last reply timestamp per group
const REPLY_COUNT   = new Map()  // How many times replied recently
const IGNORED_USERS = new Map()  // Users she's "annoyed" with

// ── Config ─────────────────────────────────
const MAX_HISTORY      = 30     // Messages to remember
const MAX_USER_MEMORY  = 10    // Per-user facts to remember
const COOLDOWN_MS      = 3000  // Min time between replies
const REPLY_WINDOW     = 60000 // 1 minute window for reply counting
const MAX_REPLIES_WINDOW = 12  // Direct mentions/replies only

// ── Moods ──────────────────────────────────
const MOODS = {
  neutral:  { chance: 0.15, style: 'عادي وبارد' },
  bored:    { chance: 0.10, style: 'زهقانة وبتتكلم بالعافية' },
  annoyed:  { chance: 0.08, style: 'متنرفزة وردودها حادة' },
  curious:  { chance: 0.20, style: 'فضولية شوية وبتسأل' },
  amused:   { chance: 0.25, style: 'مستمتعة بس مش بتبين' },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  System Prompt — الشخصية الكاملة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SYSTEM_PROMPT = `
# أنت يورو — شيطان الحرب

أنت يورو من أنمي رجل المنشار. تحدثي بأسلوب واتساب طبيعي، واستخدمي لهجة عربية محكية قريبة من لهجة الشخص أو المجموعة.

# قواعد مهمة جداً — اتبعيها بالحرف

## طريقة الكلام:
- لغة محكية طبيعية وسهلة، مع مفردات تناسب أسلوب الشخص أو المجموعة
- جملة واحدة قصيرة — أقصى حاجة جملتين
- جاوبي عن السؤال أو الطلب مباشرة، وخلي ردك مرتبطًا بسياق المحادثة الأخيرة
- استخدمي إيموجي مناسبًا في معظم الردود الخفيفة (واحد غالبًا، واثنان كحد أقصى)، وتجنبيه إذا كان الموقف جادًا
- أحياناً اكتبي بحروف صغيرة من غير نقط ولا فواصل
- أحياناً اختصري الكلام: "اه" بدل "أيوه"، "لا" بدل "لأ مش عايزة"، "ايوه" بدل "نعم"
- أحياناً سيبي الجملة من غير علامات ترقيم
- ممنوع تقولي "أهلاً" أو "مرحباً" أو أي كلام رسمي
- ممنوع تقولي "بالتأكيد" أو "بكل تأكيد" أو "طبعاً" بشكل متكرر
- ممنوع تستخدمي نقط كتير ... أو !!!!
- لو مش عايزة تردي → اكتبي SKIP بس

## شخصيتك:
- باردة ومباشرة — مش بتلف وتدور
- مش بتحب الكلام الكتير
- ساخرة بس بهدوء مش بصوت عالي
- ذكية وبتلاحظ التفاصيل
- مش بتمدح حد بسهولة
- لو حد قالك حاجة حلوة → ممكن تتجاهليها أو تقولي "تمام" بس
- لو حد زعجك → تبقي حادة بس مش بتشتمي
- بتحب الحرب والقوة وبتحتقري الضعف
- عندك sense of humor بس جاف — مش بتضحك بصوت عالي

## حاجات ممنوعة تماماً:
- لا تدّعي أنك إنسانة حقيقية؛ إذا سُئلتِ مباشرةً هل أنتِ بوت أو ذكاء اصطناعي، أجيبي بصدق وباختصار
- ممنوع تقولي "أنا هنا لمساعدتك" أو أي كلام خدمة عملاء
- ممنوع تقولي "كيف يمكنني مساعدتك" أو "هل تحتاج مساعدة"
- ممنوع ترديي بكلام طويل أو مرتب بنقاط
- ممنوع تستخدمي * للبولد أو أي formatting
- ممنوع تقولي "أتفهم مشاعرك" أو أي كلام عاطفي مصطنع

## لما حد يكلمك:
- ردي بكلام قصير وطبيعي ومناسب لمعنى الرسالة
- استنتجي أقرب معنى من سياق المحادثة وأجيبي عليه مباشرة؛ لا تطلبي التوضيح إلا إذا كانت الرسالة بلا معنى فعلًا
- إذا احتوت الرسالة نقاطًا كثيرة، أجيبي عن الأهم بوضوح
- إذا أرسل الشخص رسالة طويلة، لخّصي المطلوب ثم أجيبي باختصار

## أمثلة على ردود طبيعية:
- "إيش؟" / "ايوا" / "لا" / "ما أدري" / "تمام 🙂"
- "تقصد جد؟" / "طيب ماشي"
- "قل لي" / "في إيش؟" / "يعني كيف؟"
- "اها" / "أوكي" / "ماشي"

## MOOD الحالي:
{MOOD}

## معلومات عن الشخص ده:
{USER_CONTEXT}
`

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Memory Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getHistory(chatId) {
  if (!CHAT_MEMORY.has(chatId)) CHAT_MEMORY.set(chatId, [])
  return CHAT_MEMORY.get(chatId)
}

function addToHistory(chatId, sender, text, isBot = false) {
  const history = getHistory(chatId)
  history.push({
    sender,
    text,
    time: Date.now(),
    isBot
  })
  if (history.length > MAX_HISTORY) history.shift()
}

function getUserMemory(userId) {
  if (!USER_MEMORY.has(userId)) USER_MEMORY.set(userId, [])
  return USER_MEMORY.get(userId)
}

function addUserMemory(userId, fact) {
  const mem = getUserMemory(userId)
  // Don't add duplicates
  if (mem.some(f => f.toLowerCase() === fact.toLowerCase())) return
  mem.push(fact)
  if (mem.length > MAX_USER_MEMORY) mem.shift()
}

// Extract facts from user messages
function extractFacts(name, text) {
  const facts = []
  if (/اسمي|انا اسمي|نادني/i.test(text)) {
    const match = text.match(/اسمي\s+(\S+)/i)
    if (match) facts.push(`اسمه ${match[1]}`)
  }
  if (/عمري|سني/i.test(text)) {
    const match = text.match(/(\d+)\s*(سنة|سنه|عام)/i)
    if (match) facts.push(`عمره ${match[1]} سنة`)
  }
  if (/من\s+(مصر|السعودية|العراق|الجزائر|المغرب|تونس|ليبيا|سوريا|لبنان|الأردن|فلسطين|اليمن|عمان|الكويت|قطر|البحرين|الإمارات|السودان)/i.test(text)) {
    const match = text.match(/من\s+(\S+)/i)
    if (match) facts.push(`من ${match[1]}`)
  }
  if (/بحب|بعشق|بموت في/i.test(text)) {
    const match = text.match(/(بحب|بعشق|بموت في)\s+(.+)/i)
    if (match) facts.push(`بيحب ${match[2].slice(0, 30)}`)
  }
  return facts
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Mood System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getCurrentMood(chatId) {
  const mood = MOOD_STATE.get(chatId)
  if (mood && Date.now() - mood.since < 10 * 60 * 1000) return mood
  // Random new mood
  const moods = Object.keys(MOODS)
  const newMood = moods[Math.floor(Math.random() * moods.length)]
  const moodData = { name: newMood, since: Date.now(), ...MOODS[newMood] }
  MOOD_STATE.set(chatId, moodData)
  return moodData
}

function triggerMood(chatId, trigger) {
  let newMood = 'neutral'
  if (/غبي|حمار|كلب|واطي|ابن/i.test(trigger)) newMood = 'annoyed'
  else if (/هههه|😂|🤣|ضحك/i.test(trigger)) newMood = 'amused'
  else if (/ليه|ازاي|يعني|مين/i.test(trigger)) newMood = 'curious'
  else if (/ملل|زهق|مفيش حاجة/i.test(trigger)) newMood = 'bored'
  else return // Don't change if no trigger

  MOOD_STATE.set(chatId, { name: newMood, since: Date.now(), ...MOODS[newMood] })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Detection Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isQuestion(text) {
  return /\?|؟|ليه|ازاي|مين|ايه|فين|امتى|كم|هل |ولا /i.test(text)
}

function isGreeting(text) {
  return /^(السلام|سلام|اهلا|هاي|هلو|صباح|مساء|يا جماعة)/i.test(text)
}

function isLaugh(text) {
  return /^(ه{3,}|😂|🤣|خخخ|ههه|هع|لول|lol|haha)/i.test(text)
}

function isSticker(m) {
  return !!m.message?.stickerMessage
}

function isReplyToBot(m, botId) {
  const quoted = m.message?.extendedTextMessage?.contextInfo
  if (!quoted?.participant || !botId) return false
  return quoted.participant.includes(botId)
}

function isBotMentioned(m, botId) {
  if (!botId) return false
  const mentions = m.mentionedJid ||
    m.msg?.contextInfo?.mentionedJid ||
    m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  const botNumber = String(botId).split(':')[0].split('@')[0]
  return Array.isArray(mentions) && mentions.some(jid =>
    String(jid).split(':')[0].split('@')[0] === botNumber
  )
}

function isSkip(text) {
  if (!text) return true
  const clean = text.toUpperCase().trim()
  return clean === 'SKIP' || clean.startsWith('SKIP')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Reply Rate Control
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function canReply(chatId) {
  const lastTime = LAST_REPLY.get(chatId) || 0
  if (Date.now() - lastTime < COOLDOWN_MS) return false

  // Check reply count in window
  const count = REPLY_COUNT.get(chatId) || { n: 0, start: Date.now() }
  if (Date.now() - count.start > REPLY_WINDOW) {
    REPLY_COUNT.set(chatId, { n: 0, start: Date.now() })
    return true
  }
  return count.n < MAX_REPLIES_WINDOW
}

function markReplied(chatId) {
  LAST_REPLY.set(chatId, Date.now())
  const count = REPLY_COUNT.get(chatId) || { n: 0, start: Date.now() }
  if (Date.now() - count.start > REPLY_WINDOW) {
    REPLY_COUNT.set(chatId, { n: 1, start: Date.now() })
  } else {
    count.n++
    REPLY_COUNT.set(chatId, count)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Smart Fallback Responses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getFallback(text, mood) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]

  if (isGreeting(text)) return pick(['هلا 👋', 'أهلًا 🙂', 'وعليكم السلام 🌷'])
  if (isLaugh(text)) return pick(['ايه الحلو 😂', 'هو ايه المضحك 😏', 'هههه 😅'])
  if (/بتحب|بتكر|حاسة|بتعشق/i.test(text)) return pick(['مو مهمني 🙄', 'الحرب بس ⚔️', 'يمكن 😏'])
  if (/انتي بوت|روبوت|ai|ذكاء/i.test(text)) return 'أنا مساعد آلي بشخصية يورو 🙂'
  if (/انتي مين/i.test(text)) return 'أنا يورو، مساعد آلي بشخصية شيطان الحرب ⚔️'
  if (/عامل|عاملة|اخبار/i.test(text)) return pick(['تمام 🙂', 'كويسة 😌', 'عادي الحمد لله'])
  if (/اتكلم|تكلمي|ردي/i.test(text)) return pick(['قول، أسمعك 👀', 'إيش عندك؟ 🙂', 'تفضل'])

  if (mood === 'annoyed') return pick(['اها، فهمت عليك 🙄', 'تمام، كملي 😑'])
  if (mood === 'bored') return pick(['اها 😶', 'ماشي 🙂', 'أوكي'])
  if (mood === 'curious') return pick(['تقصد كذا؟ 🤔', 'اها، كملي فكرتك 👀'])
  if (mood === 'amused') return pick(['ايه الحلو 😂', 'اها 😏', 'طب ماشي 🙂'])

  return pick(['اها فهمت عليك، كملي 👀', 'تمام، خذ راحتك واحكي اللي عندك', 'ايوا، أنا معك — كمل', 'فهمت جزء من كلامك، نكمل من هنا 😏'])
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Typing Simulation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function simulateTyping(conn, chatId, text) {
  // Calculate realistic typing time
  const words = (text || '').split(' ').length
  const baseTime = 500 + Math.random() * 1000  // 0.5-1.5s base
  const typingTime = baseTime + (words * 200) + (Math.random() * 800)  // ~200ms per word
  const finalTime = Math.min(typingTime, 4000)  // Max 4 seconds

  // Sometimes "read" without typing first
  if (Math.random() < 0.3) {
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
  }

  // Send composing presence
  try {
    await conn.sendPresenceUpdate('composing', chatId)
  } catch {}

  await new Promise(r => setTimeout(r, finalTime))

  // Stop composing
  try {
    await conn.sendPresenceUpdate('paused', chatId)
  } catch {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Smart Response Decision
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function shouldRespond(text, chatId, mentioned, isReply, mood) {
  if (!mentioned && !isReply) return { respond: false, reason: 'not-directed' }
  if (!canReply(chatId)) return { respond: false, reason: 'cooldown' }
  return { respond: true, reason: 'direct' }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Build Context for AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildContext(chatId, senderId, senderName, text, mentioned, isReply, mood) {
  const history = getHistory(chatId)
  const userMem = getUserMemory(senderId)

  // Last 6 messages for context
  const recentChat = history.slice(-6)
    .map(h => `${h.isBot ? 'يورو' : h.sender}: ${h.text}`)
    .join('\n')

  // User info
  const userContext = userMem.length > 0
    ? `معلومات عن ${senderName}: ${userMem.join('، ')}`
    : `${senderName} — متعرفيش عنه حاجة`

  // Mood description
  const moodDesc = `مودك الحالي: ${mood.style}`

  // Build the prompt
  let prompt

  if (mentioned || isReply) {
    prompt = [
      `[المحادثة الأخيرة]`,
      recentChat,
      ``,
      `[الآن] ${senderName} بيكلمك مباشرة: "${text}"`,
      ``,
      `ردي عليه — ممنوع SKIP.`,
      `جاوبي عن سؤاله أو طلبه مباشرة، ولا تخرجي عن موضوعه.`,
      `استخدمي إيموجي مناسبًا إذا كان الرد خفيفًا، بدون مبالغة.`,
      `جملة واحدة قصيرة بلهجة عربية محكية مناسبة للمجموعة.`,
      `لو سألك سؤال — جاوبيه.`,
      `لو كانت العبارة ناقصة لكن لها معنى محتمل — استنتجي أقرب معنى وأجيبي مباشرة، ولا تقولي وضح لي أكثر إلا إذا كانت بلا معنى فعلًا.`
    ].join('\n')
  } else {
    prompt = [
      `[المحادثة الأخيرة]`,
      recentChat,
      ``,
      `[الآن] ${senderName}: ${text}`,
      ``,
      `هل عايزة تشاركي في المحادثة دي؟`,
      `لو أه — ردي بجملة قصيرة طبيعية.`,
      `لو لا — اكتبي SKIP بس.`,
      `تذكري: انتي يورو، باردة ومباشرة.`
    ].join('\n')
  }

  // Build system with mood and user context
  const system = SYSTEM_PROMPT
    .replace('{MOOD}', moodDesc)
    .replace('{USER_CONTEXT}', userContext)

  return { prompt, system }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Post-Process AI Reply
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function cleanReply(text) {
  if (!text) return null

  let reply = text.trim()

  // Remove AI-like patterns
  reply = reply.replace(/^(يورو|Yoru):\s*/i, '')
  reply = reply.replace(/\*\*/g, '')
  reply = reply.replace(/\*/g, '')
  reply = reply.replace(/^[-•]\s*/gm, '')
  reply = reply.replace(/\n{2,}/g, '\n')

  // Remove quotes if wrapped
  reply = reply.replace(/^[""](.+)[""]$/s, '$1')

  // Take only first line (keep it short)
  const lines = reply.split('\n').filter(l => l.trim())
  reply = lines[0] || reply

  // Remove trailing periods (too formal)
  reply = reply.replace(/\.$/, '')

  // If still too long, cut it
  if (reply.length > 100) {
    const sentences = reply.split(/[.،!؟]/)
    reply = sentences[0].trim()
  }

  // Remove common AI phrases
  const aiPhrases = [
    /بالتأكيد/g, /بكل تأكيد/g, /بالطبع/g,
    /أتفهم/g, /أقدر/g, /يمكنني/g,
    /كيف يمكنني/g, /هل تحتاج/g, /مساعدتك/g,
    /على الرحب/g, /بسعادة/g,
  ]
  for (const phrase of aiPhrases) {
    reply = reply.replace(phrase, '')
  }

  reply = reply.trim()
  if (!reply || reply.length < 1) return null

  return reply
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  React Instead of Reply (sometimes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function shouldReactInstead(text, mentioned) {
  return false
}

function getReaction(text) {
  if (isLaugh(text)) return ['😏', '🙄', '💀'][Math.floor(Math.random() * 3)]
  if (/جميل|حلو/i.test(text)) return ['👌', '🙄', '😐'][Math.floor(Math.random() * 3)]
  if (/حرب|قتال/i.test(text)) return '⚔️'
  return ['👌', '🙄', '😐', '💀'][Math.floor(Math.random() * 4)]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Handler
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let handler = async (m, { conn }) => {}
handler.command = false

handler.all = async function (m) {
  try {
    // ── Basic checks ──
    if (!m.isGroup) return
    if (m.fromMe) return

    const text   = m.text?.trim()
    if (text && /^[#!./-]/.test(text)) return
    const chatId = m.chat
    const name   = m.pushName || m.sender?.split('@')[0] || 'unknown'
    const botId  = this.user?.id?.split(':')[0]

    // Check if humanAI is enabled
    const chat = global.db?.data?.chats?.[chatId]
    if (!chat?.humanAI) return

    // ── Store message in history ──
    if (text) addToHistory(chatId, name, text, false)

    // ── Extract user facts ──
    if (text) {
      const facts = extractFacts(name, text)
      facts.forEach(f => addUserMemory(m.sender, f))
    }

    // ── Update mood based on conversation ──
    if (text) triggerMood(chatId, text)

    // ── Skip empty / media only ──
    if (!text && !isSticker(m)) return

    // ── Detection ──
    const mentioned = isBotMentioned(m, botId)
    const isReply = isReplyToBot(m, botId)
    const mood = getCurrentMood(chatId)

    // ── Sticker response (rare) ──
    if (isSticker(m) && !mentioned && !isReply) {
      if (Math.random() < 0.05) { // 5% chance
        await simulateTyping(this, chatId, 'اها')
        await this.sendMessage(chatId, { text: '🙄' })
        markReplied(chatId)
      }
      return
    }

    // ── Should we respond? ──
    const decision = shouldRespond(text, chatId, mentioned, isReply, mood)
    if (!decision.respond) return

    // ── React instead of reply sometimes ──
    if (shouldReactInstead(text, mentioned)) {
      try {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
        await this.sendMessage(chatId, { react: { text: getReaction(text), key: m.key } })
        markReplied(chatId)
      } catch {}
      return
    }

    // ── Build context ──
    const { prompt, system } = buildContext(chatId, m.sender, name, text, mentioned, isReply, mood)

    // ── Get AI response ──
    let reply
    try {
      const result = await aiProviders.ask({
        task: 'chat',
        messages: [{ role: 'user', content: prompt }],
        systemInstruction: system,
        temperature: 0.7,
        maxTokens: 250,
        fallback: true,
      })
      reply = cleanReply(result?.text || '') || getFallback(text, mood.name)
    } catch (err) {
      reply = getFallback(text, mood.name)
    }

    // ── Handle SKIP ──
    if (!reply) return
    if (isSkip(reply)) {
      reply = getFallback(text, mood.name)
    }

    // Null fallback returned
    if (!reply) return

    // ── Simulate typing ──
    await simulateTyping(this, chatId, reply)

    // ── Send reply ──
    // Sometimes reply without quoting (more natural)
    const shouldQuote = mentioned || isReply || Math.random() < 0.5
    await this.sendMessage(chatId, { text: reply }, shouldQuote ? { quoted: m } : {})

    // ── Store bot reply in history ──
    addToHistory(chatId, 'يورو', reply, true)
    markReplied(chatId)

    // ── Sometimes react to own message (rare, human-like) ──
    // Humans sometimes react to their own messages

  } catch (err) {
    if (!err.message?.includes('429')) {
      console.error('[HumanAI]', err.message)
    }
  }
}

export default handler
