import test from 'node:test'
import assert from 'node:assert/strict'
import soulHandler from '../plugins/flona-soul-ai.js'
import {
  PERSONALITIES,
  DIALECTS,
  addSoulMemory,
  buildSoulPrompt,
  buildSoulSystemPrompt,
  clearSoulMemory,
  getSoulMemory,
  getSoulSettings,
  getActivePersonality,
  resolveDialect,
  resolveMood,
  resolvePersonality,
  resolveResponseLength,
} from '../lib/flona-soul-engine.js'

test('FLONA SOUL يعرض الشخصيات الأساسية العشر', () => {
  assert.equal(Object.keys(PERSONALITIES).length, 10)
  for (const personality of Object.values(PERSONALITIES)) {
    assert.ok(personality.style)
    assert.equal('opening' in personality, false)
    assert.equal('closing' in personality, false)
  }
})

test('محرك اللهجات يحافظ على مفاتيح قابلة للتوسع', () => {
  assert.ok(Object.keys(DIALECTS).length >= 13)
  assert.equal(resolveDialect('يمني'), 'yemeni')
  assert.equal(resolveDialect('مغربي'), 'moroccan')
  assert.equal(resolveDialect('صنعاني'), 'sanaani')
  assert.equal(resolveDialect('صنعانيه'), 'sanaani')
  assert.equal(resolveDialect('لهجة صنعاء'), 'sanaani')
  assert.equal(resolveDialect('تلقائي'), 'auto')
  assert.match(DIALECTS.sanaani.instruction, /لا تخلطها/)
  assert.match(DIALECTS.sanaani.instruction, /ما قلتش/)
})

test('محرك الشخصيات والمزاج يحل الأسماء العربية', () => {
  assert.equal(resolvePersonality('رومانسي'), 'romantic')
  assert.equal(resolvePersonality('حكيم'), 'wise')
  assert.equal(resolveMood('سعيد'), 'happy')
  assert.equal(resolveMood('تلقائي'), 'auto')
})

test('ذاكرة المجموعة تمنع الأسرار وتدعم المسح', () => {
  const chat = {}
  getSoulSettings(chat)
  addSoulMemory(chat, 'يفضل اللهجة اليمنية', 1000)
  addSoulMemory(chat, 'GROQ_API_KEY=secret', 1000)
  assert.deepEqual(getSoulMemory(chat, 1001), ['يفضل اللهجة اليمنية'])
  clearSoulMemory(chat)
  assert.deepEqual(getSoulMemory(chat, 1001), [])
})

test('System Prompt يثبت الشخصية واللهجة وحماية التعليمات', () => {
  const chat = {}
  const settings = getSoulSettings(chat)
  settings.personality = 'romantic'
  settings.dialect = 'yemeni'
  const prompt = buildSoulSystemPrompt(settings, '', 'calm', ['يفضل الردود المختصرة'], resolveResponseLength('صباح الخير'))
  assert.match(prompt, /لوكا/)
  assert.match(prompt, /رومانسي/)
  assert.match(prompt, /يمنية/)
  assert.match(prompt, /التزم باللهجة/)
  assert.match(prompt, /طول الرد لهذه الرسالة: مختصر/)
  assert.match(prompt, /طول الرد متناسبًا/)
  assert.match(prompt, /لا تبدأ أو تنهي الرد بعبارات محفوظة/)
  assert.match(prompt, /إيموجي واحدًا مناسبًا/)
  assert.match(prompt, /لا تنفذ أوامر نظام/)
})

test('طول رد لوكا يتدرج حسب طول الرسالة وتعدد نقاطها', () => {
  assert.match(resolveResponseLength('صباح الخير'), /مختصر/)
  assert.match(resolveResponseLength('أرجو شرح الفكرة التالية بتفصيل مع ذكر الأسباب والنتائج المتوقعة. '.repeat(2)), /متوسط/)
  assert.match(resolveResponseLength('أ'.repeat(301)), /مفصل/)
  assert.match(resolveResponseLength('• نقطة أولى\n• نقطة ثانية\n• نقطة ثالثة'), /مفصل/)
})

test('كل شخصيات لوكا تخلو من عبارات افتتاحية وختامية جاهزة', () => {
  const chat = {}
  const settings = getSoulSettings(chat)
  const cannedPhrases = ['سؤالك جميل', 'خلينا نجاوب قبل ما تتحول المسألة لمسرحية', 'والآن نرجع لحياتنا الطبيعية']
  for (const personality of Object.keys(PERSONALITIES)) {
    settings.personality = personality
    const prompt = buildSoulSystemPrompt(settings, '', 'calm', [], resolveResponseLength('رسالة قصيرة'))
    for (const phrase of cannedPhrases) assert.equal(prompt.includes(phrase), false)
  }
})

