import test from 'node:test'
import assert from 'node:assert/strict'
import { aiProviders } from '../lib/ai-providers.js'
import soulHandler from '../plugins/flona-soul-ai.js'
import rareFeaturesHandler from '../plugins/الميزات-النادرة.js'
import { parseLukaMediaRequest, sendLukaMediaRequest } from '../lib/luka-media.js'
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

test('FLONA SOUL يعرض شخصيات مؤنثة ووضع الشخصية التلقائية', () => {
  assert.equal(Object.keys(PERSONALITIES).filter(key => key !== 'auto').length, 11)
  assert.equal(PERSONALITIES.auto.label, 'تلقائية حسب السياق')
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
  assert.equal(resolveDialect('صنعانية'), 'sanaani')
  assert.equal(resolveDialect('لهجة صنعاء'), 'sanaani')
  assert.equal(resolveDialect('تعزية'), 'taizzi')
  assert.equal(resolveDialect('تعزي'), 'taizzi')
  assert.equal(resolveDialect('لهجة تعز'), 'taizzi')
  assert.equal(resolveDialect('تلقائي'), 'auto')
  assert.match(DIALECTS.sanaani.instruction, /لا تخلطيها/)
  assert.match(DIALECTS.sanaani.instruction, /أشتي\/تشتي/)
  assert.match(DIALECTS.sanaani.instruction, /دحين/)
  assert.match(DIALECTS.sanaani.instruction, /شاروح/)
  assert.match(DIALECTS.sanaani.instruction, /ما فهمتش/)
  assert.match(DIALECTS.sanaani.instruction, /لا تحشري القائمة كلها/)
  assert.match(DIALECTS.taizzi.instruction, /شاشوفك/)
  assert.match(DIALECTS.taizzi.instruction, /أكه\/هكه/)
  assert.match(DIALECTS.taizzi.instruction, /لا تخلطيها بالصنعانية أو العدنية/)
})

test('محرك الشخصيات والمزاج يحل الأسماء العربية', () => {
  assert.equal(resolvePersonality('رومانسي'), 'romantic')
  assert.equal(resolvePersonality('رومانسية'), 'romantic')
  assert.equal(resolvePersonality('حكيم'), 'wise')
  assert.equal(resolvePersonality('حكيمة'), 'wise')
  assert.equal(resolvePersonality('تلقائي'), 'auto')
  assert.equal(resolvePersonality('auto'), 'auto')
  assert.equal(resolvePersonality('oblique'), 'oblique')
  assert.equal(resolvePersonality('منحرفة'), 'oblique')
  assert.equal(resolveMood('سعيد'), 'happy')
  assert.equal(resolveMood('سعيدة'), 'happy')
  assert.equal(resolveMood('تلقائي'), 'auto')
})

test('شخصية Oblique جريئة وموحية مع تعليمات موافقة وحدود واضحة', () => {
  const settings = getSoulSettings({})
  settings.personality = resolvePersonality('Oblique')

  const prompt = buildSoulSystemPrompt(settings, '', 'calm', [])
  assert.equal(getActivePersonality(settings).label, 'Oblique — منحرفة مشاكسة')
  assert.match(prompt, /صريحة ومباشرة في الغزل والتعبير عن الانجذاب والرغبة/)
  assert.match(prompt, /بلا سرد جنسي صريح/)
  assert.match(prompt, /احترمي الموافقة والحدود/)
  assert.match(prompt, /لا توجّهي هذا الأسلوب لقاصر/)
})

