import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSoulSystemPrompt,
  detectMood,
  getSoulSettings,
  resolveDialect,
  resolveMood,
  resolvePersonality,
} from '../lib/flona-soul-engine.js'

test('الأوضاع التلقائية الثلاثة تتكيف مع الرسالة والسياق', () => {
  const settings = getSoulSettings({})
  settings.personality = resolvePersonality('تلقائي')
  settings.dialect = resolveDialect('تلقائي')
  settings.mood = resolveMood('تلقائي')

  assert.equal(settings.personality, 'auto')
  assert.equal(settings.dialect, 'auto')
  assert.equal(settings.mood, 'auto')
  assert.equal(detectMood('ما عاد أدري كيف أتصرف، أنا متضايق', settings), 'auto')

  const prompt = buildSoulSystemPrompt(settings, '', 'auto', [])
  assert.match(prompt, /تلقائي تكيفي يجمع السمات من الشخصيات كلها/)
  assert.match(prompt, /امزجي السمات المتوافقة/)
  assert.match(prompt, /لا تستخدمي الغزل الجريء/)
  assert.match(prompt, /استنتجي لهجة صاحب الرسالة الحالية/)
  assert.match(prompt, /مزاجك تلقائي ومتغير حسب كل رسالة/)
  assert.match(prompt, /لا الكلمات المفتاحية وحدها/)
  assert.doesNotMatch(prompt, /مزاجك الحالي: هادئة ومتزنة/)
})

test('اختيارات الشخصية واللهجة والمزاج اليدوية لا تتغير مع الأوضاع التلقائية', () => {
  const settings = getSoulSettings({})
  settings.personality = 'wise'
  settings.dialect = 'taizzi'
  settings.mood = 'sad'

  const prompt = buildSoulSystemPrompt(settings, '', 'sad', [])
  assert.match(prompt, /شخصيتك الحالية: حكيمة/)
  assert.match(prompt, /مزاجك الحالي: حزينة وهادئة/)
  assert.match(prompt, /تكلّمي بلهجة تعزية طبيعية/)
  assert.doesNotMatch(prompt, /تلقائي تكيفي يجمع السمات من الشخصيات كلها/)
  assert.doesNotMatch(prompt, /مزاجك تلقائي ومتغير حسب كل رسالة/)
  assert.doesNotMatch(prompt, /استنتجي لهجة صاحب الرسالة الحالية/)
})
