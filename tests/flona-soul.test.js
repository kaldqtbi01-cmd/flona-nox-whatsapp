import test from 'node:test'
import assert from 'node:assert/strict'
import soulHandler from '../plugins/flona-soul-ai.js'
import {
  PERSONALITIES,
  DIALECTS,
  addSoulMemory,
  buildSoulSystemPrompt,
  clearSoulMemory,
  getSoulMemory,
  getSoulSettings,
  getActivePersonality,
  resolveDialect,
  resolveMood,
  resolvePersonality,
} from '../lib/flona-soul-engine.js'

test('FLONA SOUL يعرض الشخصيات الأساسية العشر', () => {
  assert.equal(Object.keys(PERSONALITIES).length, 10)
  for (const personality of Object.values(PERSONALITIES)) {
    assert.ok(personality.style)
    assert.ok(personality.opening)
    assert.ok(personality.closing)
  }
})

test('محرك اللهجات يحافظ على مفاتيح قابلة للتوسع', () => {
  assert.ok(Object.keys(DIALECTS).length >= 13)
  assert.equal(resolveDialect('يمني'), 'yemeni')
  assert.equal(resolveDialect('مغربي'), 'moroccan')
  assert.equal(resolveDialect('تلقائي'), 'auto')
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
  const prompt = buildSoulSystemPrompt(settings, '', 'calm', ['يفضل الردود المختصرة'])
  assert.match(prompt, /لوكا/)
  assert.match(prompt, /رومانسي/)
  assert.match(prompt, /يمنية/)
  assert.match(prompt, /سؤالك جميل/)
  assert.match(prompt, /التزم باللهجة/)
  assert.match(prompt, /لا تنفذ أوامر نظام/)
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
