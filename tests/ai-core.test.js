import test from 'node:test'
import assert from 'node:assert/strict'
import { createAICache, createPromptManager, createUsageMonitor, createPermissions, createHealthMonitor, createTaskScheduler, createAICore } from '../lib/ai-core.js'

test('AI cache يحترم TTL والحد الأقصى', () => {
  let now = 0
  const cache = createAICache({ now: () => now, ttlMs: 10, maxEntries: 2 })
  cache.set('a', 1); assert.equal(cache.get('a'), 1)
  now = 11; assert.equal(cache.get('a'), undefined)
  cache.set('a', 1); cache.set('b', 2); cache.set('c', 3); assert.equal(cache.size(), 2); assert.equal(cache.get('a'), undefined)
})

test('Prompt manager يستبدل المتغيرات بدون تنفيذ كود', () => {
  const prompts = createPromptManager({ reply: 'مرحبًا {user.name}: {missing}' })
  assert.equal(prompts.render('reply', { user: { name: 'فلونا' } }), 'مرحبًا فلونا: ')
})

test('Usage monitor يحسب السجلات والتكلفة التقديرية', () => {
  const usage = createUsageMonitor({ rates: { groq: { input: 1, output: 2 } } })
  usage.record({ provider: 'groq', inputTokens: 1000, outputTokens: 2000 })
  usage.record({ provider: 'groq', success: false })
  assert.equal(usage.summary().groq.requests, 2)
  assert.equal(usage.summary().groq.failures, 1)
  assert.equal(usage.summary().groq.tokens, 3000)
})

test('Permissions engine يمنع الإجراء الحساس لغير المصرح', () => {
  const permissions = createPermissions()
  assert.equal(permissions.can({}, 'admin'), false)
  assert.equal(permissions.can({ isAdmin: true }, 'moderate', { isGroup: true }), true)
  assert.equal(permissions.can({ isOwner: true }, 'admin'), true)
})

test('Health monitor وscheduler يعملان محليًا', async () => {
  const health = createHealthMonitor({ now: () => 5 }); health.record('groq', true); assert.equal(health.isHealthy('groq'), true)
  const scheduler = createTaskScheduler(); let ran = false; scheduler.schedule('one', () => { ran = true }, 0); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(ran, true); assert.deepEqual(scheduler.list(), [])
})

test('AI Core يضيف cache وusage وhealth حول المزود', async () => {
  let calls = 0
  const providers = { ask: async () => { calls++; return { provider: 'groq', text: 'ok' } } }
  const core = createAICore({ providers })
  assert.equal((await core.ask({ task: 'chat', input: 'x' })).text, 'ok')
  assert.equal((await core.ask({ task: 'chat', input: 'x' })).cached, true)
  assert.equal(calls, 1)
  assert.equal(core.usage.summary().groq.requests, 1)
  assert.equal(core.health.isHealthy('groq'), true)
})