test('الشخصية التلقائية تعرض خيارات الأسلوب وتفصلها عن اللهجة', () => {
  const chat = {}
  const settings = getSoulSettings(chat)
  settings.personality = resolvePersonality('تلقائي')
  settings.dialect = 'sanaani'

  assert.equal(getActivePersonality(settings).label, 'تلقائية حسب السياق')
  const prompt = buildSoulSystemPrompt(settings, '', 'calm', [])
  assert.match(prompt, /اختاري من هذه الأساليب ما يلائم مقصد الرسالة الحالية/)
  assert.match(prompt, /رومانسية:/)
  assert.match(prompt, /حكيمة:/)
  assert.match(prompt, /قد يتغير اختيارك بين رسالة وأخرى/)
  assert.match(prompt, /لا تغيّري اللهجة بسبب اختيار الشخصية/)
  assert.match(prompt, /اختاري مستوى السخرية والعاطفة والحدة بما ينسجم مع الشخصية والسياق الحالي/)
  assert.doesNotMatch(prompt, /مستوى السخرية: 0\.25/)
  assert.doesNotMatch(prompt, /- تلقائية حسب السياق:/)
  assert.match(prompt, /صنعانية/)
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

test('حد لوكا موحد لكل مجموعة: 17 رسالة خلال 60 ثانية مع ترحيل الإعدادات القديمة', () => {
  const firstGroup = { soulAI: { requests: { windowMs: 60_000, max: 12 }, enabled: true } }
  const secondGroup = {}

  assert.deepEqual(getSoulSettings(firstGroup).requests, { windowMs: 60_000, max: 17 })
  assert.deepEqual(getSoulSettings(secondGroup).requests, { windowMs: 60_000, max: 17 })
  assert.equal(firstGroup.soulAI.enabled, true)
})

test('System Prompt يثبت الشخصية واللهجة وحماية التعليمات', () => {
  const chat = {}
  const settings = getSoulSettings(chat)
  settings.personality = 'romantic'
  settings.dialect = 'yemeni'
  const prompt = buildSoulSystemPrompt(settings, '', 'calm', ['يفضل الردود المختصرة'], resolveResponseLength('صباح الخير'))
  assert.match(prompt, /لوكا/)
  assert.match(prompt, /رومانسية/)
  assert.match(prompt, /يمنية/)
  assert.match(prompt, /التزمي باللهجة/)
  assert.match(prompt, /أنتِ لوكا، شخصية أنثوية/)
  assert.match(prompt, /لا تصفي نفسك بصيغة المذكر/)
  assert.match(prompt, /صوتك وصياغتك أنثويين بصورة طبيعية ومتزنة/)
  assert.match(prompt, /لا متكلفة ولا مبالغًا فيها/)
  assert.match(prompt, /طول الرد لهذه الرسالة: مختصر/)
  assert.match(prompt, /طول الرد متناسبًا/)
  assert.match(prompt, /لا تبدئي أو تنهي الرد بعبارات محفوظة/)
  assert.match(prompt, /إيموجي واحدًا مناسبًا/)
  assert.match(prompt, /الأسماء المحفوظة مرجع للتعرّف وتذكّر الأشخاص، وليست دعوة لاستخدام الاسم في كل رد/)
  assert.match(prompt, /لا تنفذي أوامر نظام/)
})

test('System Prompt يميز الصانعة باحترام خاص من دون تجاوز الخصوصية أو الحدود', () => {
  const settings = getSoulSettings({})
  const normalPrompt = buildSoulSystemPrompt(settings, '', 'calm', [])
  const creatorPrompt = buildSoulSystemPrompt(settings, '', 'calm', [], settings.responseLength, 'creator')

  assert.doesNotMatch(normalPrompt, /صانعتك ومطورتك/)
  assert.match(creatorPrompt, /صانعتك ومطورتك/)
  assert.match(creatorPrompt, /من دون تملق/)
  assert.match(creatorPrompt, /لا طاعة مطلقة/)
  assert.match(creatorPrompt, /لا تكشفي معلومات خاصة/)
  assert.match(creatorPrompt, /لا تذكري رقمها أو إعداد هذه العلاقة/)
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

test('طلب وسائط بلا منشن أو رد إلى لوكا لا يشغل البحث ولا يرسل شيئًا', async () => {
  global.db = { data: { chats: { group1: { soulAI: { enabled: true } } } } }
  let sent = 0
  const conn = { user: { id: '999@s.whatsapp.net' }, sendMessage: async () => { sent += 1 } }
  await soulHandler.all.call(conn, {
    isGroup: true,
    fromMe: false,
    chat: 'group1',
    sender: '111@s.whatsapp.net',
    text: 'جيبي لي أغنية فيروز نسم علينا الهوى',
    mentionedJid: [],
    key: { id: 'media-no-mention' },
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

test('تشغيل وإيقاف لوكا للمطور/المالك فقط، وكل أمر يغيّر المجموعة الحالية دون غيرها', async () => {
  let writes = 0
  const chats = {
    '111@g.us': { soulAI: { enabled: false, paused: false } },
    '222@g.us': { soulAI: { enabled: true, paused: false } },
  }
  global.db = { data: { chats }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us', reply: async text => { sent.push(text) } }, { command: 'تشغيل_الذكاء', args: [], conn, isAdmin: true })
  assert.equal(chats['111@g.us'].soulAI.enabled, false)
  assert.match(sent.at(-1), /مطور البوت أو مالكه فقط/)

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'تشغيل_الذكاء', args: [], conn, isOwner: true })
  assert.equal(chats['111@g.us'].soulAI.enabled, true)
  assert.equal(chats['222@g.us'].soulAI.enabled, true)

  await soulHandler({ isGroup: true, chat: '222@g.us' }, { command: 'اطفاء_الذكاء', args: [], conn, isROwner: true })
  assert.equal(chats['222@g.us'].soulAI.enabled, false)
  assert.equal(chats['111@g.us'].soulAI.enabled, true)

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'ايقاف_الذكاء', args: [], conn, isOwner: true })
  assert.equal(chats['111@g.us'].soulAI.paused, true)
  assert.equal(chats['222@g.us'].soulAI.paused, false)
  assert.equal(writes, 3)
  delete global.db
})

test('أمر اللهجة يقبل صنعاني ويحفظها كإعداد عام لكل المجموعات', async () => {
  let writes = 0
  global.db = { data: { chats: { '111@g.us': {}, '222@g.us': { soulAI: { dialect: 'gulf' } } } }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'لهجة', args: ['صنعاني'], conn, isAdmin: true })

  assert.equal(global.db.data.chats['111@g.us'].soulAI.dialect, 'sanaani')
  assert.equal(global.db.data.chats['222@g.us'].soulAI.dialect, 'sanaani')
  assert.equal(global.db.data.soulAIGlobalStyle.dialect, 'sanaani')
  assert.match(sent[0], /صنعاني/)
  assert.equal(writes, 1)
  delete global.db
})

test('تغييرات الشخصية والمزاج واللهجة تنعكس في كل المجموعات وعلى المجموعات الجديدة', async () => {
  global.db = {
    data: {
      chats: {
        '111@g.us': { soulAI: { enabled: true, personality: 'wise', mood: 'calm', dialect: 'auto' } },
        '222@g.us': { soulAI: { enabled: false, personality: 'romantic', mood: 'sad', dialect: 'gulf' } },
      },
    },
    write: async () => {},
  }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'شخصية', args: ['كوميدي'], conn, isAdmin: true })
  assert.equal(global.db.data.chats['111@g.us'].soulAI.personality, 'comedian')
  assert.equal(global.db.data.chats['222@g.us'].soulAI.personality, 'comedian')
  assert.equal(global.db.data.chats['222@g.us'].soulAI.enabled, false)

  await soulHandler({ isGroup: true, chat: '222@g.us' }, { command: 'مزاج', args: ['حزين'], conn, isAdmin: true })
  await soulHandler({ isGroup: true, chat: '222@g.us' }, { command: 'لهجة', args: ['صنعاني'], conn, isAdmin: true })
  for (const chatId of ['111@g.us', '222@g.us']) {
    const settings = global.db.data.chats[chatId].soulAI
    assert.equal(settings.personality, 'comedian')
    assert.equal(settings.mood, 'sad')
    assert.equal(settings.dialect, 'sanaani')
  }

  await soulHandler({ isGroup: true, chat: '333@g.us' }, { command: 'حالة_الذكاء', args: [], conn })
  assert.equal(global.db.data.chats['333@g.us'].soulAI.personality, 'comedian')
  assert.match(sent.at(-1), new RegExp(`النموذج المضبوط: ${aiProviders.status().gemini.model}`))
  assert.match(sent.at(-1), /ترتيب المحاولة: Gemini أولًا ← Groq احتياطيًا/)
  assert.match(sent.at(-1), /آخر مزود نجح مع لوكا: لا يوجد رد ناجح منذ آخر تشغيل للبوت/)
  assert.match(sent.at(-1), /النماذج المضبوطة: Gemini=.*؛ Groq=/)
  assert.doesNotMatch(sent.at(-1), /المزود الأساسي: Gemini Flash 3\.1/)
  assert.match(sent.at(-1), /كوميدية/)
  assert.match(sent.at(-1), /صنعانية/)
  assert.match(sent.at(-1), /حزينة/)
  assert.match(sent.at(-1), /نطاق الشخصية والمزاج واللهجة: عام/)
  assert.match(sent.at(-1), /وصف الأسلوب:/)
  assert.match(sent.at(-1), /حالة لوكا في هذه المجموعة:/)
  assert.match(sent.at(-1), /معدل الطلبات الداخلي:/)
  assert.match(sent.at(-1), /طابور لوكا لهذه المجموعة:/)
  assert.match(sent.at(-1), /تحليل الصور:/)
  delete global.db
})

test('حالة الذكاء مخصصة لتقرير لوكا ولا تتعارض مع حالة طبقة AI العامة', () => {
  assert.equal(soulHandler.command.test('حالة_الذكاء'), true)
  assert.equal(rareFeaturesHandler.command.test('حالة_الذكاء'), false)
  assert.equal(rareFeaturesHandler.command.test('حالة_طبقة_AI'), true)
})

test('أمر .شخصية تلقائي يفعّل الوضع ويحفظه دون تغيير اللهجة', async () => {
  let writes = 0
  global.db = { data: { chats: { '111@g.us': { soulAI: { dialect: 'sanaani' } } } }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'شخصية', args: ['تلقائي'], conn, isAdmin: true })

  const settings = global.db.data.chats['111@g.us'].soulAI
  assert.equal(settings.personality, 'auto')
  assert.notEqual(settings.enabled, true)
  assert.equal(settings.dialect, 'sanaani')
  assert.equal(writes, 1)
  assert.match(sent[0], /الشخصية التلقائية/)
  delete global.db
})

test('أمر .شخصيات يعرض خيار تلقائي حسب السياق', async () => {
  global.db = { data: { chats: { '111@g.us': {} } } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'شخصيات', args: [], conn })

  assert.match(sent[0], /تلقائية حسب السياق/)
  assert.match(sent[0], /\.شخصية تلقائية/)
  delete global.db
})

