import test from 'node:test'
import assert from 'node:assert/strict'
import { DIALECTS, buildSoulSystemPrompt, getSoulSettings, resolveDialect } from '../lib/flona-soul-engine.js'

test('اللهجة التعزية متاحة بأسمائها الشائعة كخيار مستقل', () => {
  assert.equal(resolveDialect('تعزية'), 'taizzi')
  assert.equal(resolveDialect('تعزي'), 'taizzi')
  assert.equal(resolveDialect('تعزيه'), 'taizzi')
  assert.equal(resolveDialect('التعزية'), 'taizzi')
  assert.equal(resolveDialect('تعز'), 'taizzi')
  assert.equal(resolveDialect('لهجة تعز'), 'taizzi')
  assert.equal(resolveDialect('لهجة تعزية'), 'taizzi')
})

test('تعليمات التعزية تغطي ملامح القاموس مع منع خلط اللهجات واستعراض المفردات', () => {
  const settings = getSoulSettings({})
  settings.dialect = 'taizzi'
  const prompt = buildSoulSystemPrompt(settings, '', 'calm', [])

  assert.equal(DIALECTS.taizzi.label, 'تعزية')
  assert.match(prompt, /لهجة «تعزية»/)
  assert.match(prompt, /شاشوفك/)
  assert.match(prompt, /«أذه» بمعنى «هذا»/)
  assert.match(prompt, /«ش» اللاحقة للنفي/)
  assert.match(prompt, /«بَـ» قد تدل على الاستمرار/)
  assert.match(prompt, /«عملنا قا»/)
  assert.match(prompt, /أكه\/هكه/)
  assert.match(prompt, /قراع/)
  assert.match(prompt, /لا تخلطيها بالصنعانية أو التهامية أو العدنية/)
  assert.match(prompt, /تعزية-عدنية/)
  assert.match(prompt, /لا تستعملي من تلقاء نفسك هذه القائمة قبل تحقق محلي/)
  assert.match(prompt, /اكتفي غالبًا بلفظة محلية مناسبة/)
})
