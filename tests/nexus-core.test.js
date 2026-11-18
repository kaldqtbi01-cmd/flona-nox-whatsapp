import test from 'node:test'
import assert from 'node:assert/strict'
import { initFeatureStore } from '../lib/feature-store.js'
import { createNexusCore } from '../lib/nexus-core.js'

function setup() {
  const db = { data: {}, async write() {} }
  const store = initFeatureStore(db)
  const calls = []
  const core = { ask: async ({ input }) => { calls.push(input); return { provider: 'fake', text: 'تحليل آمن' } } }
  return { store, calls, nexus: createNexusCore({ core, store, security: { inspect: input => ({ safe: !String(input).includes('bad'), findings: [] }) } }) }
}

test('Nexus يشغل وكلاء محددين بالتوازي وينشئ مراجعة', async () => {
  const { nexus, store, calls } = setup()
  const result = await nexus.runSwarm({ scope: 'chat', owner: 'u', request: 'حلل المهمة', roles: ['RESEARCH', 'ANALYST', 'UNKNOWN'] })
  assert.equal(result.status, 'completed')
  assert.deepEqual(result.results.map(x => x.role), ['RESEARCH', 'ANALYST'])
  assert.equal(calls.length, 3)
  assert.equal(nexus.listTasks({ scope: 'chat', owner: 'u' }).length, 1)
  assert.equal(store.read().nexus.events.at(-1).type, 'swarm.completed')
})

test('Nexus يقيّد الأدوار ولا يسمح بـ EXECUTOR داخل السرب التلقائي', async () => {
  const { nexus } = setup()
  const result = await nexus.runSwarm({ scope: 'chat', owner: 'u', request: 'مهمة', roles: ['EXECUTOR'] })
  assert.equal(result.results[0].role, 'RESEARCH')
})

test('الشخصيات مستقلة ويمكن اختيارها وتظهر في الحالة', async () => {
  const { nexus, store } = setup()
  assert.equal(nexus.persona('ATHENA').role, 'خبيرة تقنية وبرمجة')
  await nexus.setPersona('u', 'SENTINEL')
  assert.equal(store.read().nexus.personas.u.persona, 'SENTINEL')
  assert.equal(nexus.status().personas, 1)
})

test('Nexus securityScan يمرر الفحص الأمني', () => {
  const { nexus } = setup()
  assert.equal(nexus.securityScan('bad').safe, false)
})

test('Nexus يعيد المحاولة مرة واحدة ثم يسجل التعافي', async () => {
  const db = { data: {}, async write() {} }
  const store = initFeatureStore(db)
  let attempts = 0
  const core = { ask: async () => {
    attempts += 1
    if (attempts === 1) throw new Error('HTTP 503')
    return { provider: 'fake', text: 'تم التعافي' }
  } }
  const nexus = createNexusCore({ core, store })
  const result = await nexus.runSwarm({ scope: 'chat', owner: 'u', request: 'مهمة قصيرة', roles: ['RESEARCH'] })
  assert.equal(result.status, 'completed')
  assert.equal(nexus.status().health.recovered, 1)
})

test('Nexus يوسع عدد الوكلاء تلقائيًا للمهمة الطويلة', async () => {
  const { nexus } = setup()
  const result = await nexus.runSwarm({ scope: 'chat', owner: 'u', request: 'x'.repeat(600), roles: ['RESEARCH', 'ANALYST', 'SECURITY', 'CREATIVE', 'CODER'] })
  assert.equal(result.results.length, 4)
})