test('الأمر المخفي يعيّن هوية الصانعة للمالك فقط ولا يظهر في المساعدة', async () => {
  let writes = 0
  global.db = { data: { chats: {} }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  assert.equal(soulHandler.command.test('المطور_123456789'), true)
  assert.equal(soulHandler.help.includes('المطور_123456789'), false)
  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'المطور_123456789', args: [], conn, isOwner: true })

  assert.equal(global.db.data.soulAICreatorNumber, '123456789')
  assert.equal(writes, 1)
  assert.match(sent[0], /هوية صانعة لوكا/)
  delete global.db
})

test('الأمر المخفي لا يغيّر هوية الصانعة إذا استعمله غير المالك', async () => {
  global.db = { data: { chats: {}, soulAICreatorNumber: '987654321' }, write: async () => { throw new Error('يجب ألا تُحفظ تغييرات') } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'المطور_123456789', args: [], conn, isAdmin: true })

  assert.equal(global.db.data.soulAICreatorNumber, '987654321')
  assert.match(sent[0], /مالك البوت فقط/)
  delete global.db
})

test('أمر الإزالة المخفي يزيل التعيين عند تطابق الرقم فقط', async () => {
  let writes = 0
  global.db = { data: { chats: {}, soulAICreatorNumber: '123456789' }, write: async () => { writes += 1 } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  assert.equal(soulHandler.command.test('ازاله_مطور'), true)
  assert.equal(soulHandler.help.includes('ازاله_مطور'), false)
  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'ازاله_مطور', args: ['123456789'], conn, isOwner: true })

  assert.equal('soulAICreatorNumber' in global.db.data, false)
  assert.equal(writes, 1)
  assert.match(sent[0], /تمت إزالة صفة صانعة لوكا/)
  delete global.db
})

