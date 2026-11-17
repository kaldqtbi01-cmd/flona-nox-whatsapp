import test from 'node:test'
import assert from 'node:assert/strict'
import { initFeatureStore } from '../lib/feature-store.js'
import { remember, listMemories, searchMemories, forgetMemory, reconstructContext, createAgentEngine } from '../lib/agent-memory.js'

function store() {
  const db = { data: {}, async write() {} }
  return initFeatureStore(db)
}

test('يحفظ الذاكرة ضمن scope وowner ويعزلها', async () => {
  const featureStore = store()
  const item = await remember(featureStore, { scope: 'chat-1', owner: 'user-1', text: 'يفضل الرد بالعربية', kind: 'preference' })
  assert.equal(listMemories(featureStore, { scope: 'chat-1', owner: 'user-1' }).length, 1)
  assert.equal(listMemories(featureStore, { scope: 'chat-1', owner: 'user-2' }).length, 0)
  assert.equal(searchMemories(featureStore, { scope: 'chat-1', owner: 'user-1', query: 'العربية' })[0].id, item.id)
  assert.equal(await forgetMemory(featureStore, { scope: 'chat-1', owner: 'user-2', memoryId: item.id }), false)
  assert.equal(await forgetMemory(featureStore, { scope: 'chat-1', owner: 'user-1', memoryId: item.id }), true)
})

test('يعيد بناء السياق والذكريات في نطاق المحادثة', async () => {
  const featureStore = store()
  await remember(featureStore, { scope: 'chat-1', owner: 'user-1', text: 'اسم المشروع فلونا' })
  await featureStore.mutate(data => { data.messages.a = { messageId: 'a', chatId: 'chat-1', senderId: 'user-1', timestamp: 1, text: 'مرحبا' } })
  const result = reconstructContext(featureStore, { chatId: 'chat-1', owner: 'user-1' })
  assert.equal(result.messages.length, 1)
  assert.equal(result.memories[0].text, 'اسم المشروع فلونا')
})

test('الوكيل ينفذ الخطوات المسموحة فقط وينشئ مسودة لا إرسالًا', async () => {
  const featureStore = store()
  const core = { ask: async () => ({ provider: 'fake', text: 'ignored' }) }
  const agent = createAgentEngine({ core, store: featureStore })
  const outputs = await agent.execute({ scope: 'chat-1', owner: 'user-1', context: {}, plan: { goal: 'مهمة', steps: [{ action: 'remember', input: 'معلومة' }, { action: 'draft', input: 'رد يحتاج موافقة' }] } })
  assert.equal(outputs.length, 2)
  assert.equal(listMemories(featureStore, { scope: 'chat-1', owner: 'user-1' }).length, 1)
  assert.equal(outputs[1].status, 'pending')
  assert.equal(featureStore.read().approvals[outputs[1].id].status, 'pending')
})
