import test from 'node:test'
import assert from 'node:assert/strict'
import { initFeatureStore } from '../lib/feature-store.js'
import { createUltimateEngines } from '../lib/ultimate-engines.js'

function setup() {
  const db = { data: {}, async write() {} }
  const store = initFeatureStore(db)
  const calls = []
  const core = { ask: async ({ input }) => { calls.push(input); return { provider: 'fake', text: 'نتيجة آمنة' } } }
  return { store, core, calls, engines: createUltimateEngines({ store, core }) }
}

test('قاعدة المعرفة تحفظ وتعزل وتبحث', async () => {
  const { engines } = setup()
  await engines.knowledge.add({ scope: 'chat', owner: 'u1', title: 'قواعد', content: 'الرد بالعربية', tags: ['لغة'] })
  await engines.knowledge.add({ scope: 'chat', owner: 'u2', title: 'خاص', content: 'معلومة أخرى' })
  assert.equal(engines.knowledge.search({ scope: 'chat', owner: 'u1', query: 'العربية' }).length, 1)
  assert.equal(engines.knowledge.list({ scope: 'chat', owner: 'u1' }).length, 1)
})

test('التوأم الرقمي يحفظ حقول المالك فقط', async () => {
  const { engines } = setup()
  await engines.twin.set({ owner: 'u1', field: 'اللغة', value: 'العربية' })
  assert.equal(engines.twin.get('u1').fields['اللغة'], 'العربية')
  assert.deepEqual(engines.twin.get('u2').fields, {})
})

test('مجلس الوكلاء يعمل بعدد محدود من الأدوار', async () => {
  const { engines, calls } = setup()
  const result = await engines.council.deliberate({ request: 'حلل النص', context: 'سياق' })
  assert.equal(result.members.length, 3)
  assert.equal(result.synthesis, 'نتيجة آمنة')
  assert.equal(calls.length, 4)
})

test('التوصية تحفظ كاقتراح ولا تنفذ إجراء', async () => {
  const { engines, store } = setup()
  const result = await engines.automation.recommend({ scope: 'chat', owner: 'u1', context: 'سياق' })
  assert.equal(result.status, 'suggested')
  assert.equal(engines.automation.list({ scope: 'chat', owner: 'u1' }).length, 1)
  assert.equal(Object.keys(store.read().approvals).length, 0)
})