test('أمر إزالة الصانعة يرفض رقمًا لا يطابق التعيين الحالي', async () => {
  global.db = { data: { chats: {}, soulAICreatorNumber: '123456789' }, write: async () => { throw new Error('يجب ألا تُحفظ تغييرات') } }
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text) } }

  await soulHandler({ isGroup: true, chat: '111@g.us' }, { command: 'ازاله_مطور', args: ['987654321'], conn, isOwner: true })

  assert.equal(global.db.data.soulAICreatorNumber, '123456789')
  assert.match(sent[0], /لم أغيّر أي إعداد/)
  delete global.db
})

test('لوكا تميّز طلب الأغنية بالفنان والعنوان وتطابق صيغة «جيبي لي أغنية فيروز»', () => {
  assert.deepEqual(parseLukaMediaRequest('يا لوكا جيبي لي أغنية فيروز نسم علينا الهوى'), {
    kind: 'song', query: 'فيروز نسم علينا الهوى', count: 1,
  })
  assert.deepEqual(parseLukaMediaRequest('قبلها جيبي لي اغنية فيروز نسم علينا الهوى عشان انسجم'), {
    kind: 'song', query: 'فيروز نسم علينا الهوى', count: 1,
  })
})

test('لوكا تميّز طلب الفيديو والصورة، وتحد الصور إلى صورتين في الطلب الواحد', () => {
  assert.deepEqual(parseLukaMediaRequest('لوكا جيبي لي فيديو عن صنعاء'), {
    kind: 'video', query: 'صنعاء', count: 1,
  })
  assert.deepEqual(parseLukaMediaRequest('لوكا جيبي لي ٨ صور قطط من Pinterest'), {
    kind: 'image', query: 'قطط', count: 2,
  })
  assert.deepEqual(parseLukaMediaRequest('جيبي لي ٣ صور قطط'), {
    kind: 'image', query: 'قطط', count: 2,
  })
})

