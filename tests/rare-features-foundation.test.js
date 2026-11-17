import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMessage } from '../lib/message-contract.js'
import { initFeatureStore } from '../lib/feature-store.js'
import { appendMessage, buildContext } from '../lib/message-history.js'
import { createChatQueue } from '../lib/ai-queue.js'
import { renderTemplate, runWorkflow } from '../lib/workflow-engine.js'
import { createDraft, editDraft, transition } from '../lib/approval-outbox.js'
import { detectModeration, normalizeText } from '../lib/moderation-policy.js'

function db() { const data = {}; return { data, async write() {} } }

test('normalizes messages and builds quoted context', async () => {
  const store = initFeatureStore(db())
  const first = normalizeMessage({ key: { id: 'a', remoteJid: '123:4@s.whatsapp.net' }, message: { conversation: 'قديم' } })
  const second = normalizeMessage({ key: { id: 'b', remoteJid: '123@s.whatsapp.net', participant: '9@s.whatsapp.net' }, message: { extendedTextMessage: { text: 'جديد', contextInfo: { stanzaId: 'a' } } } })
  await appendMessage(store, first); await appendMessage(store, second)
  assert.equal(buildContext(store, second.chatId).find(item => item.messageId === 'a').contextRole, 'quoted')
})

test('serializes FIFO jobs per chat', async () => {
  const queue = createChatQueue(); const order = []
  await Promise.all([queue.run('c', async () => { order.push(1) }), queue.run('c', async () => { order.push(2) })])
  assert.deepEqual(order, [1, 2])
})

test('workflow blocks prototype access and supports branching', async () => {
  assert.equal(renderTemplate('{{__proto__.polluted}} {{name}}', { name: 'ok' }), ' ok')
  const result = await runWorkflow({ startNode: 'a', nodes: [{ id: 'a', type: 'condition', data: { path: 'value', operator: 'equals', value: 'yes' } }, { id: 'b', type: 'format', data: { value: 'نجح {{value}}' } }, { id: 'c', type: 'end' }], edges: [{ source: 'a', target: 'b', sourceHandle: 'true' }, { source: 'b', target: 'c' }] }, { value: 'yes' })
  assert.equal(result.context.output, 'نجح yes')
})

test('approval transitions and stale edits are guarded', async () => {
  const store = initFeatureStore(db()); const draft = await createDraft(store, { body: 'رد' })
  const edited = await editDraft(store, draft.id, 'رد معدل', 'owner', 1)
  await transition(store, draft.id, 'approved', 'owner', edited.revision)
  await assert.rejects(() => editDraft(store, draft.id, 'متأخر', 'owner', edited.revision))
})

test('moderation normalizes Arabic and reports audit-only violations', () => {
  assert.equal(normalizeText('إِختبارـ'), 'اختبار')
  const result = detectModeration({ text: 'https://example.com' }, { antiLink: true, auditOnly: true })
  assert.deepEqual(result.violations, ['link']); assert.equal(result.auditOnly, true)
})