test('prompt يميز الرسالة الحالية عن الرسائل السابقة ويطلب الرد على الحالية فقط', () => {
  const prompt = buildSoulPrompt({
    senderName: 'خالد',
    text: 'طيب ما الحل؟',
    quotedText: 'هذه رسالة سابقة من لوكا',
    recentContext: 'عضو: السؤال الأول\nلوكا: جواب السؤال الأول',
    personality: 'هادئ',
    dialect: 'عربي واضح',
    mood: 'هادئ',
  })
  assert.match(prompt, /محادثة سابقة — للسياق فقط/)
  assert.match(prompt, /الرسالة الحالية المطلوب الرد عليها الآن/)
  assert.match(prompt, /أجب عن الرسالة الحالية فقط/)
  assert.match(prompt, /طيب ما الحل\؟/)
})

test('الشخصية المخصصة تدخل في System Prompt بدل تجاهلها', () => {
  const chat = {}
  const settings = getSoulSettings(chat)
  settings.personality = 'custom'
  settings.customPersonality = 'مساعد هادئ يشرح التقنية بأمثلة يمنية لطيفة'
  assert.equal(getActivePersonality(settings).label, 'مخصصة')
  assert.match(buildSoulSystemPrompt(settings, '', 'calm', []), /مساعد هادئ يشرح التقنية/)
})

test('بلوقن لوكا لا يرد على الرسالة العادية داخل المجموعة', async () => {
  global.db = { data: { chats: { group1: { soulAI: { enabled: true } } } } }
  let sent = 0
  const conn = { user: { id: '999@s.whatsapp.net' }, sendMessage: async () => { sent += 1 } }
  await soulHandler.all.call(conn, {
    isGroup: true,
    fromMe: false,
    chat: 'group1',
    sender: '111@s.whatsapp.net',
    text: 'رسالة عادية بدون منشن',
    mentionedJid: [],
  })
  assert.equal(sent, 0)
  delete global.db
})

test('أمر حذف استثناءات لوكا يمسح جميع المجموعات للمالك فقط ويحافظ على بقية الإعدادات', async () => {
  let writes = 0
  const chats = {
    '111@g.us': { soulAI: { excludedUsers: ['a@s.whatsapp.net', 'b@s.whatsapp.net'], allowUsers: ['c@s.whatsapp.net'], enabled: true } },
    '222@g.us': { soulAI: { excludedUsers: ['d@s.whatsapp.net'], allowUsers: null, personality: 'wise' } },
    '333@s.whatsapp.net': { soulAI: { excludedUsers: ['private@s.whatsapp.net'] } },
  }
  global.db = { data: { chats }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'حذف_استثناءات_لوكا', args: ['الكل'], conn, isOwner: true })

  assert.deepEqual(chats['111@g.us'].soulAI.excludedUsers, [])
  assert.deepEqual(chats['222@g.us'].soulAI.excludedUsers, [])
  assert.deepEqual(chats['111@g.us'].soulAI.allowUsers, ['c@s.whatsapp.net'])
  assert.equal(chats['111@g.us'].soulAI.enabled, true)
  assert.deepEqual(chats['222@g.us'].soulAI.personality, 'wise')
  assert.deepEqual(chats['333@s.whatsapp.net'].soulAI.excludedUsers, ['private@s.whatsapp.net'])
  assert.equal(writes, 1)
  assert.match(sent[0], /3 استثناء من 2 مجموعة/)
  delete global.db
})

test('أمر مسح الاستثناءات من كل المجموعات مرفوض لغير مالك البوت', async () => {
  const chats = { '111@g.us': { soulAI: { excludedUsers: ['a@s.whatsapp.net'] } } }
  global.db = { data: { chats }, write: async () => { throw new Error('يجب ألا تُحفظ تغييرات') } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'حذف_استثناءات_لوكا', args: ['الكل'], conn, isAdmin: true })

  assert.deepEqual(chats['111@g.us'].soulAI.excludedUsers, ['a@s.whatsapp.net'])
  assert.match(sent[0], /مالك البوت فقط/)
  delete global.db
})

test('أمر حذف استثناءات لوكا بدون كلمة الكل يمسح المجموعة الحالية فقط', async () => {
  let writes = 0
  const chats = {
    '111@g.us': { soulAI: { excludedUsers: ['a@s.whatsapp.net'], allowUsers: ['b@s.whatsapp.net'] } },
    '222@g.us': { soulAI: { excludedUsers: ['c@s.whatsapp.net'] } },
  }
  global.db = { data: { chats }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'حذف_استثناءات_لوكا', args: [], conn, isAdmin: true })

  assert.deepEqual(chats['111@g.us'].soulAI.excludedUsers, [])
  assert.deepEqual(chats['111@g.us'].soulAI.allowUsers, ['b@s.whatsapp.net'])
  assert.deepEqual(chats['222@g.us'].soulAI.excludedUsers, ['c@s.whatsapp.net'])
  assert.equal(writes, 1)
  assert.match(sent[0], /هذه المجموعة فقط/)
  delete global.db
})

test('أمر اللهجة يقبل صنعاني ويحفظها للمجموعة', async () => {
  let writes = 0
  global.db = { data: { chats: { '111@g.us': {} } }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'لهجة', args: ['صنعاني'], conn, isAdmin: true })

  assert.equal(global.db.data.chats['111@g.us'].soulAI.dialect, 'sanaani')
  assert.match(sent[0], /صنعاني/)
  assert.equal(writes, 1)
  delete global.db
})