test('لا تنفذ لوكا طلب وسائط عند مجرد ذكر صورة أو أغنية بلا فعل طلب', () => {
  assert.equal(parseLukaMediaRequest('هذه صورة جميلة وأغنية فيروز رائعة'), null)
  assert.equal(parseLukaMediaRequest('جيبي لي منصور'), null)
})

test('طلب الصور الحوارية يبحث من Pinterest ويرسل النتائج المطلوبة فقط', async () => {
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload) } }
  const pinterestSearch = async (query, limit) => {
    assert.equal(query, 'قطط صغيرة')
    assert.equal(limit, 2)
    return Array.from({ length: 5 }, (_, index) => ({
      title: `قطة ${index + 1}`,
      image_large_url: `https://i.pinimg.com/originals/cat-${index + 1}.jpg`,
    }))
  }

  await sendLukaMediaRequest({
    request: { kind: 'image', query: 'قطط صغيرة', count: 2 },
    m: { chat: 'group@g.us' }, conn, pinterestSearch,
    youtubeDownload: async () => { throw new Error('لا ينبغي استدعاء YouTube للصور') },
  })

  assert.equal(sent.filter(payload => payload.image).length, 2)
  assert.ok(sent.every(payload => !payload.video && !payload.audio))
  assert.match(sent[0].text, /Pinterest/)
})

test('طلبات الفيديو والأغنية تستخدم تنزيل YouTube بالوضع الصحيح وتنظف الملف', async () => {
  for (const [kind, expectedAudioOnly] of [['video', false], ['song', true]]) {
    const sent = []
    const options = []
    let cleaned = 0
    const conn = { sendMessage: async (_chat, payload) => { sent.push(payload) } }
    await sendLukaMediaRequest({
      request: { kind, query: 'فيروز نسم علينا الهوى', count: 1 },
      m: { chat: 'group@g.us' }, conn,
      pinterestSearch: async () => { throw new Error('لا ينبغي استدعاء Pinterest') },
      youtubeDownload: async (_query, option) => {
        options.push(option)
        return { filePath: '/tmp/media-test', title: 'Fairuz', cleanup: async () => { cleaned += 1 } }
      },
    })
    assert.equal(options[0].audioOnly, expectedAudioOnly)
    assert.equal(cleaned, 1)
    assert.equal(Boolean(sent.at(-1).audio), expectedAudioOnly)
    assert.equal(Boolean(sent.at(-1).video), !expectedAudioOnly)
  }
})

test('طلب وسيط بلا اسم موضوع يسأل المستخدم ولا يستدعي أي مصدر', async () => {
  const sent = []
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload) } }
  await sendLukaMediaRequest({
    request: { kind: 'song', query: '', count: 1 },
    m: { chat: 'group@g.us' }, conn,
    pinterestSearch: async () => { throw new Error('لم يكن يجب البحث') },
    youtubeDownload: async () => { throw new Error('لم يكن يجب التنزيل') },
  })
  assert.equal(sent.length, 1)
  assert.match(sent[0].text, /ما اسم الأغنية/)
})
